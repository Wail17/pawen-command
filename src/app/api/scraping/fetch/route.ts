// ============================================================
// PAWEN — /api/scraping/fetch   (Phase U.4.3)
//
// Unified server-side entry for the new provider-backed scraping stack.
// Called by the legacy fetchers in src/lib/sources/*.ts when the
// USE_NEW_SCRAPING_STACK flag is on. Dispatches on `source` to the
// right wrapper in src/lib/sources/providers/fetchWrappers.ts.
//
// POST body: { source: 'reddit'|..., plan: <SourceDiscoveryPlan subset>, language: string }
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import {
  fetchRedditViaProviders, fetchQuoraViaProviders, fetchYoutubeViaProviders,
  fetchTikTokViaProviders, fetchAmazonViaProviders, fetchShopifyViaProviders,
} from '@/lib/sources/providers/fetchWrappers';
import { recordHealth } from '@/lib/sources/scrapingHealth';

// Reddit posts (270s BD poll) + Reddit comments (270s BD poll) = up to
// 540s per source call. Amazon search + reviews can also peak around
// 540s. Setting 800s (Pro plan ceiling) so a single source's BD work
// never gets cut off mid-poll.
export const maxDuration = 800;

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body: { source?: string; plan?: Record<string, unknown>; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const { source, plan, language } = body;
  if (!source || !plan) {
    return NextResponse.json({ ok: false, message: 'source + plan required' }, { status: 400 });
  }
  const lang = language ?? 'en-US';

  try {
    let data;
    switch (source) {
      case 'reddit':
        data = await fetchRedditViaProviders(plan as Parameters<typeof fetchRedditViaProviders>[0], lang);
        break;
      case 'quora':
        data = await fetchQuoraViaProviders(plan as Parameters<typeof fetchQuoraViaProviders>[0], lang);
        break;
      case 'youtube':
        data = await fetchYoutubeViaProviders(plan as Parameters<typeof fetchYoutubeViaProviders>[0], lang);
        break;
      case 'tiktok':
        data = await fetchTikTokViaProviders(plan as Parameters<typeof fetchTikTokViaProviders>[0], lang);
        break;
      case 'amazon':
        data = await fetchAmazonViaProviders(plan as Parameters<typeof fetchAmazonViaProviders>[0]);
        break;
      case 'shopify':
        data = await fetchShopifyViaProviders(plan as Parameters<typeof fetchShopifyViaProviders>[0]);
        break;
      default:
        return NextResponse.json({ ok: false, message: `Unknown source: ${source}` }, { status: 400 });
    }
    void recordHealth({
      source,
      success: data.itemCount > 0 && !data.error,
      latencyMs: data.fetchDurationMs,
      items: data.itemCount,
      errorMessage: data.error,
    });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
