// ============================================================
// PAWEN — /api/conversations   (Phase V.7)
// GET ?projectId=<id>  → list conversations for a project.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { ensureConversationSchema, listProjectConversations } from '@/lib/conversations/persistence';

export const maxDuration = 10;

export async function GET(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ ok: false, message: 'projectId required' }, { status: 400 });
  }

  await ensureConversationSchema();
  const rows = await listProjectConversations(projectId);
  return NextResponse.json({ ok: true, rows });
}
