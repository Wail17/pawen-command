// ============================================================
// AutoEcom Lab — Edge proxy (Next.js 16 `proxy.ts`, formerly middleware)
//
// Runs on every request (scoped by matcher below) BEFORE the route
// handler executes. Responsibilities:
//
//   1. Strip any client-spoofed trust headers
//      Clients could try to set `x-pawen-user: Sykss` themselves.
//      We wipe those upfront so only the proxy can populate them.
//      Also wipes `x-middleware-subrequest` as belt-and-suspenders
//      against CVE-2025-29927 (patched in Next.js 14.2.25+, but
//      we're defensive).
//
//   2. Origin lock (production only)
//      Rejects cross-origin or off-domain requests. Trusts:
//         - VERCEL_PROJECT_PRODUCTION_URL (auto-injected by Vercel)
//         - ALLOWED_ORIGINS (comma-separated override)
//      Blocks any `localhost` / `127.0.0.1` origin in production.
//
//   3. Session gate on /api/*
//      Any /api/* call that is NOT in PUBLIC_API_PATHS must carry a
//      valid session cookie (HMAC-signed, verified in session.ts).
//      Returns 401 JSON fast — route handler never runs.
//
//   4. Admin gate on /api/admin/*
//      Requires session.role === 'admin' OR a valid x-admin-token
//      header (legacy path — kept until every admin route migrates
//      to cookie sessions). Returns 403 JSON on failure.
//
// !! DEFENSE IN DEPTH !!
// Route handlers MUST NOT trust the `x-pawen-user` / `x-pawen-role`
// headers set downstream. Always call `getSessionFromRequest(req)`
// (or the thin `requireSession` helper) in the handler itself.
// Matchers can be misconfigured, and internal rewrites can bypass
// the proxy. The proxy is the first line of defense, not the only
// one. See https://vercel.com/docs/routing-middleware for the full
// warning.
//
// NOTE: Next.js 16 renamed `middleware.ts` → `proxy.ts`. Both still
// work, but the docs warn `middleware` is deprecated. We use the
// new name. Proxy runs on the Node.js runtime by default in 16+,
// so we can import the session library and node:crypto directly.
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';

// ---------- KILL SWITCH ----------
// When true, every incoming request returns 503 before any other logic runs.
// Used to take the tool offline for QA / Ralph loop iterations without
// deleting the deployment. Flip to `false` and redeploy to restore service.
// Kill switch: ON in production, OFF in local dev. Override either way
// with the KILL_SWITCH env var ('1'/'0'). Admin tooling + cron bypass it
// regardless via isKillSwitchBypassRequest() below.
const KILL_SWITCH = (() => {
  const v = (process.env.KILL_SWITCH ?? '').toLowerCase();
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return process.env.NODE_ENV === 'production';
})();

function killSwitchResponse(): NextResponse {
  return new NextResponse(
    '<!doctype html><html><head><meta charset="utf-8"><title>Offline</title><style>body{font-family:system-ui,sans-serif;background:#000;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:2rem}h1{font-size:1.5rem;margin:0 0 1rem;font-weight:500}p{opacity:.6;margin:0;font-size:.95rem}</style></head><body><div><h1>Pawen Command Center — Offline</h1><p>Maintenance en cours. Accès suspendu.</p></div></body></html>',
    {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store, must-revalidate',
        'retry-after': '3600',
      },
    }
  );
}

// ---------- Global API Rate Limiter (in-memory, per-user) ----------
// Sliding window: tracks request timestamps per user key (username or IP).
// Limits: 120 requests per 60 seconds per user on authenticated routes.
// This runs BEFORE the session gate so unauthenticated abuse also gets caught
// (keyed by IP in that case). Reset on cold-start, which is fine — it's a
// defense-in-depth layer, not the sole protection.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
// Heavy endpoints (generate, scrape, tiktok, avatars) get a tighter cap
const HEAVY_ENDPOINTS = new Set([
  '/api/generate',
  '/api/scrape',
  '/api/tiktok',
  '/api/avatars/awareness',
  '/api/avatars/deep-dive',
  '/api/imagegen',
]);
const HEAVY_RATE_LIMIT_MAX = 30; // 30 per minute for expensive calls

const rateLimitBuckets = new Map<string, number[]>();

function isRateLimited(key: string, maxReqs: number): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key) ?? [];
  // Prune entries outside the window
  const pruned = bucket.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (pruned.length >= maxReqs) {
    rateLimitBuckets.set(key, pruned);
    return true;
  }
  pruned.push(now);
  rateLimitBuckets.set(key, pruned);
  return false;
}

// Periodic cleanup to prevent memory leak (every 5 min, drop stale keys)
let lastCleanup = Date.now();
function maybeCleanupBuckets() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [key, timestamps] of rateLimitBuckets) {
    const fresh = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) rateLimitBuckets.delete(key);
    else rateLimitBuckets.set(key, fresh);
  }
}

// ---------- Public API paths (no session required) ----------
// These are the ONLY /api/* routes that may be hit without a session:
//   - /api/auth/login     → issues the session
//   - /api/auth/logout    → clears the session (no-op if unauthed)
//   - /api/auth/users     → user picker list (called between password and session)
//   - /api/auth/me        → session introspection (handles 401 itself)
//   - /api/admin/login    → legacy admin bootstrap (kept for back-compat)
const PUBLIC_API_PATHS = new Set<string>([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/users',
  '/api/auth/me',
  '/api/admin/login',
  '/api/shopify-oauth/callback', // Shopify redirects here after OAuth — no session cookie
  '/api/cron/meta-perf', // Phase U.3a — Vercel cron, auth via CRON_SECRET header (checked in handler)
  '/api/inngest', // Inngest webhook — auth via signature (INNGEST_SIGNING_KEY) verified by serve()
]);

// ---------- Helpers ----------

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, message }, { status });
}

/**
 * Collect the set of hostnames this deployment should accept requests for.
 * Always includes VERCEL_PROJECT_PRODUCTION_URL and any comma-separated
 * entries in ALLOWED_ORIGINS. In non-production we also trust localhost.
 */
function getAllowedHosts(): Set<string> {
  const hosts = new Set<string>();

  const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prodUrl) hosts.add(prodUrl.toLowerCase());

  const extra = process.env.ALLOWED_ORIGINS;
  if (extra) {
    for (const raw of extra.split(',')) {
      const trimmed = raw.trim().toLowerCase();
      if (!trimmed) continue;
      // Strip scheme if caller provided one (e.g. "https://foo.com")
      hosts.add(trimmed.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    hosts.add('localhost:3000');
    hosts.add('127.0.0.1:3000');
    hosts.add('localhost');
  }

  return hosts;
}

/**
 * Production-only origin lock. Returns a NextResponse if the request
 * should be rejected, or null if it should proceed.
 *
 * Strategy:
 *   - In production, the request's host header MUST be in the allow-list
 *     (or match the current Vercel preview host via x-forwarded-host).
 *   - If an Origin header is present (browser cross-origin), it must ALSO
 *     resolve to an allowed host.
 *   - Localhost is hard-blocked in production to prevent tunnel attacks.
 */
function checkOrigin(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null;

  const allowed = getAllowedHosts();
  if (allowed.size === 0) {
    // No allow-list configured → rely on Vercel's edge routing. Be permissive
    // so we never lock the owner out of a fresh deploy, but log it.
    console.warn('[proxy] no allowed hosts configured — skipping origin lock');
    return null;
  }

  const host = (req.headers.get('host') ?? '').toLowerCase();
  const forwardedHost = (req.headers.get('x-forwarded-host') ?? '').toLowerCase();
  const effectiveHost = forwardedHost || host;

  // Hard-block localhost in production
  if (
    effectiveHost.startsWith('localhost') ||
    effectiveHost.startsWith('127.0.0.1') ||
    effectiveHost.startsWith('0.0.0.0')
  ) {
    return jsonError(403, 'Forbidden (localhost in prod)');
  }

  if (!allowed.has(effectiveHost)) {
    console.warn(`[proxy] host "${effectiveHost}" not in allow-list`);
    return jsonError(403, 'Forbidden origin');
  }

  // If an Origin header is present, it must also be one of ours.
  const origin = req.headers.get('origin');
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return jsonError(403, 'Invalid origin');
    }
    if (!allowed.has(originHost)) {
      console.warn(`[proxy] origin "${originHost}" not in allow-list`);
      return jsonError(403, 'Forbidden origin');
    }
  }

  return null;
}

// ---------- Proxy function ----------

/**
 * Build a sanitized Headers object with any spoofable trust headers removed.
 * The proxy is the only place allowed to set `x-pawen-*` — if a caller sends
 * them, they're either confused or malicious. Either way, strip them.
 */
function sanitizeHeaders(req: NextRequest): Headers {
  const h = new Headers(req.headers);
  h.delete('x-pawen-user');
  h.delete('x-pawen-role');
  h.delete('x-middleware-subrequest'); // CVE-2025-29927 defense-in-depth
  return h;
}

// Constant-time-ish equality (same shape as adminServer.safeEqual) so the
// kill-switch bypass doesn't leak timing info. Duplicated locally to keep
// proxy.ts free of 'server-only' imports (edge runtime).
function safeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isKillSwitchBypassRequest(req: NextRequest): boolean {
  // Bypass paths:
  //   (a) x-admin-token == ADMIN_PASSWORD → admin tooling + ralph-loop smoke tests
  //   (b) Vercel cron: Authorization: Bearer CRON_SECRET OR x-cron-secret == CRON_SECRET
  //       so scheduled jobs keep running while the UI is offline.
  const adminPw = process.env.ADMIN_PASSWORD;
  if (adminPw && adminPw.length > 0) {
    const token = req.headers.get('x-admin-token') ?? '';
    if (token && safeEqualStr(token, adminPw)) return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && cronSecret.length > 0) {
    const xCron = req.headers.get('x-cron-secret') ?? '';
    if (xCron && safeEqualStr(xCron, cronSecret)) return true;
    const bearerHeader = req.headers.get('authorization');
    if (bearerHeader && bearerHeader.startsWith('Bearer ')) {
      const bearer = bearerHeader.slice(7);
      if (bearer && safeEqualStr(bearer, cronSecret)) return true;
    }
  }

  return false;
}

export function proxy(req: NextRequest): NextResponse {
  // 0. KILL SWITCH — first thing, before anything else.
  // Exception: admin tooling with a valid x-admin-token header is allowed
  // through so maintenance tasks + /api/admin/* stay operable while the
  // tool is offline to normal users.
  if (KILL_SWITCH && !isKillSwitchBypassRequest(req)) return killSwitchResponse();

  const { pathname } = req.nextUrl;

  // 0. Periodic bucket cleanup
  maybeCleanupBuckets();

  // 1. Origin lock (prod only)
  const originReject = checkOrigin(req);
  if (originReject) return originReject;

  // Only API routes carry the session gate — page routes still
  // auth via the client-side password screen + /api/auth/me hydration.
  if (!pathname.startsWith('/api/')) {
    // Still strip spoofed trust headers on page requests so server
    // components can't be tricked into reading them.
    return NextResponse.next({ request: { headers: sanitizeHeaders(req) } });
  }

  // 2. Public API paths bypass the session gate
  const isPublicPath = PUBLIC_API_PATHS.has(pathname) ||
    pathname.startsWith('/api/shopify-oauth/'); // Shopify OAuth flow (CSRF nonce protects callback)
  if (isPublicPath) {
    // Still rate-limit public paths by IP to prevent brute-force
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (isRateLimited(`ip:${ip}`, RATE_LIMIT_MAX_REQUESTS)) {
      return jsonError(429, 'Too many requests — slow down');
    }
    return NextResponse.next({ request: { headers: sanitizeHeaders(req) } });
  }

  // 3. Session gate
  const session = getSessionFromRequest(req);
  const isAdminRoute = pathname.startsWith('/api/admin/');

  if (!session) {
    // Back-compat: admin routes still accept the legacy x-admin-token
    // header so the old admin UI keeps working until we migrate it.
    if (isAdminRoute && req.headers.get('x-admin-token')) {
      return NextResponse.next({ request: { headers: sanitizeHeaders(req) } });
    }
    return jsonError(401, 'Authentication required');
  }

  // Blocked users shouldn't have a valid session anyway, but belt-and-suspenders
  if (session.role === 'blocked') {
    return jsonError(403, 'Account blocked');
  }

  // 4. Admin role gate
  if (isAdminRoute && session.role !== 'admin') {
    return jsonError(403, 'Admin access required');
  }

  // 5. Per-user rate limiting (authenticated routes)
  const isHeavy = HEAVY_ENDPOINTS.has(pathname);
  const userKey = `user:${session.user}`;
  const heavyKey = `heavy:${session.user}`;
  if (isRateLimited(userKey, RATE_LIMIT_MAX_REQUESTS)) {
    console.warn(`[proxy:rate-limit] user "${session.user}" hit global cap on ${pathname}`);
    return jsonError(429, 'Too many requests — slow down');
  }
  if (isHeavy && isRateLimited(heavyKey, HEAVY_RATE_LIMIT_MAX)) {
    console.warn(`[proxy:rate-limit] user "${session.user}" hit heavy cap on ${pathname}`);
    return jsonError(429, 'Too many heavy requests — wait a moment');
  }

  // Pipe the session user downstream as a convenience header for
  // logging / observability. Route handlers MUST still call
  // `getSessionFromRequest(req)` themselves — see the file header for why.
  const requestHeaders = sanitizeHeaders(req);
  requestHeaders.set('x-pawen-user', session.user);
  requestHeaders.set('x-pawen-role', session.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// ---------- Matcher ----------
// Run on ALL requests — /api/* for session + rate-limit gating,
// page routes for security headers and origin lock.
//
// Matcher values MUST be constants (statically analyzed at build).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
