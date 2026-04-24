// ============================================================
// PAWEN — Phase V.2 — System-initiated conversation starter.
//
// Wrap a direct Neon write + dispatch chain so the Meta cron and
// the distillation pipeline can kick off a conversation without
// going through the HTTP layer.
// ============================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  ensureConversationSchema,
  persistConversation,
  persistMessage,
  updateConversationStats,
  countRecentSystemConversationsForProject,
} from './persistence';
import { runAgentTurnWithRouting } from './dispatch';
import type { Conversation, ConversationMessage } from '../kb/types';

const DEFAULT_PARTICIPANTS = ['sarah', 'marcus', 'alex', 'nina', 'david', 'lea', 'scout'];

export interface SystemStartResult {
  created: boolean;
  skipped?: 'cooldown';
  conversationId?: string;
  dispatched?: unknown;
}

/**
 * Create a system-initiated conversation, seed it with a Léa-authored
 * first message, and run the first agent chain. 6h cooldown per project
 * per brief (V.2).
 */
export async function startSystemConversation(params: {
  projectId: string;
  trigger: string;             // 'META_DROP_CRITICAL', 'DISTILLATION_COMPLETE', etc.
  topic: string;
  openingMessage: string;      // what Léa opens the thread with
  participants?: string[];
  maxChainLength?: number;
}): Promise<SystemStartResult> {
  await ensureConversationSchema();

  const recent = await countRecentSystemConversationsForProject(params.projectId, 6);
  if (recent > 0) {
    return { created: false, skipped: 'cooldown' };
  }

  const now = new Date().toISOString();
  const conv: Conversation = {
    id: randomUUID(),
    projectId: params.projectId,
    title: params.topic.slice(0, 100),
    status: 'active',
    initiator: 'system',
    initiatorTrigger: params.trigger,
    topic: params.topic.slice(0, 500),
    participants: params.participants && params.participants.length > 0
      ? params.participants.slice(0, 10)
      : DEFAULT_PARTICIPANTS,
    createdAt: now,
    messageCount: 0,
    tokenCost: 0,
    costUsd: 0,
  };
  await persistConversation(conv);

  const opening: ConversationMessage = {
    id: randomUUID(),
    conversationId: conv.id,
    authorType: 'agent',
    authorId: 'lea',
    content: params.openingMessage.slice(0, 2000),
    mentionedAgents: [],
    createdAt: now,
    modelUsed: 'seed',
    tokensUsed: 0,
    costUsd: 0,
  };
  await persistMessage(opening);
  await updateConversationStats(conv.id, { incMessages: 1 });

  const dispatched = await runAgentTurnWithRouting({
    conversationId: conv.id,
    maxChainLength: Math.max(0, Math.min(6, params.maxChainLength ?? 3)),
  });

  return { created: true, conversationId: conv.id, dispatched };
}
