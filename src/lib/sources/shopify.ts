// ============================================================
// PAWEN — Shopify Source Fetcher
//
// Strategy:
// 1. If product URL provided → fetch product data + reviews via /api/shopify
// 2. If competitor store URLs from discovery plan → fetch their catalogs + reviews
// 3. Fallback: Tavily search for competitor Shopify stores + scrape
//
// All fetched data (product descriptions, reviews, Q&A) becomes
// RawSourceItems for the avatar excavation pipeline.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { toRawItem, webSearch, scrapeUrl } from './common';
import { apiUrl } from '../util/apiBaseUrl';

export interface ShopifyFetchOptions {
  maxProducts?: number;      // default 20
  maxReviewsPerProduct?: number; // default 30
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  image: string | null;
  price: string | null;
  compareAtPrice: string | null;
}

export interface ShopifyReview {
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
}

// === URL HELPERS (client-side, no fetch) ===

export function isShopifyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes('myshopify.com') ||
      u.pathname.includes('/products/') ||
      u.pathname.includes('/collections/')
    );
  } catch {
    return false;
  }
}

export function parseShopifyUrl(url: string): { domain: string; handle: string | null } | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/products\/([a-zA-Z0-9\-_]+)/);
    return { domain: u.origin, handle: match ? match[1] : null };
  } catch {
    return null;
  }
}

// === MAIN FETCHER ===

export async function fetchShopify(
  plan: SourceDiscoveryPlan['shopify'],
  language: string,
  options: ShopifyFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();
  const maxProducts = options.maxProducts ?? 20;
  const items: ReturnType<typeof toRawItem>[] = [];
  const queriesUsed: string[] = [];

  // ── Step 1: Fetch products + reviews from known store URLs ──
  for (const storeUrl of (plan.store_urls ?? []).slice(0, 5)) {
    try {
      const parsed = parseShopifyUrl(storeUrl);
      if (!parsed) continue;
      queriesUsed.push(`shopify:${storeUrl}`);

      if (parsed.handle) {
        // Single product URL → fetch product + reviews
        const res = await fetch(apiUrl('/api/shopify'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'product', url: storeUrl }),
        });
        if (!res.ok) continue;
        const data = await res.json();

        if (data.product) {
          // Product data as a source item
          const p = data.product;
          const productContent = [
            `# ${p.title}`,
            '',
            p.description,
            '',
            `Price: ${p.price ?? 'N/A'}${p.compareAtPrice ? ` (was ${p.compareAtPrice})` : ''}`,
            `Vendor: ${p.vendor || 'N/A'}`,
            `Type: ${p.productType || 'N/A'}`,
            p.tags?.length ? `Tags: ${p.tags.join(', ')}` : '',
            p.variants?.length > 1
              ? `Variants: ${p.variants.map((v: { title: string; price: string }) => `${v.title} ($${v.price})`).join(', ')}`
              : '',
          ].filter(Boolean).join('\n');

          items.push(toRawItem('shopify', storeUrl, productContent, {
            title: p.title,
            metadata: { vendor: p.vendor, productType: p.productType, price: p.price },
          }));

          // Reviews as source items
          if (data.reviews?.length > 0) {
            const reviewBlock = data.reviews
              .slice(0, options.maxReviewsPerProduct ?? 30)
              .map((r: ShopifyReview) =>
                `[${r.rating ? '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) : 'No rating'}] ${r.author}\n${r.title ? r.title + '\n' : ''}${r.body}`
              )
              .join('\n\n---\n\n');

            items.push(toRawItem('shopify', storeUrl + '#reviews', reviewBlock, {
              title: `Reviews — ${p.title} (${data.reviews.length} reviews)`,
              comments: data.reviews.map((r: ShopifyReview) => r.body).filter(Boolean),
            }));
          }
        }
      } else {
        // Store domain → fetch catalog
        const res = await fetch(apiUrl('/api/shopify'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'catalog', domain: parsed.domain }),
        });
        if (!res.ok) continue;
        const data = await res.json();

        if (data.products?.length > 0) {
          // Catalog overview as a single source item
          const catalogContent = data.products
            .slice(0, maxProducts)
            .map((p: ShopifyProduct) =>
              `## ${p.title}\n${p.description?.slice(0, 300) ?? ''}\nPrice: ${p.price ?? 'N/A'} | Type: ${p.productType || 'N/A'} | Tags: ${(p.tags || []).join(', ')}`
            )
            .join('\n\n---\n\n');

          items.push(toRawItem('shopify', parsed.domain, catalogContent, {
            title: `Shopify Store Catalog (${data.products.length} products)`,
            metadata: { productCount: data.products.length },
          }));

          // Fetch reviews for top 3 products
          for (const product of data.products.slice(0, 3)) {
            try {
              const rRes = await fetch(apiUrl('/api/shopify'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  mode: 'reviews',
                  url: `${parsed.domain}/products/${product.handle}`,
                }),
              });
              if (!rRes.ok) continue;
              const rData = await rRes.json();
              if (rData.reviews?.length > 0) {
                const reviewBlock = rData.reviews
                  .slice(0, 20)
                  .map((r: ShopifyReview) =>
                    `[${r.rating ? '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) : '?'}] ${r.author}: ${r.body}`
                  )
                  .join('\n\n');

                items.push(toRawItem('shopify', `${parsed.domain}/products/${product.handle}#reviews`, reviewBlock, {
                  title: `Reviews — ${product.title}`,
                  comments: rData.reviews.map((r: ShopifyReview) => r.body).filter(Boolean),
                }));
              }
            } catch { /* skip individual product review failures */ }
          }
        }
      }
    } catch { /* skip failed store URLs */ }
  }

  // ── Step 2: Search for competitor Shopify stores via Tavily ──
  const searchQueries = (plan.product_queries ?? []).slice(0, 6);
  for (const query of searchQueries) {
    const shopifyQuery = `site:myshopify.com OR site:shopify.com ${query}`;
    queriesUsed.push(shopifyQuery);

    const result = await webSearch(shopifyQuery, { maxResults: 5 });
    if (!result) continue;

    // Filter for actual Shopify product pages
    const shopifyUrls = result.results
      .filter(r =>
        r.url.includes('myshopify.com') ||
        r.url.includes('/products/') ||
        r.url.includes('/collections/')
      )
      .slice(0, 3);

    for (const sr of shopifyUrls) {
      // Try to scrape the page for review content
      const scraped = await scrapeUrl(sr.url);
      if (scraped && scraped.markdown.length > 100) {
        items.push(toRawItem('shopify', sr.url, scraped.markdown, {
          title: sr.title || (scraped.metadata.title as string) || undefined,
          metadata: scraped.metadata,
        }));
      }
    }

    if (items.length >= maxProducts) break;
  }

  return {
    source: 'shopify',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
  };
}
