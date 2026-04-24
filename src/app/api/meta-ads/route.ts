// ============================================================
// PAWEN — /api/meta-ads   (Phase U.4.4 — rewritten)
//
// Uses Meta Graph /ads_archive directly (MetaGraphAdapter) when
// META_ACCESS_TOKEN is set AND (USE_NEW_SCRAPING_STACK=1 OR the
// Tavily key is missing). Otherwise falls back to the legacy
// Tavily-wrapper shim for backward compatibility.
//
// Response keeps the legacy `{ ads: [...] }` shape to avoid breaking
// any existing caller. New consumers may read `raw: [...]` for the
// full structured MetaAdResult shape.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { metaGraphAdapter } from '@/lib/sources/providers/metaGraphAdapter';
import { isNewScrapingStackEnabled } from '@/lib/learning/autonomousMode';

export const maxDuration = 60;

// Legacy shape preserved for back-compat.
interface LegacyAdShape {
  advertiser: string;
  headline: string;
  body: string;
  cta: string;
  platform: string;
  url: string;
  startDate?: string;
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const { query, niche, country, limit } = await req.json();
    if (!query) {
      return NextResponse.json({ ok: false, error: 'query is required' }, { status: 400 });
    }

    const metaToken = process.env.META_ACCESS_TOKEN;
    const tavilyKey = process.env.TAVILY_API_KEY;

    // Prefer Meta Graph when the token is present. Fall back to Tavily
    // ONLY when the token is missing AND legacy mode is explicitly in use.
    const preferGraph = !!metaToken && (isNewScrapingStackEnabled() || !tavilyKey);

    if (preferGraph) {
      const countries = country ? [String(country).toUpperCase().slice(0, 2)] : undefined;
      const rows = await metaGraphAdapter.fetch({
        searchTerms: [query, niche].filter(Boolean).join(' ').slice(0, 200),
        countries,
        activeStatus: 'ACTIVE',
        limit: Math.min(Number(limit) || 100, 500),
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        return { __err: msg } as unknown;
      });

      if (rows && typeof rows === 'object' && '__err' in rows) {
        return NextResponse.json(
          { ok: false, ads: [], error: (rows as { __err: string }).__err, source: 'meta-graph' },
          { status: 502 },
        );
      }

      const raw = rows as Awaited<ReturnType<typeof metaGraphAdapter.fetch>>;
      const ads: LegacyAdShape[] = raw.map(r => ({
        advertiser: r.pageName,
        headline: r.adCreativeLinkTitles[0] ?? r.adCreativeBodies[0]?.slice(0, 120) ?? '',
        body: r.adCreativeBodies[0] ?? '',
        cta: r.adCreativeLinkCaptions?.[0] ?? 'Learn More',
        platform: (r.publisherPlatforms ?? ['facebook'])[0] ?? 'facebook',
        url: r.snapshotUrl ?? '',
        startDate: r.adDeliveryStartTime,
      }));
      return NextResponse.json({
        ok: true,
        ads,
        raw,
        query,
        totalFound: ads.length,
        source: 'meta-graph',
      });
    }

    // --- Legacy Tavily fallback (kept for back-compat when META_ACCESS_TOKEN missing) ---
    if (!tavilyKey) {
      return NextResponse.json({ ok: false, ads: [], error: 'Neither META_ACCESS_TOKEN nor TAVILY_API_KEY is configured', source: 'none' }, { status: 500 });
    }

    const searchQueries = [
      `site:facebook.com/ads/library ${query} ${niche || ''}`,
      `Meta ads "${query}" ${niche || ''} ad copy example`,
    ];
    const all: LegacyAdShape[] = [];
    for (const sq of searchQueries.slice(0, 2)) {
      try {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: sq,
            max_results: Number(limit) || 10,
            include_raw_content: true,
            search_depth: 'advanced',
          }),
        });
        if (!r.ok) continue;
        const data = await r.json() as { results?: Array<{ url?: string; title?: string; content?: string; raw_content?: string }> };
        for (const row of data.results ?? []) {
          const content = row.raw_content || row.content || '';
          if (content.length < 50) continue;
          all.push({
            advertiser: row.title?.split('—')[0]?.slice(0, 40) ?? 'Unknown',
            headline: row.title ?? '',
            body: content.slice(0, 400),
            cta: 'Learn More',
            platform: 'facebook',
            url: row.url ?? '',
          });
        }
      } catch { /* continue */ }
    }
    return NextResponse.json({
      ok: true,
      ads: all.slice(0, Number(limit) || 20),
      query,
      totalFound: all.length,
      source: 'tavily-fallback',
      note: 'Using Tavily fallback. Add META_ACCESS_TOKEN and enable USE_NEW_SCRAPING_STACK for higher-quality structured ads.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, ads: [], error: msg }, { status: 500 });
  }
}
