// ============================================================
// PAWEN — Phase U.4.7 — Embedding + cross-source dedup
//
// Cosine-similarity dedup of training chunks. Collapses chunks with
// similarity > 0.92 into one, keeping the highest quality version.
// Embeddings come from whatever EmbeddingProvider is healthy
// (Voyage primary, Simhash stub fallback — see voyageEmbeddingAdapter).
// ============================================================

import { getEmbeddingProvider } from './providers/registry';

export interface Embeddable {
  id: string;
  text: string;
  qualityScore?: number;
  source?: string;
}

export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const provider = await getEmbeddingProvider();
  if (!provider) return texts.map(() => new Float32Array(0));
  try {
    return await provider.embed(texts);
  } catch {
    return texts.map(() => new Float32Array(0));
  }
}

function cos(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || b.length === 0) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface DedupResult<T extends Embeddable> {
  kept: T[];
  collapsed: Array<{ keeper: string; removed: string[]; similarity: number }>;
  volumeBefore: number;
  volumeAfter: number;
}

/**
 * O(n²) single-pass dedup. Fine for the batch sizes we see (a few hundred
 * chunks per gate run). Keeps whichever chunk has the higher qualityScore
 * (ties → earliest index).
 */
export async function dedupByCosine<T extends Embeddable>(
  items: T[],
  threshold = 0.92,
): Promise<DedupResult<T>> {
  if (items.length <= 1) {
    return { kept: items, collapsed: [], volumeBefore: items.length, volumeAfter: items.length };
  }
  const embeddings = await embedTexts(items.map(it => it.text));
  const keepers: T[] = [];
  const keeperEmb: Float32Array[] = [];
  const collapsed: DedupResult<T>['collapsed'] = [];
  const absorbed = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (absorbed.has(i)) continue;
    let keeperIdx = i;
    let bestKeeper: T = items[i];
    const removed: string[] = [];
    let maxSim = 0;

    for (let j = i + 1; j < items.length; j++) {
      if (absorbed.has(j)) continue;
      const sim = cos(embeddings[i], embeddings[j]);
      if (sim >= threshold) {
        absorbed.add(j);
        // Choose the higher-quality one
        const qi = items[keeperIdx].qualityScore ?? 0;
        const qj = items[j].qualityScore ?? 0;
        if (qj > qi) {
          removed.push(items[keeperIdx].id);
          keeperIdx = j;
          bestKeeper = items[j];
        } else {
          removed.push(items[j].id);
        }
        maxSim = Math.max(maxSim, sim);
      }
    }
    keepers.push(bestKeeper);
    keeperEmb.push(embeddings[keeperIdx]);
    if (removed.length > 0) {
      collapsed.push({ keeper: bestKeeper.id, removed, similarity: maxSim });
    }
  }

  return {
    kept: keepers,
    collapsed,
    volumeBefore: items.length,
    volumeAfter: keepers.length,
  };
}

/**
 * Convenience: embed the avatar summary once so callers can pass it to
 * `scoreChunk({ avatarEmbedding })`.
 */
export async function embedAvatarSummary(summary: string): Promise<Float32Array | null> {
  const [e] = await embedTexts([summary]);
  return e && e.length > 0 ? e : null;
}
