// ============================================================
// AutoEcom Lab — Session auth (server only)
//
// HMAC-signed, HTTP-only, Secure cookies. No JWT library —
// just Node's crypto for a tiny, dependency-free session token.
//
// Token format (base64url):
//   <payload>.<hmac>
// where payload is JSON { user, role, iat, exp } and hmac is
// HMAC-SHA256 of the payload bytes using SESSION_SECRET.
//
// Why not JWT? Adds a dep and a parser attack surface for a
// single-purpose cookie. This does exactly what we need in ~60
// lines and nothing else.
// ============================================================

import 'server-only';
import crypto from 'node:crypto';
import type { AppUserRole } from '@/lib/db/schema';

const COOKIE_NAME = 'pawen-session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface SessionPayload {
  user: string;           // app-user name (e.g. "Sykss")
  role: AppUserRole;
  iat: number;            // issued at (ms epoch)
  exp: number;            // expires at (ms epoch)
}

function getSecret(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET is not set or is too short (need 32+ chars). ' +
        'Set it in Vercel env vars with `openssl rand -base64 48` or equivalent.'
    );
  }
  return Buffer.from(secret, 'utf8');
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    str.length + ((4 - (str.length % 4)) % 4),
    '='
  );
  return Buffer.from(padded, 'base64');
}

/** Constant-time buffer comparison. */
function safeBufEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Sign a session payload and return a cookie-ready token. */
export function signSession(user: string, role: AppUserRole): string {
  const now = Date.now();
  const payload: SessionPayload = {
    user,
    role,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const hmac = crypto.createHmac('sha256', getSecret()).update(payloadBuf).digest();
  return `${base64url(payloadBuf)}.${base64url(hmac)}`;
}

/**
 * Verify a token string. Returns the payload on success, or null on any
 * signature/format/expiry failure. NEVER throws — callers just treat a null
 * return as "no valid session".
 */
export function verifySession(token: string | null | undefined): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;

  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  let payloadBuf: Buffer;
  let sigBuf: Buffer;
  try {
    payloadBuf = base64urlDecode(payloadB64);
    sigBuf = base64urlDecode(sigB64);
  } catch {
    return null;
  }

  let expected: Buffer;
  try {
    expected = crypto.createHmac('sha256', getSecret()).update(payloadBuf).digest();
  } catch {
    return null;
  }

  if (!safeBufEqual(sigBuf, expected)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(payloadBuf.toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.user !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.exp !== 'number' ||
    typeof payload.iat !== 'number'
  ) {
    return null;
  }

  if (Date.now() > payload.exp) return null;

  return payload;
}

/** Read the session payload from a Request. */
export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const token = parseCookie(cookieHeader, COOKIE_NAME);
  return verifySession(token);
}

/** Parse a single cookie value out of a Cookie header. */
function parseCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/** Build a Set-Cookie header value for issuing a session. */
export function buildSessionCookie(token: string): string {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

/** Build a Set-Cookie header value that clears the session. */
export function buildClearSessionCookie(): string {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

/** True if the request's session user has role === 'admin'. */
export function isAdminSession(req: Request): boolean {
  const session = getSessionFromRequest(req);
  return session?.role === 'admin';
}

/**
 * Route-handler helper: returns the session, or a 401 JSON Response that
 * the handler should return directly. Defense-in-depth — the proxy already
 * gates /api/*, but matchers can be misconfigured and internal rewrites
 * can bypass middleware. Every protected route should call this.
 *
 * Usage:
 *   const session = requireSession(req);
 *   if (session instanceof Response) return session;
 *   // ...session.user, session.role are now trusted
 */
export function requireSession(
  req: Request,
): SessionPayload | Response {
  const session = getSessionFromRequest(req);
  if (!session) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Authentication required' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
  }
  if (session.role === 'blocked') {
    return new Response(
      JSON.stringify({ ok: false, message: 'Account blocked' }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    );
  }
  return session;
}

/**
 * Like `requireSession`, but also enforces `role === 'admin'`. Returns
 * either the session (trusted) or a Response the handler must return.
 */
export function requireAdmin(
  req: Request,
): SessionPayload | Response {
  const session = requireSession(req);
  if (session instanceof Response) return session;
  if (session.role !== 'admin') {
    return new Response(
      JSON.stringify({ ok: false, message: 'Admin access required' }),
      { status: 403, headers: { 'content-type': 'application/json' } },
    );
  }
  return session;
}

/**
 * Extract best-effort client IP from a Next.js request. Falls back to
 * "unknown" if no header is set.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
