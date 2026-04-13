// ============================================================
// PAWEN — Niche Forums Source Fetcher
// Strategy: Tavily search against domains identified in the discovery plan,
// or broad forum-style searches when no domain is provided.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { scrapeMany, webSearch, toRawItem, languageModifier } from './common';

export interface ForumsFetchOptions {
  maxThreads?: number;    // default 25
}

export async function fetchForums(
  plan: SourceDiscoveryPlan['forums'],
  language: string,
  options: ForumsFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();
  const maxThreads = options.maxThreads ?? 25;
  const langMod = languageModifier(language);
  const queries = plan.queries.slice(0, 6);
  const domains = plan.domains.slice(0, 10);

  const urls = new Set<string>();
  const queriesUsed: string[] = [];

  // 1. Per domain + query: targeted searches
  if (domains.length > 0) {
    for (const domain of domains) {
      for (const q of queries.slice(0, 3)) {
        const searchQuery = `site:${domain} ${q} ${langMod}`.trim();
        queriesUsed.push(searchQuery);

        const result = await webSearch(searchQuery, { maxResults: 8 });
        if (!result) continue;

        for (const r of result.results) {
          if (r.url.includes(domain)) {
            urls.add(r.url);
          }
        }
      }
    }
  }

  // 2. Generic "forum" search as supplement
  for (const q of queries.slice(0, 4)) {
    const searchQuery = `${q} forum discussion ${langMod}`.trim();
    queriesUsed.push(searchQuery);

    const result = await webSearch(searchQuery, { maxResults: 8 });
    if (!result) continue;

    for (const r of result.results) {
      const u = r.url;
      // Heuristic: forum-like URL shapes
      if (
        /forum|viewtopic|thread|\/t\//.test(u) ||
        u.includes('phpbb') ||
        u.includes('vbulletin')
      ) {
        urls.add(u);
      }
    }
  }

  const urlList = Array.from(urls).slice(0, maxThreads);
  const scraped = await scrapeMany(urlList, 4);

  const items = scraped.map(page =>
    toRawItem('forums', page.url, page.markdown, {
      title: (page.metadata.title as string) ?? undefined,
      metadata: page.metadata,
    }),
  );

  return {
    source: 'forums',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
  };
}
