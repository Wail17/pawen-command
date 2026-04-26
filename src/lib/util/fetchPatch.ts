// ============================================================
// PAWEN — globalThis.fetch monkey-patch (server-only)
//
// When code running inside `withInternalContext({ baseUrl, sessionCookie })`
// makes a fetch call to our own deployment (e.g., `/api/scraping/fetch`),
// the patched fetch automatically forwards the user's session cookie so
// downstream `requireSession` succeeds without the caller having to plumb
// auth through manually.
//
// Idempotent — call from every function entry point (Inngest steps,
// API routes, workers). Safe to invoke many times; only patches once.
// External fetches (different host) get the original behavior.
// ============================================================

import 'server-only';
import { getInternalContext } from './internalContext';

const ORIGINAL_FETCH = globalThis.fetch;
let fetchPatched = false;

export function ensureFetchPatched(): void {
  if (fetchPatched) return;
  fetchPatched = true;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const ctx = getInternalContext();
    if (!ctx?.sessionCookie) return ORIGINAL_FETCH(input, init);

    let url: string;
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;

    let isInternal = false;
    try {
      const parsed = new URL(url, ctx.baseUrl);
      const baseHost = new URL(ctx.baseUrl).host;
      isInternal = parsed.host === baseHost;
    } catch {
      isInternal = true; // relative URL → internal
    }

    if (!isInternal) return ORIGINAL_FETCH(input, init);

    const headers = new Headers(init?.headers);
    const existing = headers.get('cookie');
    headers.set('cookie', existing ? `${existing}; ${ctx.sessionCookie}` : ctx.sessionCookie);
    return ORIGINAL_FETCH(input, { ...init, headers });
  }) as typeof fetch;
}
