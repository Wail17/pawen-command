// ============================================================
// PAWEN — Amazon Source Fetcher (v2 — Apify-first)
//
// Strategy:
//   1. Primary: /api/amazon-reviews → Apify product search +
//      REAL paginated reviews (50-100 per product, verified).
//   2. Fallback: Tavily + Firecrawl for product page snippets
//      (shallow, only 3-5 visible reviews).
//
// Reviews are the #1 source of customer language for e-commerce.
// Each review becomes a verbatim in the analyzer pipeline.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { scrapeMany, webSearch, toRawItem } from './common';
import { apiUrl } from '../util/apiBaseUrl';

export interface AmazonFetchOptions {
  maxProducts?: number;     // default 8
  maxReviewsPerProduct?: number; // default 50
}

interface AmazonProduct {
  url: string;
  title: string;
  rating: number;
  reviewCount: number;
  price: number | null;
  currency: string;
  asin: string;
  thumbnail: string;
}

interface AmazonReview {
  title: string;
  text: string;
  rating: number;
  author: string;
  date: string;
  verified: boolean;
}

async function searchProducts(
  query: string,
  marketplace: string,
  maxProducts: number,
): Promise<AmazonProduct[]> {
  try {
    const res = await fetch(apiUrl('/api/amazon-reviews'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'search', query, marketplace, maxProducts }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.products) ? data.products : [];
  } catch {
    return [];
  }
}

async function fetchReviews(
  productUrls: string[],
  maxReviews: number,
): Promise<AmazonReview[]> {
  try {
    const res = await fetch(apiUrl('/api/amazon-reviews'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'reviews', productUrls, maxReviews }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.reviews) ? data.reviews : [];
  } catch {
    return [];
  }
}

function renderProductWithReviews(
  product: AmazonProduct,
  reviews: AmazonReview[],
): string {
  const head = [
    `PRODUCT: ${product.title}`,
    `RATING: ${product.rating}/5 (${product.reviewCount} reviews)`,
    product.price ? `PRICE: ${product.currency} ${product.price}` : '',
    `URL: ${product.url}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (reviews.length === 0) return head;

  const reviewLines = reviews.map((r) => {
    const stars = '★'.repeat(Math.round(r.rating)) + '☆'.repeat(5 - Math.round(r.rating));
    const verified = r.verified ? ' [VERIFIED]' : '';
    return `${stars}${verified} "${r.title}"\n${r.text}\n— ${r.author}${r.date ? `, ${r.date}` : ''}`;
  });

  return `${head}\n\n--- REVIEWS (${reviews.length}) ---\n\n${reviewLines.join('\n\n')}`;
}

export async function fetchAmazon(
  plan: SourceDiscoveryPlan['amazon'],
  options: AmazonFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();
  const maxProducts = options.maxProducts ?? 8;
  const maxReviewsPerProduct = options.maxReviewsPerProduct ?? 50;
  const marketplace = plan.marketplace || 'amazon.com';
  const queries = plan.product_queries.slice(0, 4);
  const queriesUsed: string[] = [];

  // ============================================================
  // PRIMARY PATH — Apify (real reviews)
  // ============================================================

  // Step 1: Search for products
  const allProducts = new Map<string, AmazonProduct>();

  for (const q of queries) {
    queriesUsed.push(q);
    const products = await searchProducts(q, marketplace, Math.ceil(maxProducts / queries.length) + 2);
    for (const p of products) {
      if (p.asin && !allProducts.has(p.asin)) {
        allProducts.set(p.asin, p);
      }
    }
  }

  const productList = Array.from(allProducts.values())
    .sort((a, b) => b.reviewCount - a.reviewCount) // prioritize most-reviewed
    .slice(0, maxProducts);

  if (productList.length > 0) {
    // Step 2: Fetch real reviews for top products
    const productUrls = productList.map((p) => p.url);
    const allReviews = await fetchReviews(productUrls, maxReviewsPerProduct);

    // Group reviews by product URL (best-effort matching via ASIN)
    const reviewsByAsin = new Map<string, AmazonReview[]>();
    // Apify returns reviews with product URL embedded — group them
    // Since we can't perfectly map review→product, we distribute evenly
    const reviewsPerProduct = Math.ceil(allReviews.length / Math.max(productList.length, 1));

    let reviewIdx = 0;
    for (const product of productList) {
      const chunk = allReviews.slice(reviewIdx, reviewIdx + reviewsPerProduct);
      reviewsByAsin.set(product.asin, chunk);
      reviewIdx += reviewsPerProduct;
    }

    const items = productList.map((product) => {
      const reviews = reviewsByAsin.get(product.asin) || [];
      const reviewTexts = reviews.map((r) => r.text);

      return toRawItem(
        'amazon',
        product.url,
        renderProductWithReviews(product, reviews),
        {
          title: product.title,
          comments: reviewTexts, // treated same as "comments" by analyzers
          metadata: {
            rating: product.rating,
            review_count: product.reviewCount,
            price: product.price,
            currency: product.currency,
            asin: product.asin,
            reviews_scraped: reviews.length,
            verified_count: reviews.filter((r) => r.verified).length,
            via: 'apify',
          },
        },
      );
    });

    return {
      source: 'amazon',
      queries: queriesUsed,
      items,
      itemCount: items.length,
      fetchDurationMs: Date.now() - start,
    };
  }

  // ============================================================
  // FALLBACK PATH — Tavily + Firecrawl (shallow page scrape)
  // ============================================================
  const productUrls = new Set<string>();

  for (const q of queries) {
    const searchQuery = `site:${marketplace} ${q}`;
    queriesUsed.push(`fallback: ${searchQuery}`);
    const result = await webSearch(searchQuery, { maxResults: 10 });
    if (!result) continue;
    for (const r of result.results) {
      if (r.url.includes(`${marketplace}/`) && /\/dp\/[A-Z0-9]{10}/.test(r.url)) {
        productUrls.add(r.url);
      }
    }
  }

  // Also search for review pages
  for (const q of queries.slice(0, 2)) {
    const reviewQuery = `site:${marketplace} ${q} reviews`;
    queriesUsed.push(`fallback: ${reviewQuery}`);
    const result = await webSearch(reviewQuery, { maxResults: 5 });
    if (!result) continue;
    for (const r of result.results) {
      if (r.url.includes('/product-reviews/') || r.url.includes('/dp/')) {
        productUrls.add(r.url);
      }
    }
  }

  const urlList = Array.from(productUrls).slice(0, maxProducts);
  const scraped = await scrapeMany(urlList, 3);

  const items = scraped.map((page) =>
    toRawItem('amazon', page.url, page.markdown, {
      title: (page.metadata.title as string) ?? undefined,
      metadata: { ...page.metadata, via: 'firecrawl-fallback' },
    }),
  );

  return {
    source: 'amazon',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
    error:
      items.length === 0
        ? 'Amazon: Apify unavailable (no APIFY_TOKEN?) and Firecrawl fallback returned nothing.'
        : undefined,
  };
}
