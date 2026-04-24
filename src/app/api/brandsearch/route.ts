// ============================================================
// PAWEN — /api/brandsearch — PRE-GATE BrandSearch Intel
// Proxies to BrandSearch API (https://api.brandsearch.co)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import type { BrandSearchAction } from '@/lib/brandsearch/types';

export const maxDuration = 60;

const BASE_URL = 'https://api.brandsearch.co';

// BrandSearch API uses _id as domain, different field names, etc.
// Normalize to our BrandSearchBrand / BrandSearchAd types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBrand(b: any) {
  if (!b) return b;
  const { _id, title, country_code, last_meta_active_count, last_meta_total_count, product_count, sub_niche, ...rest } = b;
  return {
    ...rest,
    id: _id ?? b.id ?? b.name,
    name: title ?? b.name ?? _id,
    url: _id ?? b.name ?? b.url,
    description: b.description,
    country: country_code ?? b.country,
    platform: b.platform,
    monthly_visits: b.monthly_visits,
    meta_active_count: last_meta_active_count ?? b.meta_active_count,
    meta_total_count: last_meta_total_count ?? b.meta_total_count,
    meta_ads_active: (last_meta_active_count ?? 0) > 0,
    total_products: product_count ?? b.total_products,
    estimated_sales: b.estimated_sales,
    niche: b.niche ?? sub_niche,
    emails: b.emails,
    created_at: b.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAd(a: any) {
  if (!a) return a;
  const { _id, content, ...rest } = a;
  return {
    ...rest,
    id: a.id ?? _id,
    brand_id: a.brand_id,
    status: a.status,
    start_date: a.start_date,
    end_date: a.end_date,
    platforms: a.platforms,
    content: content?.body ?? content,
    is_video: a.is_video,
    is_image: a.is_image,
    funnel_type: a.funnel_type,
    eu_total_reach: a.eu_total_reach,
    eu_total_spend: a.eu_total_spend,
    media_path: a.media_path,
    total_active_time: a.total_active_time,
    headline: content?.title,
    body_text: content?.body,
    cta_text: content?.cta?.text,
    link_url: content?.link_url,
    display_format: content?.display_format,
  };
}

// Fetch AOV for a single brand
async function fetchBrandAov(
  brandId: string,
  apiKey: string,
): Promise<{ avg_price: number | null; currency: string | null }> {
  try {
    const url = new URL(`/v1/brands/${encodeURIComponent(brandId)}/products`, BASE_URL);
    url.searchParams.set('product_type', 'bestsellers');
    const res = await fetch(url.toString(), {
      headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { avg_price: null, currency: null };
    const data = await res.json();
    const products = [...(data.bestsellers ?? []), ...(data.latest ?? [])];
    if (products.length === 0) return { avg_price: null, currency: null };
    const prices = products
      .map((p: { price?: { amount?: number } | number }) => {
        if (typeof p.price === 'number') return p.price;
        if (p.price?.amount) return p.price.amount;
        return null;
      })
      .filter((p: number | null): p is number => p !== null && p > 0);
    if (prices.length === 0) return { avg_price: null, currency: null };
    const avg = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
    const currency = products[0]?.price?.currencyCode ?? 'USD';
    return { avg_price: Math.round(avg * 100) / 100, currency };
  } catch {
    return { avg_price: null, currency: null };
  }
}

// Enrich brands with AOV — tries ALL brands (product_count is unreliable)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichWithAov(brands: any[], apiKey: string): Promise<any[]> {
  if (brands.length === 0) return brands;

  // Process ALL brands in batches of 8 — product_count from list endpoint is unreliable
  const aovMap = new Map<string, { avg_price: number | null; currency: string | null }>();
  const batchSize = 8;
  for (let i = 0; i < brands.length; i += batchSize) {
    const batch = brands.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (b) => {
        const brandId = b.id ?? b.url ?? b.name;
        const aov = await fetchBrandAov(brandId, apiKey);
        return { brandId, ...aov };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        aovMap.set(r.value.brandId, { avg_price: r.value.avg_price, currency: r.value.currency });
      }
    }
  }

  return brands.map(b => {
    const brandId = b.id ?? b.url ?? b.name;
    const aov = aovMap.get(brandId);
    if (aov?.avg_price) {
      return { ...b, avg_price: aov.avg_price, currency: aov.currency };
    }
    return b;
  });
}

async function brandSearchFetch(
  path: string,
  apiKey: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<Response> {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(55_000),
  });
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.BRANDSEARCH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: 'BRANDSEARCH_API_KEY not configured' },
      { status: 500 },
    );
  }

  let body: BrandSearchAction;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || !('action' in body)) {
    return NextResponse.json({ message: 'Missing action field' }, { status: 400 });
  }

  try {
    let res: Response;

    switch (body.action) {
      case 'search_brands': {
        const hasAovFilter = !!(body.avg_price_min || body.avg_price_max);
        const requestedPageSize = body.page_size ?? 20;
        // When AOV filter is active, fetch more brands since many will be filtered out
        const fetchPageSize = hasAovFilter ? 50 : requestedPageSize;
        const params: Record<string, string | number | boolean | undefined> = {
          q: body.query,
          monthly_visits_min: body.monthly_visits_min,
          monthly_visits_max: body.monthly_visits_max,
          meta_ads_active: body.meta_ads_active,
          meta_total_min: body.meta_total_min,
          meta_total_max: body.meta_total_max,
          avg_price_min: body.avg_price_min,
          avg_price_max: body.avg_price_max,
          sort: body.sort,
          page: body.page,
          page_size: fetchPageSize,
        };
        res = await brandSearchFetch('/v1/brands', apiKey, params);

        // If AOV filter is active and first page didn't yield enough, fetch more pages
        if (hasAovFilter) {
          const firstRaw = await res.json();
          const firstItems = (firstRaw.data ?? firstRaw.brands ?? []).map(normalizeBrand);
          const firstPg = firstRaw.pagination ?? {};
          let allItems = [...firstItems];

          // Fetch up to 2 more pages to gather enough brands for filtering
          const totalPages = firstPg.total_pages ?? 1;
          const maxExtraPages = Math.min(2, totalPages - (firstPg.page ?? 1));
          for (let extra = 1; extra <= maxExtraPages; extra++) {
            const extraRes = await brandSearchFetch('/v1/brands', apiKey, {
              ...params,
              page: (firstPg.page ?? 1) + extra,
              page_size: fetchPageSize,
            });
            if (extraRes.ok) {
              const extraRaw = await extraRes.json();
              const extraItems = (extraRaw.data ?? extraRaw.brands ?? []).map(normalizeBrand);
              allItems = [...allItems, ...extraItems];
            }
          }

          // Enrich with AOV
          const enriched = await enrichWithAov(allItems, apiKey);

          // Filter by AOV range
          const aovMin = body.avg_price_min ? Number(body.avg_price_min) : null;
          const aovMax = body.avg_price_max ? Number(body.avg_price_max) : null;
          const filtered = enriched.filter(b => {
            if (b.avg_price == null) return false;
            if (aovMin !== null && b.avg_price < aovMin) return false;
            if (aovMax !== null && b.avg_price > aovMax) return false;
            return true;
          });

          // Return only the requested page size worth of results
          const sliced = filtered.slice(0, requestedPageSize);
          return NextResponse.json({
            brands: sliced,
            total: filtered.length,
            page: 1,
            page_size: requestedPageSize,
            has_more: filtered.length > requestedPageSize,
          });
        }

        break;
      }

      case 'get_brand': {
        if (!body.brand_id) {
          return NextResponse.json({ message: 'brand_id is required' }, { status: 400 });
        }
        res = await brandSearchFetch(`/v1/brands/${encodeURIComponent(body.brand_id)}`, apiKey);
        break;
      }

      case 'get_brand_by_url': {
        if (!body.url) {
          return NextResponse.json({ message: 'url is required' }, { status: 400 });
        }
        res = await brandSearchFetch(`/v1/brands/by-url/${encodeURIComponent(body.url)}`, apiKey);
        break;
      }

      case 'get_ads': {
        if (!body.brand_id) {
          return NextResponse.json({ message: 'brand_id is required' }, { status: 400 });
        }
        if (!body.platform) {
          return NextResponse.json({ message: 'platform is required' }, { status: 400 });
        }
        const params: Record<string, string | number | boolean | undefined> = {
          platform: body.platform,
          status: body.status,
          min_spend: body.min_spend,
          max_spend: body.max_spend,
          page: body.page,
          page_size: body.page_size ?? 20,
        };
        res = await brandSearchFetch(`/v1/brands/${encodeURIComponent(body.brand_id)}/ads`, apiKey, params);
        break;
      }

      case 'get_products': {
        if (!body.brand_id) {
          return NextResponse.json({ message: 'brand_id is required' }, { status: 400 });
        }
        const params: Record<string, string | number | boolean | undefined> = {
          product_type: body.product_type ?? 'all',
        };
        res = await brandSearchFetch(`/v1/brands/${encodeURIComponent(body.brand_id)}/products`, apiKey, params);
        break;
      }

      default:
        return NextResponse.json(
          { message: `Unknown action: ${(body as Record<string, unknown>).action}` },
          { status: 400 },
        );
    }

    // Handle upstream errors
    if (!res.ok) {
      const status = res.status;
      let errorBody: string;
      try {
        errorBody = await res.text();
      } catch {
        errorBody = 'Unknown error';
      }

      if (status === 429) {
        return NextResponse.json(
          { message: 'BrandSearch rate limit reached. Please wait and try again.' },
          { status: 429 },
        );
      }
      if (status === 404) {
        return NextResponse.json(
          { message: 'Brand or resource not found.' },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { message: `BrandSearch API error (${status})`, details: errorBody },
        { status: status >= 500 ? 502 : status },
      );
    }

    const raw = await res.json();

    // Normalize API responses to a consistent shape for the client.
    // BrandSearch returns { data: [...], pagination: { page, page_size, total, total_pages } }
    // for list endpoints, and a plain object for single-item endpoints.
    if (body.action === 'search_brands') {
      // AOV-filtered searches are handled above with early return
      const items = (raw.data ?? raw.brands ?? []).map(normalizeBrand);
      const pg = raw.pagination ?? {};

      // Enrich brands with AOV by fetching products in parallel
      const enriched = await enrichWithAov(items, apiKey);

      return NextResponse.json({
        brands: enriched,
        total: pg.total ?? enriched.length,
        page: pg.page ?? 1,
        page_size: pg.page_size ?? 20,
        has_more: pg.page < pg.total_pages,
      });
    }

    if (body.action === 'get_ads') {
      const items = raw.data ?? raw.ads ?? [];
      const pg = raw.pagination ?? {};
      return NextResponse.json({
        ads: items.map(normalizeAd),
        total: pg.total ?? items.length,
        page: pg.page ?? 1,
        page_size: pg.page_size ?? 20,
        has_more: pg.page < pg.total_pages,
      });
    }

    if (body.action === 'get_products') {
      const bestsellers = raw.bestsellers ?? [];
      const latest = raw.latest ?? [];
      return NextResponse.json({
        products: [...bestsellers, ...latest],
        total: bestsellers.length + latest.length,
      });
    }

    // Single brand endpoints — normalize field names
    if (body.action === 'get_brand' || body.action === 'get_brand_by_url') {
      return NextResponse.json(normalizeBrand(raw));
    }

    return NextResponse.json(raw);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('TimeoutError') || message.includes('aborted')) {
      return NextResponse.json(
        { message: 'BrandSearch API request timed out' },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { message: `BrandSearch error: ${message}` },
      { status: 500 },
    );
  }
}
