// ============================================================
// PAWEN — /api/conversations/[id]   (Phase V.7)
// GET full thread + conversation metadata.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { ensureConversationSchema, loadConversation, loadThread } from '@/lib/conversations/persistence';

export const maxDuration = 10;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const { id } = await params;
  await ensureConversationSchema();
  const conv = await loadConversation(id);
  if (!conv) {
    return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
  }
  const messages = await loadThread(id);
  return NextResponse.json({ ok: true, conversation: conv, messages });
}
