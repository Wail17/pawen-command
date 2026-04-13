// ============================================================
// PAWEN — Source Fetchers: Common Helpers
// Thin wrappers over /api/scrape (Firecrawl) and /api/search (Tavily).
// Client-only — these functions use relative URLs like runSubAgents.ts.
// ============================================================

import { RawSourceItem, SourceType } from '../avatars/types';

// === LOW-LEVEL API CALLS ===

export interface ScrapedPage {
  url: string;
  markdown: string;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  score?: number;
}

export interface WebSearchResponse {
  answer: string;
  results: SearchResult[];
  query: string;
}

/**
 * Scrape a URL via Firecrawl → clean markdown.
 * Fails gracefully: returns null instead of throwing.
 */
export async function scrapeUrl(url: string): Promise<ScrapedPage | null> {
  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      url: data.url ?? url,
      markdown: data.markdown ?? '',
      metadata: data.metadata ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Web search via Tavily.
 */
export async function webSearch(
  query: string,
  options: { maxResults?: number; searchDepth?: 'basic' | 'advanced' } = {},
): Promise<WebSearchResponse | null> {
  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        maxResults: options.maxResults ?? 10,
        searchDepth: options.searchDepth ?? 'advanced',
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      answer: data.answer ?? '',
      results: data.results ?? [],
      query,
    };
  } catch {
    return null;
  }
}

/**
 * Scrape many URLs in parallel with a concurrency limit.
 * Null results are filtered out.
 */
export async function scrapeMany(
  urls: string[],
  concurrency = 4,
): Promise<ScrapedPage[]> {
  const results: ScrapedPage[] = [];
  const queue = [...urls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      const page = await scrapeUrl(url);
      if (page && page.markdown.length > 200) {
        results.push(page);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, worker);
  await Promise.all(workers);
  return results;
}

// === LANGUAGE / MARKET HELPERS ===

/**
 * Returns a market-localized search modifier.
 * E.g. "fr-FR" → "in french", "es-ES" → "in spanish".
 */
export function languageModifier(language: string): string {
  const code = language.slice(0, 2).toLowerCase();
  const map: Record<string, string> = {
    fr: 'in french',
    es: 'in spanish',
    de: 'in german',
    it: 'in italian',
    pt: 'in portuguese',
    nl: 'in dutch',
    en: '',
    ja: 'in japanese',
    zh: 'in chinese',
    ko: 'in korean',
  };
  return map[code] ?? '';
}

/**
 * Returns the Amazon marketplace TLD for a given market.
 */
export function amazonMarketplace(market: string): string {
  const m = market.toLowerCase();
  if (m.includes('france') || m === 'fr') return 'amazon.fr';
  if (m.includes('spain') || m === 'es') return 'amazon.es';
  if (m.includes('germany') || m.includes('dach') || m === 'de') return 'amazon.de';
  if (m.includes('italy') || m === 'it') return 'amazon.it';
  if (m.includes('uk') || m.includes('united kingdom') || m === 'gb') return 'amazon.co.uk';
  if (m.includes('canada') || m === 'ca') return 'amazon.ca';
  if (m.includes('mexico') || m === 'mx') return 'amazon.com.mx';
  if (m.includes('brazil') || m === 'br') return 'amazon.com.br';
  if (m.includes('japan') || m === 'jp') return 'amazon.co.jp';
  return 'amazon.com';
}

// === RAW ITEM BUILDER ===

export function toRawItem(
  source: SourceType,
  url: string,
  content: string,
  extras: Partial<Omit<RawSourceItem, 'source' | 'url' | 'content'>> = {},
): RawSourceItem {
  return {
    source,
    url,
    content,
    title: extras.title,
    comments: extras.comments,
    metadata: extras.metadata,
  };
}
