// ============================================================
// PAWEN — Wide Web Search Source Fetcher
// Strategy: Unrestricted Tavily search — blogs, articles, "people also ask",
// Answer-The-Public-style discovery. Results are used as-is; we also
// scrape the top handful of article URLs for richer content.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { scrapeMany, webSearch, toRawItem, languageModifier } from './common';

export interface SearchWideFetchOptions {
  maxScrape?: number;     // default 15 (scrape top N result URLs)
}

export async function fetchSearchWide(
  plan: SourceDiscoveryPlan['searchWide'],
  language: string,
  options: SearchWideFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();
  const maxScrape = options.maxScrape ?? 15;
  const langMod = languageModifier(language);
  const queries = plan.queries.slice(0, 10);

  const queriesUsed: string[] = [];
  const topUrls: string[] = [];
  const snippets: string[] = [];

  for (const q of queries) {
    const searchQuery = `${q} ${langMod}`.trim();
    queriesUsed.push(searchQuery);

    const result = await webSearch(searchQuery, { maxResults: 10 });
    if (!result) continue;

    if (result.answer) snippets.push(`Q: ${q}\nA: ${result.answer}`);

    for (const r of result.results) {
      // Skip already-covered platforms to avoid double-dipping
      if (
        /reddit\.com|amazon\.|youtube\.com|tiktok\.com|quora\.com|trustpilot\.com/.test(r.url)
      ) continue;

      snippets.push(`[${r.title}](${r.url})\n${r.content}`);
      topUrls.push(r.url);
    }
  }

  // Scrape top N unique URLs
  const uniqueUrls = Array.from(new Set(topUrls)).slice(0, maxScrape);
  const scraped = await scrapeMany(uniqueUrls, 4);

  const items = [
    // Lightweight item built from search snippets (no scrape needed)
    toRawItem('searchWide', 'search://snippets', snippets.join('\n\n---\n\n'), {
      title: 'Aggregated search snippets',
    }),
    // Plus scraped articles
    ...scraped.map(page =>
      toRawItem('searchWide', page.url, page.markdown, {
        title: (page.metadata.title as string) ?? undefined,
        metadata: page.metadata,
      }),
    ),
  ];

  return {
    source: 'searchWide',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
  };
}
