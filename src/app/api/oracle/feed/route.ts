// ============================================================
// PAWEN — /api/oracle/feed   (Phase W stub)
// Returns Oracle-generated proposals for the caller's brand.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { isHiveEnabled } from '@/lib/learning/autonomousMode';
import { generateOracleProposals } from '@/lib/hive/oracle';

export const maxDuration = 30;

export async function GET(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId') ?? '';

  if (!isHiveEnabled()) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      proposals: [],
      note: 'Oracle is observing the hive. Feed will populate when HIVE_ENABLED=1.',
    });
  }

  const proposals = await generateOracleProposals(brandId);
  return NextResponse.json({ ok: true, enabled: true, proposals });
}
