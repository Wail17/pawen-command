// ============================================================
// PAWEN — Phase U.4 — Firecrawl scrape adapter
// Plus cache layer integration (U.4.5).
// Env: FIRECRAWL_API_KEY
// ============================================================

import 'server-only';
import type { ScraperProvider, ScrapeResult, ScrapeOptions, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv, normalizeUrl } from './common';
import { getCachedScrape, putCachedScrape } from '../scrapeCache';

export class FirecrawlAdapter implements ScraperProvider {
  id = 'firecrawl';
  priority = 1;

  async scrape(url: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
    const normalized = normalizeUrl(url);
    const ttl = opts.cacheTtlSec ?? 12 * 3600;   // 12h default
    if (ttl > 0) {
      const hit = await getCachedScrape(normalized);
      if (hit) {
        return {
          url: normalized,
          content: hit.markdown,
          markdown: hit.markdown,
          metadata: hit.metadata,
          statusCode: 200,
          cached: true,
          fetchedAt: hit.fetchedAt,
          providerId: this.id,
        };
      }
    }

    const key = requireEnv('FIRECRAWL_API_KEY');
    if (!key) throw new ProviderError('FIRECRAWL_API_KEY not configured', this.id);

    const res = await fetchWithTimeout('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        url,
        formats: opts.formats ?? ['markdown'],
        onlyMainContent: opts.onlyMainContent !== false,
      }),
      timeoutMs: 55_000,
    });
    if (!res) throw new ProviderError('Firecrawl network failure', this.id, undefined, true);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Firecrawl ${res.status}: ${text.slice(0, 200)}`, this.id, res.status, res.status >= 500);
    }
    const data = await res.json() as { data?: { markdown?: string; metadata?: Record<string, unknown> } };
    const markdown = data.data?.markdown ?? '';
    const metadata = data.data?.metadata ?? {};
    const now = nowIso();

    if (ttl > 0 && markdown.length > 200) {
      await putCachedScrape(normalized, markdown, metadata, ttl).catch(() => { /* best-effort */ });
    }

    return {
      url: normalized,
      content: markdown,
      markdown,
      metadata,
      statusCode: 200,
      cached: false,
      fetchedAt: now,
      providerId: this.id,
    };
  }

  async isHealthy(): Promise<ProviderHealth> {
    return missingEnvHealth(this.id, 'FIRECRAWL_API_KEY');
  }
}
