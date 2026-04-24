// ============================================================
// PAWEN — /api/conversations/start   (Phase V.2 / V.7)
//
// Creates a conversation + inserts the first authored message
// (user or system). Returns { conversation, messages } where
// messages includes the first user message and the first agent
// reply if routing chose an agent.
//
// Body:
//   {
//     projectId: string
//     topic: string
//     participants?: string[]       // default: all 6 + scout
//     firstMessage: { content: string, authorType?: 'user'|'system', authorId?: string }
//     initiatorTrigger?: string     // e.g. 'user:<name>' or 'META_DROP_CRITICAL'
//     maxChainLength?: number       // default 5 — how many agent turns to chain after the first user msg
//   }
// ============================================================

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { isConversationsEnabled } from '@/lib/learning/autonomousMode';
import { ensureConversationSchema, persistConversation, persistMessage, loadConversation, loadThread, updateConversationStats } from '@/lib/conversations/persistence';
import { runAgentTurnWithRouting } from '@/lib/conversations/dispatch';
import type { Conversation, ConversationMessage } from '@/lib/kb/types';

export const maxDuration = 180;

const DEFAULT_PARTICIPANTS = ['sarah', 'marcus', 'alex', 'nina', 'david', 'lea', 'scout'];

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
  if (!isConversationsEnabled()) {
    return NextResponse.json(
      { ok: false, message: 'Conversations feature is not enabled. Set NEXT_PUBLIC_CONVERSATIONS_ENABLED=1.' },
      { status: 503 },
    );
  }

  let body: {
    projectId?: string;
    topic?: string;
    participants?: string[];
    firstMessage?: { content?: string; authorType?: string; authorId?: string };
    initiatorTrigger?: string;
    maxChainLength?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.projectId || typeof body.projectId !== 'string') {
    return NextResponse.json({ ok: false, message: 'projectId required' }, { status: 400 });
  }
  if (!body.topic || typeof body.topic !== 'string' || body.topic.length < 3) {
    return NextResponse.json({ ok: false, message: 'topic required (≥3 chars)' }, { status: 400 });
  }
  const firstContent = body.firstMessage?.content;
  if (typeof firstContent !== 'string' || firstContent.trim().length === 0) {
    return NextResponse.json({ ok: false, message: 'firstMessage.content required' }, { status: 400 });
  }
  const firstAuthorType = body.firstMessage?.authorType === 'system' ? 'system' : 'user';
  const firstAuthorId = body.firstMessage?.authorId ?? (firstAuthorType === 'system' ? 'system' : session.user);

  await ensureConversationSchema();

  const now = new Date().toISOString();
  const conv: Conversation = {
    id: randomUUID(),
    projectId: body.projectId,
    title: body.topic.slice(0, 100),
    status: 'active',
    initiator: firstAuthorType === 'system' ? 'system' : 'user',
    initiatorTrigger: body.initiatorTrigger ?? (firstAuthorType === 'system' ? 'system' : `user:${session.user}`),
    topic: body.topic.slice(0, 500),
    participants: (body.participants && body.participants.length > 0)
      ? body.participants.slice(0, 10)
      : DEFAULT_PARTICIPANTS,
    createdAt: now,
    messageCount: 0,
    tokenCost: 0,
    costUsd: 0,
  };
  await persistConversation(conv);

  const firstMsg: ConversationMessage = {
    id: randomUUID(),
    conversationId: conv.id,
    authorType: firstAuthorType,
    authorId: firstAuthorId,
    content: firstContent.slice(0, 8000),
    mentionedAgents: [],
    createdAt: now,
  };
  await persistMessage(firstMsg);

  await updateConversationStats(conv.id, { incMessages: 1 });

  await writeAudit(req, session.user, 'phase_v.conversation.start', {
    conversationId: conv.id,
    projectId: body.projectId,
    topic: conv.topic,
    initiator: conv.initiator,
    initiatorTrigger: conv.initiatorTrigger,
    participants: conv.participants,
  });

  // Trigger the first agent turn (if any). maxChainLength bounds the loop.
  const maxChain = Math.max(0, Math.min(8, body.maxChainLength ?? 5));
  const dispatched = await runAgentTurnWithRouting({
    conversationId: conv.id,
    maxChainLength: maxChain,
  });

  const conversation = (await loadConversation(conv.id)) ?? conv;
  const messages = await loadThread(conv.id);

  return NextResponse.json({
    ok: true,
    conversation,
    messages,
    dispatched,
  });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[conversations/start] error:', err);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
