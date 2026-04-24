// ============================================================
// PAWEN — /api/admin/conversations-stats   (Phase V.8)
// Admin-only stats tile for the god panel.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { isAdminRequest } from '@/lib/auth/adminServer';
import { ensureConversationSchema, getConversationStats } from '@/lib/conversations/persistence';

export const maxDuration = 10;

export async function GET(req: Request) {
  const session = requireAdmin(req);
  const legacy = isAdminRequest(req);
  if (session instanceof Response && !legacy) return session;

  await ensureConversationSchema();
  const [last24h, last7d] = await Promise.all([
    getConversationStats(24),
    getConversationStats(24 * 7),
  ]);
  return NextResponse.json({ ok: true, last24h, last7d });
}
