// ============================================================
// PAWEN — /api/hive/checkin   (Phase V client-trigger)
// Called once per browser session when /hive loads. Asks the
// auto-standup orchestrator to pick a stale project and fire a
// Léa standup. Cheap no-op if cooldown / no stale project found.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { runAutoStandup } from '@/lib/conversations/autoStandup';

export const maxDuration = 240;

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;
  const out = await runAutoStandup('login-checkin').catch(() => null);
  return NextResponse.json({ ok: true, ...out });
}
