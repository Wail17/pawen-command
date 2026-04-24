// ============================================================
// PAWEN — Phase U.4 — Shopify public adapter (ecom)
// No API key required. Uses /products.json and /products/{handle}.json.
// ============================================================

import 'server-only';
import type { EcomProvider, EcomResult, EcomFetchOptions, EcomReview, ProviderHealth } from './types';
import { fetchWithTimeout, nowIso } from './common';

interface ShopifyProduct {
  id?: number;
  title?: string;
  handle?: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[];
  variants?: Array<{ price?: string; title?: string }>;
  images?: Array<{ src?: string }>;
}

export class ShopifyPublicAdapter implements EcomProvider {
  id = 'shopify-public';
  priority = 1;
  supports: EcomFetchOptions['platform'][] = ['shopify'];

  // For Shopify we interpret the "query" as a store domain + optional handle.
  // Format: "https://store.myshopify.com" or "https://store.com/products/foo"
  async fetch(query: string, opts: EcomFetchOptions): Promise<EcomResult[]> {
    if (opts.platform !== 'shopify') return [];
    const maxProducts = opts.maxProducts ?? 12;
    try {
      const u = new URL(query);
      const handleMatch = u.pathname.match(/\/products\/([a-zA-Z0-9\-_]+)/);

      if (handleMatch) {
        // Single product
        const res = await fetchWithTimeout(`${u.origin}/products/${handleMatch[1]}.json`, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': 'PawenBot/1.0' },
          timeoutMs: 15_000,
        });
        if (!res || !res.ok) return [];
        const data = await res.json() as { product?: ShopifyProduct };
        const p = data.product;
        if (!p) return [];
        return [this.toResult(u.origin, p, opts)];
      }

      // Catalog
      const res = await fetchWithTimeout(`${u.origin}/products.json?limit=${maxProducts}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': 'PawenBot/1.0' },
        timeoutMs: 20_000,
      });
      if (!res || !res.ok) return [];
      const data = await res.json() as { products?: ShopifyProduct[] };
      return (data.products ?? []).slice(0, maxProducts).map(p => this.toResult(u.origin, p, opts));
    } catch {
      return [];
    }
  }

  async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, message: 'shopify-public: no key required', lastCheckedAt: nowIso() };
  }

  private toResult(origin: string, p: ShopifyProduct, _opts: EcomFetchOptions): EcomResult {
    const url = `${origin}/products/${p.handle}`;
    const price = p.variants?.[0]?.price;
    const reviews: EcomReview[] = []; // public JSON doesn't expose reviews — handled by a separate scrape pass
    return {
      url,
      title: p.title,
      content: [p.title, (p.body_html ?? '').replace(/<[^>]+>/g, ' ').slice(0, 2000)].filter(Boolean).join('\n\n'),
      platform: 'shopify',
      productId: p.handle,
      price,
      reviews,
      reviewCount: 0,
      metadata: {
        vendor: p.vendor,
        productType: p.product_type,
        tags: p.tags,
        image: p.images?.[0]?.src,
      },
      fetchedAt: nowIso(),
      providerId: this.id,
    };
  }
}
