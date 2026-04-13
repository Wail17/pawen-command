// ============================================================
// PAWEN — /api/amazon-reviews — Amazon Product Reviews Scraper
//
// Uses Apify's `junglee/amazon-reviews-scraper` actor to pull
// REAL paginated product reviews — not just the 3-5 snippets
// visible on the product page.
//
// MODES:
//   { mode: "reviews", productUrls: ["https://amazon.com/dp/B0..."],
//     maxReviews: 50 }
//   → returns { reviews: [{ title, text, rating, author, date, verified }] }
//
//   { mode: "search", query: "keto supplement", marketplace: "amazon.com",
//     maxProducts: 5 }
//   → returns { products: [{ url, title, rating, reviewCount, price }] }
//
// Requires APIFY_TOKEN env. Falls back gracefully if unavailable.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

const REVIEW_ACTOR_ID = 'junglee~amazon-reviews-scraper';
const PRODUCT_ACTOR_ID = 'junglee~amazon-product-scraper';
const APIFY_BASE = 'https://api.apify.com/v2/acts';

export const maxDuration = 300;

interface ApifyReviewItem {
  title?: string;
  text?: string;
  reviewBody?: string;
  rating?: number | string;
  ratingValue?: number;
  author?: string;
  reviewerName?: string;
  date?: string;
  datePublished?: string;
  isVerified?: boolean;
  verifiedPurchase?: boolean;
}

interface ApifyProductItem {
  url?: string;
  title?: string;
  stars?: number;
  starsText?: string;
  reviewsCount?: number;
  price?: { value?: number; currency?: string };
  thumbnailImage?: string;
  asin?: string;
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apifyToken = process.env.APIFY_TOKEN?.trim();
  if (!apifyToken) {
    return NextResponse.json(
      { message: 'APIFY_TOKEN not configured — Amazon reviews unavailable' },
      { status: 503 },
    );
  }

  const body = await req.json();
  const { mode } = body;

  try {
    if (mode === 'reviews') {
      const { productUrls, maxReviews = 50 } = body;
      if (!Array.isArray(productUrls) || productUrls.length === 0) {
        return NextResponse.json({ message: 'productUrls required' }, { status: 400 });
      }

      const syncUrl = `${APIFY_BASE}/${REVIEW_ACTOR_ID}/run-sync-get-dataset-items?token=${apifyToken}&timeout=240`;

      const res = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUrls: productUrls.slice(0, 10).map((url: string) => ({ url })),
          maxReviews: Math.min(maxReviews, 100),
          proxyConfiguration: { useApifyProxy: true },
        }),
        signal: AbortSignal.timeout(250_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return NextResponse.json(
          { message: `Apify review scraper failed: ${res.status}`, details: errText.slice(0, 500) },
          { status: 502 },
        );
      }

      const rawItems = (await res.json()) as ApifyReviewItem[];

      const reviews = rawItems
        .filter((r) => (r.text || r.reviewBody || '').length > 10)
        .map((r) => ({
          title: r.title || '',
          text: r.text || r.reviewBody || '',
          rating: typeof r.rating === 'number' ? r.rating : (r.ratingValue ?? (parseFloat(String(r.rating)) || 0)),
          author: r.author || r.reviewerName || 'Anonymous',
          date: r.date || r.datePublished || '',
          verified: r.isVerified ?? r.verifiedPurchase ?? false,
        }));

      return NextResponse.json({
        reviews,
        totalFetched: reviews.length,
      });
    }

    if (mode === 'search') {
      const { query, marketplace = 'amazon.com', maxProducts = 5 } = body;
      if (!query) {
        return NextResponse.json({ message: 'query required' }, { status: 400 });
      }

      const syncUrl = `${APIFY_BASE}/${PRODUCT_ACTOR_ID}/run-sync-get-dataset-items?token=${apifyToken}&timeout=120`;

      const res = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerms: [query],
          maxItems: Math.min(maxProducts, 20),
          domain: marketplace,
          proxyConfiguration: { useApifyProxy: true },
        }),
        signal: AbortSignal.timeout(130_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return NextResponse.json(
          { message: `Apify product search failed: ${res.status}`, details: errText.slice(0, 500) },
          { status: 502 },
        );
      }

      const rawItems = (await res.json()) as ApifyProductItem[];

      const products = rawItems
        .filter((p) => p.url && p.title)
        .map((p) => ({
          url: p.url!,
          title: p.title!,
          rating: p.stars ?? 0,
          reviewCount: p.reviewsCount ?? 0,
          price: p.price?.value ?? null,
          currency: p.price?.currency ?? 'USD',
          asin: p.asin || extractAsin(p.url || ''),
          thumbnail: p.thumbnailImage || '',
        }));

      return NextResponse.json({ products });
    }

    return NextResponse.json(
      { message: 'Invalid mode. Use "reviews" or "search".' },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

function extractAsin(url: string): string {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/);
  return match ? match[1] : '';
}
