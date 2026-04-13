// ============================================================
// PAWEN — Quora Source Fetcher
// Strategy: Tavily `site:quora.com` + Firecrawl scrape top threads.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { scrapeMany, webSearch, toRawItem, languageModifier } from './common';

export interface QuoraFetchOptions {
  maxThreads?: number;    // default 20
}

export async function fetchQuora(
  plan: SourceDiscoveryPlan['quora'],
  language: string,
  options: QuoraFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();
  const maxThreads = options.maxThreads ?? 20;
  const langMod = languageModifier(language);
  const queries = plan.queries.slice(0, 8);

  const urls = new Set<string>();
  const queriesUsed: string[] = [];

  for (const q of queries) {
    const searchQuery = `site:quora.com ${q} ${langMod}`.trim();
    queriesUsed.push(searchQuery);

    const result = await webSearch(searchQuery, { maxResults: 10 });
    if (!result) continue;

    for (const r of result.results) {
      if (r.url.includes('quora.com/') && !r.url.includes('/profile/')) {
        urls.add(r.url);
      }
    }
  }

  const urlList = Array.from(urls).slice(0, maxThreads);
  const scraped = await scrapeMany(urlList, 4);

  const items = scraped.map(page =>
    toRawItem('quora', page.url, page.markdown, {
      title: (page.metadata.title as string) ?? undefined,
      metadata: page.metadata,
    }),
  );

  return {
    source: 'quora',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
  };
}
