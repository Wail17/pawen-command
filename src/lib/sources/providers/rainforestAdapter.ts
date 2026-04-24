// ============================================================
// PAWEN — Phase U.4 — Rainforest API adapter (ecom, Amazon)
//
// https://www.rainforestapi.com — pay-per-request Amazon scraper.
// Covers amazon.com / .es / .de / .it / .co.uk / .fr / etc.
// Returns products + full review pagination (up to 500 reviews).
//
// Env: RAINFOREST_API_KEY
// ============================================================

import 'server-only';
import type { EcomProvider, EcomResult, EcomFetchOptions, EcomReview, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

interface RainforestSearchProduct {
  asin?: string;
  title?: string;
  link?: string;
  rating?: number;
  ratings_total?: number;
  price?: { value?: number; currency?: string };
  image?: string;
}

interface RainforestReview {
  id?: string;
  title?: string;
  body?: string;
  rating?: number;
  date?: { utc?: string };
  profile?: { name?: string };
  verified_purchase?: boolean;
}

function tldFromMarketplace(marketplace: string | undefined): string {
  const m = (marketplace ?? 'amazon.com').toLowerCase();
  if (m.includes('amazon.es')) return 'amazon.es';
  if (m.includes('amazon.fr')) return 'amazon.fr';
  if (m.includes('amazon.de')) return 'amazon.de';
  if (m.includes('amazon.it')) return 'amazon.it';
  if (m.includes('amazon.co.uk') || m.includes('amazon.uk')) return 'amazon.co.uk';
  if (m.includes('amazon.ca')) return 'amazon.ca';
  if (m.includes('amazon.co.jp')) return 'amazon.co.jp';
  if (m.includes('amazon.com.mx')) return 'amazon.com.mx';
  if (m.includes('amazon.com.br')) return 'amazon.com.br';
  return 'amazon.com';
}

export class RainforestAdapter implements EcomProvider {
  id = 'rainforest';
  priority = 1;
  supports: EcomFetchOptions['platform'][] = ['amazon'];

  async fetch(query: string, opts: EcomFetchOptions): Promise<EcomResult[]> {
    if (opts.platform !== 'amazon') return [];
    const key = requireEnv('RAINFOREST_API_KEY');
    if (!key) throw new ProviderError('RAINFOREST_API_KEY not configured', this.id);

    const domain = tldFromMarketplace(opts.marketplace);
    const maxProducts = Math.min(opts.maxProducts ?? 8, 20);
    const maxReviews = opts.maxReviewsPerProduct ?? 50;

    // 1. Search products
    const searchParams = new URLSearchParams({
      api_key: key,
      type: 'search',
      amazon_domain: domain,
      search_term: query,
    });
    const searchRes = await fetchWithTimeout(`https://api.rainforestapi.com/request?${searchParams.toString()}`, {
      method: 'GET', timeoutMs: 45_000,
    });
    if (!searchRes) throw new ProviderError('Rainforest network failure', this.id, undefined, true);
    if (!searchRes.ok) {
      const text = await searchRes.text().catch(() => '');
      throw new ProviderError(`Rainforest search ${searchRes.status}: ${text.slice(0, 200)}`, this.id, searchRes.status, searchRes.status >= 500);
    }
    const searchData = await searchRes.json() as { search_results?: RainforestSearchProduct[] };
    const products = (searchData.search_results ?? [])
      .filter(p => p.asin && p.link)
      .sort((a, b) => (b.ratings_total ?? 0) - (a.ratings_total ?? 0))
      .slice(0, maxProducts);

    // 2. Fetch reviews for each product
    const results: EcomResult[] = [];
    for (const p of products) {
      const reviews: EcomReview[] = [];
      try {
        const rvParams = new URLSearchParams({
          api_key: key,
          type: 'reviews',
          amazon_domain: domain,
          asin: p.asin!,
          sort_by: 'most_helpful',
          max_page: String(Math.ceil(maxReviews / 10)),
        });
        const rRes = await fetchWithTimeout(`https://api.rainforestapi.com/request?${rvParams.toString()}`, {
          method: 'GET', timeoutMs: 45_000,
        });
        if (rRes && rRes.ok) {
          const rData = await rRes.json() as { reviews?: RainforestReview[] };
          for (const r of (rData.reviews ?? []).slice(0, maxReviews)) {
            if (!r.body) continue;
            reviews.push({
              author: r.profile?.name,
              rating: r.rating,
              title: r.title,
              body: r.body,
              date: r.date?.utc,
              verified: r.verified_purchase,
            });
          }
        }
      } catch { /* continue with next product */ }

      results.push({
        url: p.link!,
        title: p.title,
        content: [p.title, `Rating: ${p.rating ?? '?'}/5 (${p.ratings_total ?? 0} reviews)`].join('\n'),
        platform: 'amazon',
        productId: p.asin,
        price: p.price?.value,
        currency: p.price?.currency,
        rating: p.rating,
        reviewCount: p.ratings_total,
        reviews,
        marketplace: domain,
        metadata: { image: p.image },
        fetchedAt: nowIso(),
        providerId: this.id,
      });
    }
    return results;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return missingEnvHealth(this.id, 'RAINFOREST_API_KEY');
  }
}
