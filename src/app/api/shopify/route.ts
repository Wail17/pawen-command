// ============================================================
// PAWEN — /api/shopify — Shopify Store Data Fetcher
//
// Pulls product data + reviews from any Shopify store using
// Shopify's public JSON endpoints (no API key needed).
//
// MODES:
//   { mode: "product", url: "https://store.com/products/xyz" }
//     → { product: { title, description, price, images[], variants[], vendor, type, tags[] } }
//
//   { mode: "reviews", url: "https://store.com/products/xyz" }
//     → { reviews: [{ author, rating, title, body, date }] }
//
//   { mode: "catalog", domain: "store.myshopify.com" }
//     → { products: [{ title, handle, description, price, images[] }] }
//
//   { mode: "detect", url: "https://..." }
//     → { isShopify: boolean, domain?: string, handle?: string }
//
// No env vars required — Shopify stores expose /products.json and
// /products/{handle}.json publicly.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 120;

// === HELPERS ===

function extractShopifyInfo(url: string): { domain: string; handle: string | null } | null {
  try {
    const u = new URL(url);
    // Match /products/some-handle or /collections/xxx/products/some-handle
    const productMatch = u.pathname.match(/\/products\/([a-zA-Z0-9\-_]+)/);
    return {
      domain: u.origin,
      handle: productMatch ? productMatch[1] : null,
    };
  } catch {
    return null;
  }
}

async function fetchJSON(url: string, timeoutMs = 15000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PawenBot/1.0)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Detect if a URL points to a Shopify store by checking for /products.json
async function detectShopify(url: string): Promise<{ isShopify: boolean; domain: string }> {
  try {
    const u = new URL(url);
    const domain = u.origin;
    const res = await fetch(`${domain}/products.json?limit=1`, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PawenBot/1.0)' },
      redirect: 'follow',
    });
    // Shopify stores return 200 with JSON content-type
    const ct = res.headers.get('content-type') || '';
    return { isShopify: res.ok && ct.includes('json'), domain };
  } catch {
    return { isShopify: false, domain: '' };
  }
}

// Fetch single product via Shopify's public JSON endpoint
async function fetchProduct(domain: string, handle: string) {
  const data = await fetchJSON(`${domain}/products/${handle}.json`) as {
    product: {
      id: number;
      title: string;
      body_html: string;
      vendor: string;
      product_type: string;
      tags: string[];
      images: Array<{ src: string; alt: string | null }>;
      variants: Array<{
        title: string;
        price: string;
        compare_at_price: string | null;
        sku: string;
        available: boolean;
      }>;
      created_at: string;
      updated_at: string;
    };
  };

  const p = data.product;
  // Strip HTML from description
  const plainDescription = p.body_html
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim() ?? '';

  return {
    id: p.id,
    title: p.title,
    description: plainDescription,
    descriptionHtml: p.body_html,
    vendor: p.vendor,
    productType: p.product_type,
    tags: p.tags,
    images: p.images.map(img => ({ src: img.src, alt: img.alt })),
    variants: p.variants.map(v => ({
      title: v.title,
      price: v.price,
      compareAtPrice: v.compare_at_price,
      sku: v.sku,
      available: v.available,
    })),
    price: p.variants[0]?.price ?? null,
    compareAtPrice: p.variants[0]?.compare_at_price ?? null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

// Fetch product catalog (first N products)
async function fetchCatalog(domain: string, limit = 30) {
  const data = await fetchJSON(`${domain}/products.json?limit=${limit}`) as {
    products: Array<{
      id: number;
      title: string;
      handle: string;
      body_html: string;
      vendor: string;
      product_type: string;
      tags: string[];
      images: Array<{ src: string }>;
      variants: Array<{ price: string; compare_at_price: string | null }>;
    }>;
  };

  return data.products.map(p => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.body_html
      ?.replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500) ?? '',
    vendor: p.vendor,
    productType: p.product_type,
    tags: p.tags,
    image: p.images[0]?.src ?? null,
    price: p.variants[0]?.price ?? null,
    compareAtPrice: p.variants[0]?.compare_at_price ?? null,
  }));
}

// Scrape reviews from the product page HTML
// Many Shopify stores use Judge.me, Loox, Yotpo, or Stamped.
// We look for common review JSON-LD or structured data patterns.
async function fetchReviewsFromPage(domain: string, handle: string) {
  try {
    const res = await fetch(`${domain}/products/${handle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const reviews: Array<{ author: string; rating: number; title: string; body: string; date: string }> = [];

    // Strategy 1: JSON-LD Product reviews
    const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const ld = JSON.parse(match[1]);
        const reviewData = ld.review || ld['@graph']?.find?.((g: { '@type': string }) => g['@type'] === 'Product')?.review;
        if (Array.isArray(reviewData)) {
          for (const r of reviewData) {
            reviews.push({
              author: r.author?.name || r.author || 'Anonymous',
              rating: Number(r.reviewRating?.ratingValue ?? r.rating ?? 5),
              title: r.name || '',
              body: r.reviewBody || r.description || '',
              date: r.datePublished || '',
            });
          }
        }
      } catch { /* skip malformed JSON-LD */ }
    }

    // Strategy 2: Judge.me widget data (very common on Shopify)
    const judgemeMatch = html.match(/jdgm-rev-widg[^>]*data-id="(\d+)"/);
    if (judgemeMatch && reviews.length === 0) {
      try {
        const judgemeUrl = `${domain}/apps/judgeme/reviews?product_id=${judgemeMatch[1]}&page=1&per_page=20`;
        const jRes = await fetch(judgemeUrl, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        });
        if (jRes.ok) {
          const jData = await jRes.json() as {
            reviews?: Array<{ reviewer: { name: string }; rating: number; title: string; body: string; created_at: string }>;
          };
          if (jData.reviews) {
            for (const r of jData.reviews) {
              reviews.push({
                author: r.reviewer?.name || 'Anonymous',
                rating: r.rating,
                title: r.title || '',
                body: r.body || '',
                date: r.created_at || '',
              });
            }
          }
        }
      } catch { /* judge.me fetch failed */ }
    }

    // Strategy 3: Regex fallback — look for common review HTML patterns
    if (reviews.length === 0) {
      // Look for review content in common class patterns
      const reviewBlocks = html.matchAll(
        /class="[^"]*review[^"]*body[^"]*"[^>]*>([\s\S]*?)<\//gi
      );
      for (const block of reviewBlocks) {
        const text = block[1].replace(/<[^>]*>/g, '').trim();
        if (text.length > 20) {
          reviews.push({
            author: 'Shopify Customer',
            rating: 0,
            title: '',
            body: text.slice(0, 2000),
            date: '',
          });
        }
      }
    }

    return reviews.slice(0, 50); // cap at 50 reviews
  } catch {
    return [];
  }
}

// === MAIN ROUTE ===

export async function POST(req: NextRequest) {
  await requireSession(req);

  const body = await req.json();
  const { mode } = body;

  try {
    if (mode === 'detect') {
      const { url } = body;
      if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
      const info = extractShopifyInfo(url);
      const detection = await detectShopify(url);
      return NextResponse.json({
        isShopify: detection.isShopify,
        domain: detection.domain,
        handle: info?.handle ?? null,
      });
    }

    if (mode === 'product') {
      const { url } = body;
      if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
      const info = extractShopifyInfo(url);
      if (!info) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });

      if (info.handle) {
        const product = await fetchProduct(info.domain, info.handle);
        const reviews = await fetchReviewsFromPage(info.domain, info.handle);
        return NextResponse.json({ product, reviews });
      } else {
        // No product handle — return catalog
        const products = await fetchCatalog(info.domain);
        return NextResponse.json({ products, reviews: [] });
      }
    }

    if (mode === 'reviews') {
      const { url } = body;
      if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
      const info = extractShopifyInfo(url);
      if (!info?.handle) return NextResponse.json({ error: 'Product URL with handle required' }, { status: 400 });
      const reviews = await fetchReviewsFromPage(info.domain, info.handle);
      return NextResponse.json({ reviews });
    }

    if (mode === 'catalog') {
      const { domain } = body;
      if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 });
      const origin = domain.startsWith('http') ? domain : `https://${domain}`;
      const products = await fetchCatalog(origin);
      return NextResponse.json({ products });
    }

    return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Shopify fetch failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
