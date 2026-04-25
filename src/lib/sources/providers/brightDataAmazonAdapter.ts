// ============================================================
// PAWEN — Bright Data Amazon adapter (replaces Rainforest)
// Env: BRIGHTDATA_API_KEY,
//      BRIGHTDATA_DATASET_ID_AMAZON_SEARCH,
//      BRIGHTDATA_DATASET_ID_AMAZON_PRODUCTS,
//      BRIGHTDATA_DATASET_ID_AMAZON_REVIEWS
// ============================================================

import 'server-only';
import type { EcomProvider, EcomResult, EcomFetchOptions, EcomReview, ProviderHealth } from './types';
import { brightDataCollect, brightDataHealth, BD_NOW } from './brightDataCommon';
import { requireEnv } from './common';

interface AmazonSearchRow {
  asin?: string;
  url?: string;
  title?: string;
  rating?: number;
  reviews_count?: number;
  ratings_total?: number;
  price?: number | string;
  currency?: string;
  image?: string;
}
interface AmazonReviewRow {
  parent_url?: string;
  asin?: string;
  title?: string;
  body?: string;
  text?: string;
  rating?: number;
  author?: string;
  reviewer_name?: string;
  date?: string;
  review_date?: string;
  verified_purchase?: boolean;
  is_verified?: boolean;
}

const SEARCH_DEFAULT = 'gd_lwdb4vjm1ehb499uxs';
const REVIEWS_DEFAULT = 'gd_le8e811kzy4ggddlq';
// const PRODUCTS_DEFAULT = 'gd_l7q7dkf244hwjntr0'; // reserved for ASIN-direct lookups

function tldFromMarketplace(marketplace: string | undefined): string {
  const m = (marketplace ?? 'amazon.com').toLowerCase();
  const known = ['amazon.es','amazon.fr','amazon.de','amazon.it','amazon.co.uk','amazon.ca','amazon.co.jp','amazon.com.mx','amazon.com.br'];
  return known.find(k => m.includes(k)) ?? 'amazon.com';
}

export class BrightDataAmazonAdapter implements EcomProvider {
  id = 'brightdata-amazon';
  priority = 1;
  supports: EcomFetchOptions['platform'][] = ['amazon'];

  async fetch(query: string, opts: EcomFetchOptions): Promise<EcomResult[]> {
    if (opts.platform !== 'amazon') return [];
    const searchId = requireEnv('BRIGHTDATA_DATASET_ID_AMAZON_SEARCH') ?? SEARCH_DEFAULT;
    const domain = tldFromMarketplace(opts.marketplace);
    const maxProducts = Math.min(opts.maxProducts ?? 8, 20);
    const maxReviews = opts.maxReviewsPerProduct ?? 50;

    // Bright Data Amazon SEARCH dataset only accepts url_collection — we
    // pass an Amazon search URL directly and the dataset scrapes it.
    // Amazon search dataset wants both `url` (the search page) AND `keyword`
    // (used for parsing context). Both required, even though it's url_collection.
    const searchUrl = `https://${domain}/s?k=${encodeURIComponent(query)}`;
    const searchInputs = [{ url: searchUrl, keyword: query }];
    const searchRows = await brightDataCollect<AmazonSearchRow>({
      providerId: this.id,
      datasetId: searchId,
      inputs: searchInputs,
      type: 'url_collection',
    });

    const products = searchRows
      .filter(r => r.asin && r.url)
      .sort((a, b) => (b.ratings_total ?? b.reviews_count ?? 0) - (a.ratings_total ?? a.reviews_count ?? 0))
      .slice(0, maxProducts);

    // Step 2: reviews per product
    const results: EcomResult[] = [];
    if (products.length > 0) {
      const reviewsId = requireEnv('BRIGHTDATA_DATASET_ID_AMAZON_REVIEWS') ?? REVIEWS_DEFAULT;
      try {
        const rInputs = products.map(p => ({ url: p.url, num_of_reviews: maxReviews }));
        const reviewRows = await brightDataCollect<AmazonReviewRow>({
          providerId: this.id,
          datasetId: reviewsId,
          inputs: rInputs,
          discoverBy: 'product_url',
        });
        // Group by ASIN
        const byAsin = new Map<string, AmazonReviewRow[]>();
        for (const rv of reviewRows) {
          const key = rv.asin ?? rv.parent_url ?? '';
          if (!key) continue;
          const arr = byAsin.get(key) ?? [];
          arr.push(rv);
          byAsin.set(key, arr);
        }
        for (const p of products) {
          const matched = byAsin.get(p.asin ?? '') ?? byAsin.get(p.url ?? '') ?? [];
          const reviews: EcomReview[] = matched.slice(0, maxReviews)
            .filter(r => r.body || r.text)
            .map(r => ({
              author: r.author ?? r.reviewer_name,
              rating: r.rating,
              title: r.title,
              body: (r.body ?? r.text ?? '').slice(0, 4000),
              date: r.date ?? r.review_date,
              verified: r.verified_purchase ?? r.is_verified,
            }));
          results.push({
            url: p.url!,
            title: p.title,
            content: [p.title, `Rating: ${p.rating ?? '?'}/5 (${p.ratings_total ?? p.reviews_count ?? 0} reviews)`].join('\n'),
            platform: 'amazon',
            productId: p.asin,
            price: p.price,
            currency: p.currency,
            rating: p.rating,
            reviewCount: p.ratings_total ?? p.reviews_count,
            reviews,
            marketplace: domain,
            metadata: { image: p.image },
            fetchedAt: BD_NOW(),
            providerId: this.id,
          });
        }
      } catch {
        // No reviews — still return product metadata
        for (const p of products) {
          results.push({
            url: p.url!,
            title: p.title,
            content: p.title ?? '',
            platform: 'amazon',
            productId: p.asin,
            price: p.price,
            currency: p.currency,
            rating: p.rating,
            reviewCount: p.ratings_total ?? p.reviews_count,
            reviews: [],
            marketplace: domain,
            metadata: { image: p.image },
            fetchedAt: BD_NOW(),
            providerId: this.id,
          });
        }
      }
    }

    return results;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}
