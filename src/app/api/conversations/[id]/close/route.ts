// ============================================================
// PAWEN — /api/conversations/[id]/close   (Phase V.7)
// User-initiated close. Marks the conversation closed and (optionally)
// asks Léa for a summary line.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import {
  ensureConversationSchema,
  loadConversation,
  loadThread,
  markConversationClosed,
  persistMessage,
  updateConversationStats,
} from '@/lib/conversations/persistence';
import { runLeaForceClose } from '@/lib/conversations/engine';
import { parseCloseRequest } from '@/lib/conversations/routing';
import { writeAudit } from '@/lib/auth/audit';
import type { ConversationMessage } from '@/lib/kb/types';
import { randomUUID } from 'node:crypto';

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const { id } = await params;
    await ensureConversationSchema();
    const conv = await loadConversation(id);
    if (!conv) {
      return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
    }
    if (conv.status !== 'active') {
      return NextResponse.json({ ok: true, conversation: conv, alreadyClosed: true });
    }

    let body: { askLeaSummary?: boolean } = {};
    try { body = await req.json(); } catch { /* body optional */ }

    let summary: string | undefined;

    if (body.askLeaSummary !== false) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        const thread = await loadThread(id);
        const lea = await runLeaForceClose({ conversation: conv, thread, apiKey, reason: 'cap_reached' });
        if (lea) {
          const closeMsg: ConversationMessage = {
            id: randomUUID(),
            conversationId: id,
            authorType: 'agent',
            authorId: 'lea',
            content: lea.content,
            mentionedAgents: [],
            tokensUsed: lea.tokensUsed,
            costUsd: lea.costUsd,
            modelUsed: lea.model,
            closeRequest: true,
            createdAt: new Date().toISOString(),
          };
          await persistMessage(closeMsg);
          await updateConversationStats(id, {
            incMessages: 1,
            incTokens: lea.tokensUsed,
            incCostUsd: lea.costUsd,
          });
          summary = parseCloseRequest(lea.content, 'lea') ?? undefined;
        }
      }
    }

    await markConversationClosed(id, 'user', summary);
    await writeAudit(req, session.user, 'phase_v.conversation.close', {
      conversationId: id,
      manual: true,
      withSummary: !!summary,
    });
    const updated = await loadConversation(id);
    return NextResponse.json({ ok: true, conversation: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[conversations/close] error:', err, stack);
    return NextResponse.json({ ok: false, message: msg, stack: stack?.slice(0, 1500) }, { status: 500 });
  }
}
