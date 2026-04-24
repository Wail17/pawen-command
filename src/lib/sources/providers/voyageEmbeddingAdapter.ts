// ============================================================
// PAWEN — Phase U.4 — Voyage AI embedding adapter
//
// Anthropic-partnered embedding provider. `voyage-3-lite` has
// 512 dims and pricing at $0.02/1M tokens — cheap enough to embed
// every training chunk.
//
// Env: VOYAGE_API_KEY
// Fallback: SimhashEmbeddingAdapter (deterministic hash, no network).
// ============================================================

import 'server-only';
import type { EmbeddingProvider, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';

export class VoyageEmbeddingAdapter implements EmbeddingProvider {
  id = 'voyage';
  priority = 1;
  dimensions = 512; // voyage-3-lite

  async embed(texts: string[]): Promise<Float32Array[]> {
    const key = requireEnv('VOYAGE_API_KEY');
    if (!key) throw new ProviderError('VOYAGE_API_KEY not configured', this.id);
    const inputs = texts.map(t => (t ?? '').slice(0, 16_000));
    const res = await fetchWithTimeout(VOYAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ input: inputs, model: 'voyage-3-lite' }),
      timeoutMs: 45_000,
    });
    if (!res) throw new ProviderError('Voyage network failure', this.id, undefined, true);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Voyage ${res.status}: ${text.slice(0, 200)}`, this.id, res.status, res.status >= 500 || res.status === 429);
    }
    const data = await res.json() as { data?: Array<{ embedding?: number[] }> };
    return (data.data ?? []).map(r => new Float32Array(r.embedding ?? []));
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
