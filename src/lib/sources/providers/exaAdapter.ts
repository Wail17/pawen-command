// ============================================================
// PAWEN — Phase U.4 — Exa search adapter (primary)
//
// https://exa.ai — neural search API. Returns semantically matched
// web results, not just keyword hits. The flagship pick for finding
// genuinely related content (VOC, competitor pages, niche forums).
//
// Env: EXA_API_KEY
// Docs: https://docs.exa.ai
// ============================================================

import 'server-only';
import type { SearchProvider, SearchResult, SearchOptions, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

interface ExaSearchRow {
  id?: string;
  url?: string;
  title?: string;
  score?: number;
  publishedDate?: string;
  text?: string;
  highlights?: string[];
}

interface ExaSearchResponse {
  results?: ExaSearchRow[];
  autopromptString?: string;
  error?: string;
}

export class ExaAdapter implements SearchProvider {
  id = 'exa';
  priority = 1;

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
    const key = requireEnv('EXA_API_KEY');
    if (!key) throw new ProviderError('EXA_API_KEY not configured', this.id);

    const body = {
      query,
      numResults: opts.maxResults ?? 10,
      type: opts.searchDepth === 'advanced' ? 'auto' : 'neural',
      useAutoprompt: true,
      contents: { text: { maxCharacters: 2000, includeHtmlTags: false } },
      includeDomains: opts.includeDomains,
      excludeDomains: opts.excludeDomains,
      startPublishedDate: freshnessToDate(opts.freshness),
    };

    const res = await fetchWithTimeout('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify(body),
      timeoutMs: 30_000,
    });
    if (!res) throw new ProviderError('Exa network failure', this.id, undefined, true);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Exa ${res.status}: ${text.slice(0, 200)}`, this.id, res.status, res.status >= 500 || res.status === 429);
    }

    const data = (await res.json()) as ExaSearchResponse;
    if (data.error) throw new ProviderError(`Exa error: ${data.error}`, this.id);

    const rows = data.results ?? [];
    return rows
      .filter(r => r.url)
      .map(r => ({
        url: r.url!,
        title: r.title,
        content: r.text ?? r.highlights?.join('\n\n') ?? '',
        snippet: r.highlights?.[0],
        score: r.score,
        publishedAt: r.publishedDate,
        metadata: { id: r.id },
        fetchedAt: nowIso(),
        providerId: this.id,
      }));
  }

  async isHealthy(): Promise<ProviderHealth> {
    return missingEnvHealth(this.id, 'EXA_API_KEY');
  }
}

function freshnessToDate(f: SearchOptions['freshness']): string | undefined {
  if (!f) return undefined;
  const now = new Date();
  const d = new Date(now);
  if (f === 'day') d.setDate(d.getDate() - 1);
  else if (f === 'week') d.setDate(d.getDate() - 7);
  else if (f === 'month') d.setMonth(d.getMonth() - 1);
  else if (f === 'year') d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}
