// ============================================================
// PAWEN — Phase U.4 — Brave Search adapter (search fallback)
//
// https://brave.com/search/api/ — independent index, free tier 2k/mo.
// Env: BRAVE_API_KEY
// ============================================================

import 'server-only';
import type { SearchProvider, SearchResult, SearchOptions, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

interface BraveWebResult {
  url?: string;
  title?: string;
  description?: string;
  age?: string;
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] };
  query?: unknown;
  message?: string;
}

export class BraveAdapter implements SearchProvider {
  id = 'brave';
  priority = 2;

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const key = requireEnv('BRAVE_API_KEY');
    if (!key) throw new ProviderError('BRAVE_API_KEY not configured', this.id);

    const params = new URLSearchParams({
      q: query,
      count: String(Math.min(opts.maxResults ?? 10, 20)),
    });
    if (opts.country) params.set('country', opts.country);
    if (opts.freshness === 'day') params.set('freshness', 'pd');
    else if (opts.freshness === 'week') params.set('freshness', 'pw');
    else if (opts.freshness === 'month') params.set('freshness', 'pm');
    else if (opts.freshness === 'year') params.set('freshness', 'py');

    const res = await fetchWithTimeout(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': key,
      },
      timeoutMs: 20_000,
    });
    if (!res) throw new ProviderError('Brave network failure', this.id, undefined, true);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Brave ${res.status}: ${text.slice(0, 200)}`, this.id, res.status, res.status === 429 || res.status >= 500);
    }
    const data = (await res.json()) as BraveSearchResponse;
    const rows = data.web?.results ?? [];
    return rows
      .filter(r => r.url)
      .map(r => ({
        url: r.url!,
        title: r.title,
        content: r.description ?? '',
        snippet: r.description,
        publishedAt: r.age,
        fetchedAt: nowIso(),
        providerId: this.id,
      }));
  }

  async isHealthy(): Promise<ProviderHealth> {
    return missingEnvHealth(this.id, 'BRAVE_API_KEY');
  }
}
