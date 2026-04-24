// ============================================================
// PAWEN — /api/conversations/[id]/message   (Phase V.7)
//
// User posts a message to an active conversation. Server persists
// it, then dispatches up to N agent turns via runAgentTurnWithRouting.
//
// POST body: { content: string, maxChainLength?: number }
// ============================================================

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireSession } from '@/lib/auth/session';
import { isConversationsEnabled, getConversationMaxMessages } from '@/lib/learning/autonomousMode';
import {
  ensureConversationSchema,
  loadConversation,
  loadThread,
  persistMessage,
  updateConversationStats,
} from '@/lib/conversations/persistence';
import { runAgentTurnWithRouting } from '@/lib/conversations/dispatch';
import { extractMessageMeta } from '@/lib/conversations/routing';
import { writeAudit } from '@/lib/auth/audit';
import type { ConversationMessage } from '@/lib/kb/types';

export const maxDuration = 180;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
  if (!isConversationsEnabled()) {
    return NextResponse.json(
      { ok: false, message: 'Conversations feature is not enabled' },
      { status: 503 },
    );
  }

  const { id } = await params;

  let body: { content?: string; maxChainLength?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (content.length === 0) {
    return NextResponse.json({ ok: false, message: 'content required' }, { status: 400 });
  }

  await ensureConversationSchema();

  const conv = await loadConversation(id);
  if (!conv) {
    return NextResponse.json({ ok: false, message: 'Conversation not found' }, { status: 404 });
  }
  if (conv.status !== 'active') {
    return NextResponse.json(
      { ok: false, message: 'Conversation is closed — no further messages accepted' },
      { status: 409 },
    );
  }
  if (conv.messageCount >= getConversationMaxMessages()) {
    return NextResponse.json(
      { ok: false, message: 'Message cap reached' },
      { status: 409 },
    );
  }

  const meta = extractMessageMeta(content, 'user', session.user);
  const userMsg: ConversationMessage = {
    id: randomUUID(),
    conversationId: id,
    authorType: 'user',
    authorId: session.user,
    content: content.slice(0, 8000),
    mentionedAgents: meta.mentionedAgents,
    createdAt: new Date().toISOString(),
  };
  await persistMessage(userMsg);
  await updateConversationStats(id, { incMessages: 1 });

  await writeAudit(req, session.user, 'phase_v.conversation.message', {
    conversationId: id,
    messageId: userMsg.id,
    mentionedAgents: meta.mentionedAgents,
    contentLen: content.length,
  });

  const maxChain = Math.max(0, Math.min(8, body.maxChainLength ?? 5));
  const dispatched = await runAgentTurnWithRouting({ conversationId: id, maxChainLength: maxChain });

  const conversation = await loadConversation(id);
  const messages = await loadThread(id);

  return NextResponse.json({
    ok: true,
    conversation,
    messages,
    dispatched,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[conversations/message] error:', err);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
