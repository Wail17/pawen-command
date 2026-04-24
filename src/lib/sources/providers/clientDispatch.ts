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
  try {
    const res = await fetch(apiUrl('/api/scraping/fetch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, plan, language }),
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
    return {
      source,
      queries: [],
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
