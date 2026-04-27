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
  // Confirmed schema from live Bright Data probe (2026-04-26):
  asin?: string;
  url?: string;
  name?: string;              // product title (NOT `title`)
  brand?: string;
  rating?: number;
  num_ratings?: number;       // review count (NOT `reviews_count` / `ratings_total`)
  initial_price?: number | string;
  final_price?: number | string;  // current price (NOT `price`)
  currency?: string;
  image?: string;
  is_prime?: boolean;
  sold?: string;              // "1k+ bought past month"
  bought_past_month?: string;
  rank_on_page?: number;
  sponsored?: boolean;
}
interface AmazonReviewRow {
  // Confirmed schema from live Bright Data probe (2026-04-25):
  url?: string;              // input URL (the product page we asked about)
  asin?: string;
  product_name?: string;
  product_rating?: number;
  product_rating_count?: number;
  rating?: number;            // this review's rating
  review_header?: string;     // review title
  review_text?: string;       // review body — the gold
  review_id?: string;
  author_name?: string;
  author_id?: string;
  badge?: string;             // "Verified Purchase" etc.
  review_posted_date?: string;
  review_country?: string;
  helpful_count?: number;
  is_amazon_vine?: boolean;
  is_verified?: boolean;
  variant_name?: string;
}

const SEARCH_DEFAULT = 'gd_lwdb4vjm1ehb499uxs';
const REVIEWS_DEFAULT = 'gd_le8e811kzy4ggddlq';
// const PRODUCTS_DEFAULT = 'gd_l7q7dkf244hwjntr0'; // reserved for ASIN-direct lookups

function buildProductOnly(p: AmazonSearchRow, domain: string, providerId: string): EcomResult {
  return {
    url: p.url!,
    title: p.name,
    content: [p.name, `Rating: ${p.rating ?? '?'}/5 (${p.num_ratings ?? 0} reviews)`].filter(Boolean).join('\n'),
    platform: 'amazon',
    productId: p.asin,
    price: p.final_price ?? p.initial_price,
    currency: p.currency,
    rating: p.rating,
    reviewCount: p.num_ratings,
    reviews: [],
    marketplace: domain,
    metadata: { image: p.image, brand: p.brand },
    fetchedAt: BD_NOW(),
    providerId,
  };
}

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
      // Cap BD-side: scrape only the top N products from the search results
      // page. Without this, BD returns the full page (~320 products per query)
      // and we get billed for all of them despite only keeping `maxProducts`.
      limitPerInput: maxProducts,
    });

    // HARD BUDGET CAPS for Amazon reviews — same dataset that returned 404
    // reviews for one Echo Dot URL. Mega-products (>1k reviews) are exactly
    // the ones that explode the bill. Skip them; product metadata still
    // lands in `products` from the search dataset.
    //   - Cap to top 4 products by popularity (was 8)
    //   - Drop products with reviews_count > 1000 to avoid mega-haul
    //   - Kill switch via BRIGHTDATA_DISABLE_AMAZON_REVIEWS=1
    const PRODUCT_REVIEW_HARDCAP = 1000;
    const products = searchRows
      .filter(r => r.asin && r.url)
      .sort((a, b) => (b.num_ratings ?? 0) - (a.num_ratings ?? 0))
      .slice(0, maxProducts);

    const reviewableProducts = products.filter(
      p => (p.num_ratings ?? 0) <= PRODUCT_REVIEW_HARDCAP,
    ).slice(0, 4);

    // Step 2: reviews per product
    const results: EcomResult[] = [];
    const fetchReviews = process.env.BRIGHTDATA_DISABLE_AMAZON_REVIEWS !== '1' && reviewableProducts.length > 0;
    if (fetchReviews) {
      const reviewsId = requireEnv('BRIGHTDATA_DATASET_ID_AMAZON_REVIEWS') ?? REVIEWS_DEFAULT;
      try {
        const rInputs = reviewableProducts.map(p => ({ url: p.url }));
        const reviewRows = await brightDataCollect<AmazonReviewRow>({
          providerId: this.id,
          datasetId: reviewsId,
          inputs: rInputs,
          type: 'url_collection',
          // Cap reviews per product BD-side, not after billing.
          limitPerInput: maxReviews,
        });
        const estCost = (reviewRows.length / 1000) * 1.5;
        console.log(`[brightdata-amazon] reviews: ${reviewRows.length} rows for ${reviewableProducts.length}/${products.length} products (~$${estCost.toFixed(3)} BD cost)`);
        if (reviewRows.length > 5000) {
          console.warn(`[brightdata-amazon] WARN: ${reviewRows.length} review rows is unusually high — investigate filter`);
        }
        // Group by ASIN (preferred) with URL fallback
        const byAsin = new Map<string, AmazonReviewRow[]>();
        const byUrl = new Map<string, AmazonReviewRow[]>();
        for (const rv of reviewRows) {
          if (rv.asin) {
            const arr = byAsin.get(rv.asin) ?? [];
            arr.push(rv);
            byAsin.set(rv.asin, arr);
          }
          if (rv.url) {
            const arr = byUrl.get(rv.url) ?? [];
            arr.push(rv);
            byUrl.set(rv.url, arr);
          }
        }
        for (const p of products) {
          const matched = byAsin.get(p.asin ?? '') ?? byUrl.get(p.url ?? '') ?? [];
          const reviews: EcomReview[] = matched.slice(0, maxReviews)
            .filter(r => r.review_text)
            .map(r => ({
              author: r.author_name,
              rating: r.rating,
              title: r.review_header,
              body: (r.review_text ?? '').slice(0, 4000),
              date: r.review_posted_date,
              verified: r.is_verified ?? r.badge?.toLowerCase().includes('verified'),
            }));
          results.push({
            url: p.url!,
            title: p.name,
            content: [p.name, `Rating: ${p.rating ?? '?'}/5 (${p.num_ratings ?? 0} reviews)`].join('\n'),
            platform: 'amazon',
            productId: p.asin,
            price: p.final_price ?? p.initial_price,
            currency: p.currency,
            rating: p.rating,
            reviewCount: p.num_ratings,
            reviews,
            marketplace: domain,
            metadata: { image: p.image, brand: p.brand },
            fetchedAt: BD_NOW(),
            providerId: this.id,
          });
        }
      } catch (e) {
        console.error(`[brightdata-amazon] reviews fetch error: ${e instanceof Error ? e.message : String(e)}`);
        results.length = 0;
        for (const p of products) results.push(buildProductOnly(p, domain, this.id));
      }
    } else if (products.length > 0) {
      // Reviews skipped (kill switch on, or all products too large) — still
      // return product metadata so the search dataset cost isn't wasted.
      console.log(`[brightdata-amazon] reviews skipped (disabled or all products > ${PRODUCT_REVIEW_HARDCAP} reviews); returning ${products.length} products without reviews`);
      for (const p of products) results.push(buildProductOnly(p, domain, this.id));
    }

    return results;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}
