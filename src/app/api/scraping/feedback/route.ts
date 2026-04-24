// ============================================================
// PAWEN — /api/scraping/feedback   (Phase U.4.9)
//
// Called by gate runners after a gate completes with the ratio of
// chunks actually used (referenced/quoted) vs. injected. Feeds the
// /admin/scraping-health dashboard low-utility flag.
//
// POST body: { source: string, chunksInjected: number, chunksUsed: number }
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { recordUtilization } from '@/lib/sources/scrapingHealth';

export const maxDuration = 10;

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body: { source?: string; chunksInjected?: number; chunksUsed?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }
  const source = typeof body.source === 'string' ? body.source : '';
  const injected = Number(body.chunksInjected);
  const used = Number(body.chunksUsed);
  if (!source || !Number.isFinite(injected) || !Number.isFinite(used) || injected < 0 || used < 0) {
    return NextResponse.json({ ok: false, message: 'source + chunksInjected + chunksUsed required' }, { status: 400 });
  }
  await recordUtilization(source, injected, used);
  return NextResponse.json({ ok: true });
}
