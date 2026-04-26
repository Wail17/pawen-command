// ============================================================
// PAWEN — Phase U.4 — Voyage AI embedding + rerank adapter
//
// Anthropic-partnered. We use:
//   - `voyage-3` for embeddings (1024 dims, $0.06/1M tokens) —
//     much better multilingual signal than the older `voyage-3-lite`,
//     critical for non-English niches (FR / ES / DE / IT scraping).
//   - `rerank-2-lite` for cross-encoder reranking ($0.02/1M tokens) —
//     calibrated 0-1 relevance scores, cross-language. ~$0.005 per
//     200-item excavation.
//
// Env: VOYAGE_API_KEY
// Fallback for embed-only: SimhashEmbeddingAdapter (deterministic, no net).
// Rerank has no fallback — caller must skip when null.
// ============================================================

import 'server-only';
import type { EmbeddingProvider, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

const VOYAGE_EMBED_URL  = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_RERANK_URL = 'https://api.voyageai.com/v1/rerank';

const EMBED_MODEL = process.env.VOYAGE_EMBED_MODEL?.trim() || 'voyage-3';
const RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL?.trim() || 'rerank-2-lite';

export interface RerankResult {
  index: number;
  score: number;
}

export class VoyageEmbeddingAdapter implements EmbeddingProvider {
  id = 'voyage';
  priority = 1;
  // voyage-3 is 1024-dim (was 512 on voyage-3-lite). Cosine is dim-agnostic
  // so dedup keeps working; nothing persisted depends on the dim count.
  dimensions = 1024;

  async embed(texts: string[]): Promise<Float32Array[]> {
    const key = requireEnv('VOYAGE_API_KEY');
    if (!key) throw new ProviderError('VOYAGE_API_KEY not configured', this.id);
    const inputs = texts.map(t => (t ?? '').slice(0, 16_000));
    const res = await fetchWithTimeout(VOYAGE_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ input: inputs, model: EMBED_MODEL }),
      timeoutMs: 45_000,
    });
    if (!res) throw new ProviderError('Voyage network failure', this.id, undefined, true);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Voyage embed ${res.status}: ${text.slice(0, 200)}`, this.id, res.status, res.status >= 500 || res.status === 429);
    }
    const data = await res.json() as { data?: Array<{ embedding?: number[] }> };
    return (data.data ?? []).map(r => new Float32Array(r.embedding ?? []));
  }

  /**
   * Cross-encoder rerank — given a query and N documents, returns
   * relevance scores per document (0-1, calibrated). Top-K is computed
   * client-side so the caller sees ALL scores. Empty on failure.
   *
   * Voyage rerank-2-lite hard limits:
   *   - max 1000 documents per call
   *   - max 4000 tokens per document (we slice to ~16k chars defensively)
   *   - max 8000 tokens query
   */
  async rerank(query: string, documents: string[]): Promise<RerankResult[]> {
    if (documents.length === 0) return [];
    const key = requireEnv('VOYAGE_API_KEY');
    if (!key) throw new ProviderError('VOYAGE_API_KEY not configured', this.id);
    const docs = documents.map(d => (d ?? '').slice(0, 16_000));
    const q = (query ?? '').slice(0, 16_000);
    if (!q) return [];
    // Voyage caps at 1000 docs per call. We chunk if the caller passes more.
    const out: RerankResult[] = [];
    for (let i = 0; i < docs.length; i += 1000) {
      const batch = docs.slice(i, i + 1000);
      const res = await fetchWithTimeout(VOYAGE_RERANK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ query: q, documents: batch, model: RERANK_MODEL }),
        timeoutMs: 60_000,
      });
      if (!res) throw new ProviderError('Voyage rerank network failure', this.id, undefined, true);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ProviderError(`Voyage rerank ${res.status}: ${text.slice(0, 200)}`, this.id, res.status, res.status >= 500 || res.status === 429);
      }
      const data = await res.json() as {
        data?: Array<{ index: number; relevance_score: number }>;
        usage?: { total_tokens?: number };
      };
      const cost = ((data.usage?.total_tokens ?? 0) / 1_000_000) * 0.02;
      console.log(`[voyage] rerank batch ${batch.length} docs, ${data.usage?.total_tokens ?? '?'} tokens (~$${cost.toFixed(4)})`);
      for (const r of (data.data ?? [])) {
        out.push({ index: i + r.index, score: r.relevance_score });
      }
    }
    return out;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return missingEnvHealth(this.id, 'VOYAGE_API_KEY');
  }
}

/**
 * Fallback embedding: a deterministic pseudo-embedding derived from a
 * rolling-hash of the input text. NOT semantically meaningful, but lets
 * the dedup + index machinery run when no embedding key is configured.
 * Cosine similarity between two stub embeddings will only spike for
 * identical strings — good enough for "exact-duplicate" dedup.
 */
export class SimhashEmbeddingAdapter implements EmbeddingProvider {
  id = 'simhash-stub';
  priority = 99;
  dimensions = 128;

  async embed(texts: string[]): Promise<Float32Array[]> {
    return texts.map(t => this.hashToVector(t ?? ''));
  }

  async isHealthy(): Promise<ProviderHealth> {
    return { ok: true, message: 'simhash-stub: always available (no semantic meaning)', lastCheckedAt: nowIso() };
  }

  private hashToVector(text: string): Float32Array {
    const v = new Float32Array(this.dimensions);
    if (!text) return v;
    // 32-bit FNV-1a hash per shingle, mapped to dim index
    for (let i = 0; i < text.length - 3; i++) {
      let h = 0x811c9dc5;
      for (let j = 0; j < 4; j++) {
        h ^= text.charCodeAt(i + j) | 0;
        h = Math.imul(h, 0x01000193);
      }
      const idx = Math.abs(h) % this.dimensions;
      v[idx] += 1;
    }
    // L2 normalize
    let n = 0;
    for (const x of v) n += x * x;
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
  }
}
