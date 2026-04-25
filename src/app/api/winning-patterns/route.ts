// ============================================================
// PAWEN — /api/winning-patterns   (Phase W stub)
// List winning patterns across the hive. Filter by brandId or gateId.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { isHiveEnabled } from '@/lib/learning/autonomousMode';
import { listWinningPatterns } from '@/lib/hive/persistence';

export const maxDuration = 15;

export async function GET(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId') ?? undefined;
  const gateId = url.searchParams.get('gateId') ?? undefined;
  const limit = Number(url.searchParams.get('limit')) || 50;

  if (!isHiveEnabled()) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      patterns: [],
      note: 'HIVE_ENABLED=0 — no cross-brand pattern sharing active.',
    });
  }

  const patterns = await listWinningPatterns({ brandId, gateId, limit });
  return NextResponse.json({ ok: true, enabled: true, patterns });
}
