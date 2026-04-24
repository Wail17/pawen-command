// ============================================================
// PAWEN — Phase U.4 — Provider common helpers
// Tiny shared utilities used by every adapter to keep the edge
// runtime lean.
// ============================================================

import type { ProviderHealth } from './types';

export function nowIso(): string {
  return new Date().toISOString();
}

export function requireEnv(name: string): string | null {
  const v = process.env[name];
  if (!v || v.length === 0) return null;
  return v;
}

export function missingEnvHealth(providerId: string, envVar: string | string[]): ProviderHealth {
  const missing = Array.isArray(envVar) ? envVar : [envVar];
  const missingActual = missing.filter(n => !process.env[n] || process.env[n]!.length === 0);
  if (missingActual.length === 0) {
    return { ok: true, message: `${providerId}: env present (no live check performed)`, lastCheckedAt: nowIso() };
  }
  return {
    ok: false,
    message: `${providerId}: missing env var${missingActual.length > 1 ? 's' : ''}: ${missingActual.join(', ')}`,
    envVarMissing: missingActual,
    lastCheckedAt: nowIso(),
  };
}

/**
 * Wrap a fetch with a per-call timeout. Default 30s. Returns null on any
 * failure — callers decide whether to retry or fall through.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = 30_000, ...rest } = init;
  try {
    return await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return null;
  }
}

/**
 * Simple SHA-256 hex digest — used for cache keys + dedup hashes.
 */
export async function sha256Hex(text: string): Promise<string> {
  // Node 20+ exposes Web Crypto.
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize a URL for caching / dedup: lowercase host, drop common tracking
 * params, strip trailing slash, drop fragment.
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    // Drop common tracking params
    const drop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                  'fbclid', 'gclid', 'ref', 'ref_src', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi'];
    for (const p of drop) u.searchParams.delete(p);
    // Sort params for deterministic output
    const entries = [...u.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    u.search = '';
    for (const [k, v] of entries) u.searchParams.append(k, v);
    let out = u.toString();
    if (out.endsWith('/') && u.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return raw;
  }
}
