// ============================================================
// PAWEN — Cross-Source Signal Validation (Phase 3.75)
// Runs AFTER per-source analyzers, BEFORE compile.
// Cross-references signals across sources to build a confidence matrix.
// Signals confirmed by 3+ sources = HIGH confidence.
// ============================================================

import type { SourceAnalysis, SourceType } from './types';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface CrossSourceSignal {
  signal: string;            // the theme/pattern
  type: 'emotion' | 'experience' | 'behavior' | 'trigger' | 'objection' | 'identity';
  confidence: ConfidenceLevel;
  source_count: number;      // how many sources confirmed this
  sources: SourceType[];     // which sources
  supporting_verbatims: Array<{ quote: string; source: SourceType }>;
}

// A verbatim quote whose sentiment appears across ≥2 independent sources.
// These are the highest-quality picks for sub-avatar verbatim_quotes.
export interface ConfirmedVerbatim {
  quote: string;             // the canonical quote (longest of the cluster)
  sources: SourceType[];     // all sources where this sentiment appeared
  source_count: number;      // length of sources
  similar_quotes: Array<{ quote: string; source: SourceType }>; // up to 3 alternates
}

export interface SignalConfidenceMatrix {
  generated_at: string;
  total_signals: number;
  high_confidence: CrossSourceSignal[];
  medium_confidence: CrossSourceSignal[];
  low_confidence: CrossSourceSignal[];
  confirmed_verbatims: ConfirmedVerbatim[];
  // Summary stats for the compile prompt
  strongest_themes: string[];     // top 5 themes by cross-source validation
  weakest_areas: string[];        // signal types with mostly low confidence
  source_quality_ranking: Array<{ source: SourceType; signal_strength: number }>;
}

// Normalize a signal string for fuzzy matching
function normalizeSignal(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two signals are semantically similar (fuzzy word overlap)
function signalsSimilar(a: string, b: string): boolean {
  const aNorm = normalizeSignal(a);
  const bNorm = normalizeSignal(b);
  if (aNorm === bNorm) return true;

  // Word overlap: if 60%+ of words from the shorter string appear in the longer one
  const aWords = new Set(aNorm.split(' ').filter(w => w.length > 2));
  const bWords = new Set(bNorm.split(' ').filter(w => w.length > 2));
  if (aWords.size === 0 || bWords.size === 0) return false;

  const smaller = aWords.size <= bWords.size ? aWords : bWords;
  const larger = aWords.size <= bWords.size ? bWords : aWords;

  let overlap = 0;
  for (const word of smaller) {
    if (larger.has(word)) overlap++;
  }

  return overlap / smaller.size >= 0.6;
}

interface RawSignalEntry {
  text: string;
  type: CrossSourceSignal['type'];
  source: SourceType;
  verbatim?: { quote: string; source: SourceType };
}

export function buildConfidenceMatrix(
  analyses: Array<{ source: SourceType; analysis: SourceAnalysis }>,
): SignalConfidenceMatrix {
  // 1) Flatten all signals into a unified pool with source attribution
  const allSignals: RawSignalEntry[] = [];

  for (const { source, analysis } of analyses) {
    // Emotions
    for (const e of analysis.emotions ?? []) {
      allSignals.push({ text: e, type: 'emotion', source });
    }
    // Experiences
    for (const e of analysis.experiences ?? []) {
      allSignals.push({ text: e, type: 'experience', source });
    }
    // Behaviors
    for (const b of analysis.behaviors ?? []) {
      allSignals.push({ text: b, type: 'behavior', source });
    }
    // Triggers
    for (const t of analysis.triggers ?? []) {
      allSignals.push({ text: t, type: 'trigger', source });
    }
    // Objections (Phase O new field)
    for (const o of analysis.objection_clusters ?? []) {
      allSignals.push({ text: o, type: 'objection', source });
    }
    // Identity statements (Phase O new field)
    for (const id of analysis.identity_statements ?? []) {
      allSignals.push({ text: id, type: 'identity', source });
    }
    // Past attempts (map to experience)
    for (const p of analysis.past_attempts_failures ?? []) {
      allSignals.push({ text: p, type: 'experience', source });
    }
    // Attach top verbatims for evidence
    for (const v of (analysis.verbatim_quotes ?? []).slice(0, 8)) {
      allSignals.push({
        text: v.quote.slice(0, 100),
        type: 'emotion',
        source,
        verbatim: { quote: v.quote.slice(0, 200), source },
      });
    }
  }

  // 2) Cluster similar signals together
  const clusters: Array<{
    representative: string;
    type: CrossSourceSignal['type'];
    entries: RawSignalEntry[];
  }> = [];

  for (const signal of allSignals) {
    let matched = false;
    for (const cluster of clusters) {
      if (cluster.type === signal.type && signalsSimilar(cluster.representative, signal.text)) {
        cluster.entries.push(signal);
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({
        representative: signal.text,
        type: signal.type,
        entries: [signal],
      });
    }
  }

  // 3) Score each cluster by source diversity
  const crossSourceSignals: CrossSourceSignal[] = clusters
    .map(cluster => {
      const sources = [...new Set(cluster.entries.map(e => e.source))];
      const verbatims = cluster.entries
        .filter(e => e.verbatim)
        .map(e => e.verbatim!)
        .slice(0, 5);

      const confidence: ConfidenceLevel =
        sources.length >= 3 ? 'high' :
        sources.length === 2 ? 'medium' : 'low';

      return {
        signal: cluster.representative.slice(0, 200),
        type: cluster.type,
        confidence,
        source_count: sources.length,
        sources,
        supporting_verbatims: verbatims,
      };
    })
    .filter(s => s.signal.length > 5) // drop tiny fragments
    .sort((a, b) => b.source_count - a.source_count);

  // 4) Split by confidence level
  const high = crossSourceSignals.filter(s => s.confidence === 'high');
  const medium = crossSourceSignals.filter(s => s.confidence === 'medium');
  const low = crossSourceSignals.filter(s => s.confidence === 'low');

  // 5) Compute strongest themes (high confidence, sorted by source count)
  const strongest = high
    .slice(0, 5)
    .map(s => `${s.signal} (${s.sources.join(', ')})`);

  // 6) Detect weak areas: signal types with mostly low confidence
  const typeConfidence = new Map<string, { high: number; low: number }>();
  for (const s of crossSourceSignals) {
    const entry = typeConfidence.get(s.type) ?? { high: 0, low: 0 };
    if (s.confidence === 'high') entry.high++;
    else if (s.confidence === 'low') entry.low++;
    typeConfidence.set(s.type, entry);
  }
  const weakAreas = Array.from(typeConfidence.entries())
    .filter(([, v]) => v.low > v.high * 2)
    .map(([type]) => type);

  // 7) Rank sources by signal contribution strength
  const sourceStrength = new Map<SourceType, number>();
  for (const s of crossSourceSignals) {
    for (const src of s.sources) {
      const current = sourceStrength.get(src) ?? 0;
      sourceStrength.set(src, current + (s.confidence === 'high' ? 3 : s.confidence === 'medium' ? 2 : 1));
    }
  }
  const sourceRanking = Array.from(sourceStrength.entries())
    .map(([source, signal_strength]) => ({ source, signal_strength }))
    .sort((a, b) => b.signal_strength - a.signal_strength);

  // 8) Verbatim confirmation — cluster verbatims themselves (not signals) by
  //    fuzzy sentiment overlap, so the compile phase can prioritize quotes
  //    whose underlying sentiment appeared in ≥2 independent sources.
  const confirmedVerbatims = buildVerbatimConfirmation(analyses);

  return {
    generated_at: new Date().toISOString(),
    total_signals: crossSourceSignals.length,
    high_confidence: high.slice(0, 20),
    medium_confidence: medium.slice(0, 20),
    low_confidence: low.slice(0, 15),
    confirmed_verbatims: confirmedVerbatims,
    strongest_themes: strongest,
    weakest_areas: weakAreas,
    source_quality_ranking: sourceRanking,
  };
}

// -------- Verbatim confirmation clustering --------
// Fuzzy-cluster verbatims across sources. A verbatim cluster with ≥2 distinct
// sources = "confirmed" — the same human story showed up independently.
function buildVerbatimConfirmation(
  analyses: Array<{ source: SourceType; analysis: SourceAnalysis }>,
): ConfirmedVerbatim[] {
  interface VEntry {
    quote: string;
    source: SourceType;
  }

  const allQuotes: VEntry[] = [];
  for (const { source, analysis } of analyses) {
    for (const v of (analysis.verbatim_quotes ?? []).slice(0, 20)) {
      const clean = (v.quote ?? '').trim();
      if (clean.length < 15) continue;
      allQuotes.push({ quote: clean, source });
    }
  }

  const clusters: Array<{ reps: VEntry[]; sources: Set<SourceType> }> = [];
  for (const entry of allQuotes) {
    let matched = false;
    for (const cluster of clusters) {
      // Re-use the same fuzzy word-overlap test used for signal clustering.
      if (signalsSimilar(cluster.reps[0].quote, entry.quote)) {
        cluster.reps.push(entry);
        cluster.sources.add(entry.source);
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({ reps: [entry], sources: new Set([entry.source]) });
    }
  }

  return clusters
    .filter((c) => c.sources.size >= 2)
    .map<ConfirmedVerbatim>((c) => {
      // Canonical quote = longest entry in cluster (usually the richest).
      const canonical = c.reps.slice().sort((a, b) => b.quote.length - a.quote.length)[0];
      const alternates = c.reps
        .filter((r) => r.quote !== canonical.quote)
        .slice(0, 3)
        .map((r) => ({ quote: r.quote.slice(0, 200), source: r.source }));
      return {
        quote: canonical.quote.slice(0, 300),
        sources: Array.from(c.sources),
        source_count: c.sources.size,
        similar_quotes: alternates,
      };
    })
    .sort((a, b) => b.source_count - a.source_count)
    .slice(0, 30);
}

// Build a compact prompt block for injection into the compile phase
export function buildConfidenceMatrixPrompt(matrix: SignalConfidenceMatrix): string {
  if (matrix.total_signals === 0) return '';

  const highBlock = matrix.high_confidence
    .slice(0, 10)
    .map(s => `  ✓ [${s.type}] "${s.signal}" — confirmed by ${s.sources.join(', ')}`)
    .join('\n');

  const medBlock = matrix.medium_confidence
    .slice(0, 8)
    .map(s => `  ~ [${s.type}] "${s.signal}" — ${s.sources.join(', ')}`)
    .join('\n');

  const weakBlock = matrix.weakest_areas.length > 0
    ? `\nWEAK AREAS (need more evidence): ${matrix.weakest_areas.join(', ')}`
    : '';

  const confirmedVerbatimBlock = matrix.confirmed_verbatims.length > 0
    ? matrix.confirmed_verbatims
        .slice(0, 15)
        .map((v) => `  ★ "${v.quote.slice(0, 180)}" — confirmed across ${v.sources.join(', ')}`)
        .join('\n')
    : '  (none — verbatims did not cluster across 2+ sources)';

  return `=== CROSS-SOURCE SIGNAL CONFIDENCE ===
HIGH CONFIDENCE (confirmed by 3+ independent sources — build sub-avatars on THESE):
${highBlock || '  (none — data may be too sparse for high-confidence signals)'}

MEDIUM CONFIDENCE (2 sources — usable but verify):
${medBlock || '  (none)'}
${weakBlock}

CONFIRMED VERBATIMS (same sentiment appeared in ≥2 independent sources — use these FIRST in verbatim_quotes arrays):
${confirmedVerbatimBlock}

SOURCE QUALITY: ${matrix.source_quality_ranking.slice(0, 5).map(s => `${s.source}(${s.signal_strength})`).join(' > ')}

INSTRUCTION: Prioritize HIGH confidence signals when clustering sub-avatars. Every sub-avatar's verbatim_quotes array should LEAD with any matching confirmed verbatims before filling in from single-source pools. A sub-avatar built on low-confidence signals should be flagged as speculative.
=== END SIGNAL CONFIDENCE ===`;
}
