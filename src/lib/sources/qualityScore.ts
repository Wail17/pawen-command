// ============================================================
// PAWEN — Phase U.4.6 — Chunk quality scoring (0-100)
//
// Four dimensions, all independent, weighted sum:
//   Specificity     0-25  verbatim concreteness markers
//   Emotion         0-25  emotional vocabulary / intensity
//   Relevance       0-30  cosine to avatar embedding
//   Source authority 0-20 customer testimonial > forum > SEO blog
//
// Score ≥ 60 → high quality, prioritized. Score < 30 → dropped
// unless no alternative (the caller decides).
// ============================================================

export type SourceKind = 'amazon' | 'shopify' | 'reddit' | 'quora' | 'youtube' | 'tiktok' | 'forum' | 'blog' | 'news' | 'other';

export interface QualityBreakdown {
  specificity: number;
  emotion: number;
  relevance: number;
  authority: number;
  total: number;
}

const SPECIFICITY_PATTERNS: RegExp[] = [
  /\b\d{1,3}(?:[.,]\d+)?\s*(?:%|€|\$|£|¥|kg|lb|ml|cm|mg|g|USD|EUR)\b/i,   // numbers with units
  /\b(?:today|yesterday|last\s+(?:week|month|year)|il y a|hace|vor|fa)\b/i,   // time refs
  /\b(?:my (?:wife|husband|dog|cat|son|daughter|mom|dad)|mi (?:marido|esposa|perro))\b/i, // relational
  /\b(?:shoulder|knee|stomach|chest|back|neck|skin|hair|gut|bladder|kidney|liver)\b/i, // body parts
  /\b(?:morning|evening|night|during dinner|in the shower)\b/i,  // specific scenarios
  /"[^"]{15,}"/,                                 // quoted speech ≥15 chars
];

const EMOTION_WORDS = new Set([
  // EN
  'hate', 'love', 'fear', 'scared', 'angry', 'furious', 'devastated', 'broken',
  'desperate', 'terrified', 'ashamed', 'embarrassed', 'disgusted', 'frustrated',
  'exhausted', 'heartbroken', 'furious', 'hopeful', 'grateful', 'relieved',
  // ES
  'odio', 'amo', 'miedo', 'asustad', 'furioso', 'desesperada', 'desesperado',
  'aterrada', 'avergonzada', 'cansada', 'agotada', 'frustrada',
  // FR
  'déteste', 'adore', 'peur', 'effrayée', 'furieux', 'désespérée', 'honte',
  'épuisée', 'frustrée',
  // DE
  'hasse', 'liebe', 'angst', 'verzweifelt', 'wütend', 'erschöpft',
  // IT
  'odio', 'paura', 'furiosa', 'disperata', 'esausta',
]);

const AUTHORITY_BY_SOURCE: Record<SourceKind, number> = {
  amazon: 20,      // verified purchases
  shopify: 18,     // merchant + reviews
  reddit: 15,      // real humans, community-moderated
  quora: 12,
  youtube: 14,     // real comments under reviews
  tiktok: 12,
  forum: 14,
  blog: 6,         // SEO noise
  news: 10,
  other: 8,
};

function scoreSpecificity(text: string): number {
  if (!text || text.length < 10) return 0;
  let hits = 0;
  for (const p of SPECIFICITY_PATTERNS) if (p.test(text)) hits++;
  // 6 patterns → cap at 6. Normalize to 25.
  return Math.min(25, Math.round((hits / SPECIFICITY_PATTERNS.length) * 25));
}

function scoreEmotion(text: string): number {
  if (!text || text.length < 10) return 0;
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-zàâäéèêëîïôöùûüçñáéíóú]+/).filter(Boolean);
  if (words.length === 0) return 0;
  let hits = 0;
  for (const w of words) {
    if (EMOTION_WORDS.has(w) || EMOTION_WORDS.has(w.replace(/s$/, ''))) hits++;
  }
  const exclMatches = text.match(/!/g);
  const exclRatio = (exclMatches ? exclMatches.length : 0) / Math.max(words.length / 20, 1);
  const capsWords = text.match(/\b[A-Z]{3,}\b/g) || [];
  const capsRatio = capsWords.length / Math.max(words.length / 30, 1);
  const density = hits / words.length;
  // Weighted: density 0-0.05 → 0-15, excl 0-1 → 0-5, caps 0-1 → 0-5
  const raw = Math.min(15, density * 300) + Math.min(5, exclRatio * 5) + Math.min(5, capsRatio * 5);
  return Math.min(25, Math.round(raw));
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function scoreRelevance(chunkEmbedding: Float32Array | null, avatarEmbedding: Float32Array | null): number {
  if (!chunkEmbedding || !avatarEmbedding) return 15; // neutral default
  const sim = cosineSimilarity(chunkEmbedding, avatarEmbedding);
  // sim ranges 0..1 (usually 0.1..0.9 for semantically related text)
  return Math.max(0, Math.min(30, Math.round(sim * 30)));
}

function scoreAuthority(source: SourceKind): number {
  return AUTHORITY_BY_SOURCE[source] ?? AUTHORITY_BY_SOURCE.other;
}

export interface ScoreInput {
  text: string;
  source: SourceKind;
  chunkEmbedding?: Float32Array | null;
  avatarEmbedding?: Float32Array | null;
}

export function scoreChunk(input: ScoreInput): QualityBreakdown {
  const specificity = scoreSpecificity(input.text);
  const emotion = scoreEmotion(input.text);
  const relevance = scoreRelevance(input.chunkEmbedding ?? null, input.avatarEmbedding ?? null);
  const authority = scoreAuthority(input.source);
  return {
    specificity,
    emotion,
    relevance,
    authority,
    total: specificity + emotion + relevance + authority,
  };
}

export function isHighQuality(score: number): boolean { return score >= 60; }
export function isLowQuality(score: number): boolean { return score < 30; }

export interface QualityBucket {
  high: number;    // ≥ 60
  medium: number;  // 30-59
  low: number;     // < 30
  totalChunks: number;
  avgScore: number;
}

export function bucketScores(scores: number[]): QualityBucket {
  const high = scores.filter(s => s >= 60).length;
  const low = scores.filter(s => s < 30).length;
  const medium = scores.length - high - low;
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return { high, medium, low, totalChunks: scores.length, avgScore: avg };
}
