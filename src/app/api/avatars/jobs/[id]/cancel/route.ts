// ============================================================
// PAWEN — POST /api/avatars/jobs/[id]/cancel
// Marks a running/pending job as failed with error='Canceled by user'.
// The Vercel after() worker keeps running until its function instance
// dies, but the client polling sees status=failed immediately and
// stops, and any subsequent updateJob from the orphaned worker is a
// no-op against an already-failed row (we don't re-flip it).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { cancelJob } from '@/lib/jobs/db';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ ok: false, message: 'job id required' }, { status: 400 });
  }

  const ok = await cancelJob(id, session.user);
  if (!ok) {
    return NextResponse.json({ ok: false, message: 'job not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
