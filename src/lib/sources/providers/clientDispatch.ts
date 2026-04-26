// ============================================================
// PAWEN — Phase U.4.3 — Client-side dispatcher
//
// Helper for the legacy fetchers in src/lib/sources/*.ts. When the
// NEXT_PUBLIC_USE_NEW_SCRAPING_STACK flag is on, they call this
// instead of hitting /api/reddit, /api/tiktok etc. directly.
// ============================================================

import type { RawSourceData, SourceDiscoveryPlan } from '../../avatars/types';
import { apiUrl } from '../../util/apiBaseUrl';

export function isNewScrapingStackOn(): boolean {
  // Client-readable — server-only check happens inside the route handler.
  const v = process.env.NEXT_PUBLIC_USE_NEW_SCRAPING_STACK ?? '';
  const s = v.toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

type Source = 'reddit' | 'quora' | 'youtube' | 'tiktok' | 'amazon' | 'shopify';

export async function fetchViaNewStack(
  source: Source,
  plan: SourceDiscoveryPlan[Source],
  language: string,
): Promise<RawSourceData> {
  const start = Date.now();
  // Reddit posts (270s BD poll) + comments (270s BD poll) can run up to
  // 540s; Amazon search + reviews similar. Vercel function-to-function
  // calls drop occasionally with `TypeError: fetch failed` (network blip
  // / cold start collision) — observed on Reddit/TikTok/YouTube which
  // sit at the long end. Retry the POST 3× with exponential backoff
  // before giving up. AbortSignal kept generous so a successful slow
  // poll isn't cut short.
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(apiUrl('/api/scraping/fetch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, plan, language }),
        signal: AbortSignal.timeout(780_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          source,
          queries: [],
          items: [],
          itemCount: 0,
          fetchDurationMs: Date.now() - start,
          error: `new-stack ${source}: HTTP ${res.status} ${text.slice(0, 200)}`,
        };
      }
      const data = await res.json() as { ok: boolean; data?: RawSourceData; message?: string };
      if (!data.ok || !data.data) {
        return {
          source,
          queries: [],
          items: [],
          itemCount: 0,
          fetchDurationMs: Date.now() - start,
          error: `new-stack ${source}: ${data.message ?? 'unknown error'}`,
        };
      }
      return data.data;
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = 1500 * 2 ** (attempt - 1);
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
  }
  return {
    source,
    queries: [],
    items: [],
    itemCount: 0,
    fetchDurationMs: Date.now() - start,
    error: lastErr instanceof Error ? `${lastErr.message} (after ${MAX_ATTEMPTS} attempts)` : String(lastErr),
  };
}
