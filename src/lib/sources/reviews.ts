// ============================================================
// PAWEN — Review Sites Source Fetcher
// Strategy: Trustpilot / Sitejabber / ProductReview + Firecrawl scrape.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { scrapeMany, webSearch, toRawItem, languageModifier } from './common';

const DEFAULT_REVIEW_SITES = [
  'trustpilot.com',
  'sitejabber.com',
  'productreview.com.au',
  'reviews.io',
  'g2.com',
];

export interface ReviewsFetchOptions {
  maxPages?: number;      // default 8
}

export async function fetchReviews(
  plan: SourceDiscoveryPlan['reviews'],
  language: string,
  options: ReviewsFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();
  const maxPages = options.maxPages ?? 8;
  const langMod = languageModifier(language);
  const queries = plan.queries.slice(0, 4);
  const sites = plan.sites.length > 0 ? plan.sites : DEFAULT_REVIEW_SITES;

  const urls = new Set<string>();
  const queriesUsed: string[] = [];

  for (const site of sites.slice(0, 5)) {
    for (const q of queries.slice(0, 2)) {
      const searchQuery = `site:${site} ${q} ${langMod}`.trim();
      queriesUsed.push(searchQuery);

      const result = await webSearch(searchQuery, { maxResults: 5 });
      if (!result) continue;

      for (const r of result.results) {
        if (r.url.includes(site)) {
          urls.add(r.url);
        }
      }
    }
  }

  const urlList = Array.from(urls).slice(0, maxPages);
  const scraped = await scrapeMany(urlList, 4);

  const items = scraped.map(page =>
    toRawItem('reviews', page.url, page.markdown, {
      title: (page.metadata.title as string) ?? undefined,
      metadata: page.metadata,
    }),
  );

  return {
    source: 'reviews',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
  };
}
