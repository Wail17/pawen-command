// ============================================================
// PAWEN — /api/avatars/dedup-items   (Phase U.4.7 / Phase 2.6)
//
// Cross-source verbatim dedup via Voyage embeddings + cosine 0.92.
// Called from runAvatarExcavation right after Phase 2.5 (raw signal),
// before analyzers run, so the analyzers see fewer duplicate items
// (saves tokens) and richer signal density (better analysis).
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { dedupByCosine } from '@/lib/sources/embeddings';
import type { RawSourceItem } from '@/lib/avatars/types';

export const maxDuration = 120;

interface ReqBody {
  items?: RawSourceItem[];
  threshold?: number;
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body: ReqBody;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const items = body.items ?? [];
  if (items.length === 0) {
    return NextResponse.json({ ok: true, kept: [], collapsed: 0, before: 0, after: 0, durationMs: 0 });
  }
  // Hard cap to bound Voyage cost ($0.02/1M tokens, ~$0.0003 per 100 items).
  if (items.length > 1000) {
    return NextResponse.json({ ok: false, message: `Too many items (${items.length} > 1000 cap)` }, { status: 400 });
  }

  const t0 = Date.now();
  // We dedup on a deterministic text payload — title + first 800 chars of
  // content. Comments are folded into content already by the wrappers.
  const embeddable = items.map((it, i) => ({
    id: `${i}`,
    text: `${it.title ?? ''}\n${(it.content ?? '').slice(0, 800)}`.trim(),
    source: it.source,
    qualityScore: (it.content ?? '').length, // longer = richer, prefer to keep
  }));

  const result = await dedupByCosine(embeddable, body.threshold ?? 0.92);
  const keptIdx = new Set(result.kept.map(k => Number(k.id)));
  const kept = items.filter((_, i) => keptIdx.has(i));

  return NextResponse.json({
    ok: true,
    kept,
    before: items.length,
    after: kept.length,
    collapsed: result.collapsed.length,
    durationMs: Date.now() - t0,
  });
}
