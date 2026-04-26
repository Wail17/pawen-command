// ============================================================
// PAWEN — /api/avatars/rerank-items   (Phase U.4.7+, Phase 2.7)
//
// Cross-encoder relevance reranking via Voyage `rerank-2-lite`.
// Called from runAvatarExcavation right after Phase 2.6 dedup, before
// the analyzer LLMs run. Drops items whose relevance to the user's
// surface_desire is below `minScore` (default 0.02 — the noise floor),
// then sorts the kept items by score descending so analyzers see the
// highest-signal verbatims first.
//
// Costs: $0.02 per 1M tokens on rerank-2-lite. ~$0.005 per 200-item
// excavation (typical body ≈ 250k tokens at ~1.25k chars/item avg).
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { VoyageEmbeddingAdapter } from '@/lib/sources/providers/voyageEmbeddingAdapter';
import type { RawSourceItem } from '@/lib/avatars/types';

export const maxDuration = 120;

interface ReqBody {
  items?: RawSourceItem[];
  query?: string;        // the relevance anchor — usually surface_desire
  minScore?: number;     // drop below this (0..1)
  topN?: number;         // hard cap after sort (defensive)
}

// Sentinel score saved on items that failed to score (kept, neutral).
const NEUTRAL_SCORE = 0.5;

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body: ReqBody;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const items = body.items ?? [];
  const query = (body.query ?? '').trim();
  const minScore = body.minScore ?? 0.02;
  const topN = body.topN ?? 1000;

  if (items.length === 0 || !query) {
    return NextResponse.json({ ok: true, kept: items, before: items.length, after: items.length, dropped: 0, durationMs: 0 });
  }
  // Hard upper cap to bound rerank cost — rare in practice.
  if (items.length > 1000) {
    return NextResponse.json({ ok: false, message: `Too many items (${items.length} > 1000 cap)` }, { status: 400 });
  }

  const t0 = Date.now();
  // Build the document string per item: title + first 1500 chars of content.
  // Tighter than dedup (which used 800) — rerank benefits from more context.
  const docs = items.map(it => `${it.title ?? ''}\n${(it.content ?? '').slice(0, 1500)}`.trim());

  const adapter = new VoyageEmbeddingAdapter();
  let scored: Array<{ item: RawSourceItem; score: number }>;
  try {
    const results = await adapter.rerank(query, docs);
    // Map index → score. Voyage may not return entries for empty docs;
    // default missing to NEUTRAL so we don't drop them on a quirk.
    const scoreByIdx = new Map<number, number>();
    for (const r of results) scoreByIdx.set(r.index, r.score);
    scored = items.map((item, i) => ({ item, score: scoreByIdx.get(i) ?? NEUTRAL_SCORE }));
  } catch (e) {
    // Rerank failure is non-fatal — return items unchanged.
    return NextResponse.json({
      ok: true,
      kept: items,
      before: items.length,
      after: items.length,
      dropped: 0,
      durationMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
      mode: 'fallback-passthrough',
    });
  }

  const dropped = scored.filter(s => s.score < minScore).length;
  const kept = scored
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  // Stamp the relevance score onto each item's metadata so downstream
  // (UI, gates, qualityScore) can use it without re-running rerank.
  const keptWithScore: RawSourceItem[] = kept.map(({ item, score }) => ({
    ...item,
    metadata: { ...(item.metadata ?? {}), relevance_score: Number(score.toFixed(4)) },
  }));

  return NextResponse.json({
    ok: true,
    kept: keptWithScore,
    before: items.length,
    after: keptWithScore.length,
    dropped,
    minScore,
    topScore: kept[0]?.score ?? null,
    medianScore: kept[Math.floor(kept.length / 2)]?.score ?? null,
    durationMs: Date.now() - t0,
  });
}
