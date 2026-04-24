// ============================================================
// PAWEN — Phase V — Conversation dispatch (server-side)
//
// Given a conversation id, repeatedly:
//   1. Load the latest thread from Neon.
//   2. Decide next speaker (V.3 routing).
//   3. If next is an agent, call Anthropic (engine.runAgentTurn).
//   4. Persist the agent message + update conversation stats.
//   5. Check stop conditions: cap reached, cost ceiling, user turn, close.
// Returns a summary of what was dispatched.
//
// This is the shared helper used by /api/conversations/start and
// /api/conversations/[id]/message.
// ============================================================

import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AgentId, Conversation, ConversationMessage } from '../kb/types';
import { runAgentTurn, runLeaForceClose } from './engine';
import { decideNextSpeaker, extractMessageMeta, detectPingPong, parseCloseRequest } from './routing';
import {
  loadConversation,
  loadThread,
  persistMessage,
  updateConversationStats,
  markConversationClosed,
} from './persistence';
import {
  getConversationCostCeilingUsd,
  getConversationMaxMessages,
  getLeaRoutingModel,
} from '../learning/autonomousMode';

const KNOWN_AGENT_IDS: AgentId[] = ['sarah', 'marcus', 'alex', 'nina', 'david', 'lea'];
// `scout` is treated as a pseudo-agent in the conversation — routed to, but
// served by a canned message that announces it'll investigate. Scout's actual
// output arrives via the normal Scout ledger (async), not inline.

export interface DispatchResult {
  turns: Array<{
    agentId: string;
    tokens: number;
    costUsd: number;
    closedConversation: boolean;
    model?: string;
    routingMethod?: string;
    routingReason?: string;
  }>;
  stopReason: 'user_turn' | 'cap_reached' | 'cost_ceiling' | 'closed' | 'max_chain' | 'routing_none' | 'missing_key' | 'pingpong_override' | 'error';
  finalMessageCount: number;
  finalCostUsd: number;
}

async function persistScoutPlaceholder(conversationId: string): Promise<ConversationMessage> {
  const msg: ConversationMessage = {
    id: randomUUID(),
    conversationId,
    authorType: 'agent',
    authorId: 'scout',
    content: `On it — I'll investigate and drop findings in the scout ledger. Back to you.`,
    mentionedAgents: [],
    createdAt: new Date().toISOString(),
    modelUsed: 'scout-stub',
    tokensUsed: 0,
    costUsd: 0,
  };
  await persistMessage(msg);
  return msg;
}

export async function runAgentTurnWithRouting(params: {
  conversationId: string;
  maxChainLength: number;
}): Promise<DispatchResult> {
  const { conversationId, maxChainLength } = params;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { turns: [], stopReason: 'missing_key', finalMessageCount: 0, finalCostUsd: 0 };
  }

  const maxMessages = getConversationMaxMessages();
  const costCeiling = getConversationCostCeilingUsd();
  const leaModel = getLeaRoutingModel();

  const turns: DispatchResult['turns'] = [];

  for (let chain = 0; chain < maxChainLength; chain++) {
    const conv = await loadConversation(conversationId);
    if (!conv) break;
    if (conv.status !== 'active') {
      return { turns, stopReason: 'closed', finalMessageCount: conv.messageCount, finalCostUsd: conv.costUsd };
    }

    const thread = await loadThread(conversationId);
    const latest = thread[thread.length - 1];
    if (!latest) break;

    // Hard-cap / cost-ceiling checks BEFORE dispatching another turn.
    if (conv.messageCount >= maxMessages || conv.costUsd >= costCeiling) {
      const forceReason = conv.messageCount >= maxMessages ? 'cap_reached' : 'cost_ceiling';
      const leaClose = await runLeaForceClose({ conversation: conv, thread, apiKey, reason: forceReason });
      if (leaClose) {
        const closeMsg: ConversationMessage = {
          id: randomUUID(),
          conversationId,
          authorType: 'agent',
          authorId: 'lea',
          content: leaClose.content,
          mentionedAgents: [],
          tokensUsed: leaClose.tokensUsed,
          costUsd: leaClose.costUsd,
          modelUsed: leaClose.model,
          createdAt: new Date().toISOString(),
        };
        await persistMessage(closeMsg);
        await updateConversationStats(conversationId, {
          incMessages: 1,
          incTokens: leaClose.tokensUsed,
          incCostUsd: leaClose.costUsd,
        });
        const summary = parseCloseRequest(leaClose.content, 'lea') ?? undefined;
        await markConversationClosed(conversationId, forceReason, summary);
        turns.push({
          agentId: 'lea',
          tokens: leaClose.tokensUsed,
          costUsd: leaClose.costUsd,
          closedConversation: true,
          model: leaClose.model,
          routingMethod: 'force_close',
          routingReason: forceReason,
        });
      } else {
        await markConversationClosed(conversationId, forceReason);
      }
      return {
        turns,
        stopReason: forceReason,
        finalMessageCount: (conv.messageCount) + (leaClose ? 1 : 0),
        finalCostUsd: (conv.costUsd) + (leaClose?.costUsd ?? 0),
      };
    }

    // Ping-pong detection — if detected, force route to Léa for a close-check.
    let nextOverride: 'lea' | null = null;
    if (detectPingPong(thread)) {
      nextOverride = 'lea';
    }

    const decision = nextOverride
      ? { next: 'lea' as const, reason: 'ping-pong pattern detected — route to Léa', method: 'fallback' as const }
      : await decideNextSpeaker({ thread, latest, leaApiKey: apiKey, leaModel });

    if (decision.next === 'user') {
      return { turns, stopReason: 'user_turn', finalMessageCount: conv.messageCount, finalCostUsd: conv.costUsd };
    }
    if (decision.next === 'none') {
      // Soft close via Léa summary
      const close = await runLeaForceClose({ conversation: conv, thread, apiKey, reason: 'cap_reached' });
      if (close) {
        const closeMsg: ConversationMessage = {
          id: randomUUID(),
          conversationId,
          authorType: 'agent',
          authorId: 'lea',
          content: close.content,
          mentionedAgents: [],
          tokensUsed: close.tokensUsed,
          costUsd: close.costUsd,
          modelUsed: close.model,
          createdAt: new Date().toISOString(),
        };
        await persistMessage(closeMsg);
        await updateConversationStats(conversationId, {
          incMessages: 1,
          incTokens: close.tokensUsed,
          incCostUsd: close.costUsd,
        });
        const summary = parseCloseRequest(close.content, 'lea') ?? undefined;
        await markConversationClosed(conversationId, 'lea_summary', summary);
      } else {
        await markConversationClosed(conversationId, 'lea_summary');
      }
      return { turns, stopReason: 'routing_none', finalMessageCount: conv.messageCount + 1, finalCostUsd: conv.costUsd };
    }

    // Scout = canned placeholder — does not consume tokens, does not count toward cap much
    if (decision.next === 'scout') {
      const scoutMsg = await persistScoutPlaceholder(conversationId);
      await updateConversationStats(conversationId, { incMessages: 1 });
      turns.push({
        agentId: 'scout',
        tokens: 0,
        costUsd: 0,
        closedConversation: false,
        routingMethod: decision.method,
        routingReason: decision.reason,
      });
      void scoutMsg;
      continue;
    }

    // Regular agent turn
    const agentId = decision.next as AgentId;
    if (!KNOWN_AGENT_IDS.includes(agentId)) {
      return { turns, stopReason: 'error', finalMessageCount: conv.messageCount, finalCostUsd: conv.costUsd };
    }

    const turn = await runAgentTurn({ agentId, conversation: conv, thread, apiKey });
    if (!turn) {
      return { turns, stopReason: 'error', finalMessageCount: conv.messageCount, finalCostUsd: conv.costUsd };
    }

    const meta = extractMessageMeta(turn.content, 'agent', agentId);
    const agentMsg: ConversationMessage = {
      id: randomUUID(),
      conversationId,
      authorType: 'agent',
      authorId: agentId,
      content: turn.content,
      mentionedAgents: meta.mentionedAgents,
      scrapeRequest: meta.scrapeRequest,
      closeRequest: !!meta.closeRequest,
      tokensUsed: turn.tokensUsed,
      costUsd: turn.costUsd,
      modelUsed: turn.model,
      createdAt: new Date().toISOString(),
    };
    await persistMessage(agentMsg);
    const routingCost = decision.leaCost?.tokens ?? 0;
    const routingUsd = decision.leaCost?.usd ?? 0;
    await updateConversationStats(conversationId, {
      incMessages: 1,
      incTokens: turn.tokensUsed + routingCost,
      incCostUsd: turn.costUsd + routingUsd,
    });
    turns.push({
      agentId,
      tokens: turn.tokensUsed + routingCost,
      costUsd: turn.costUsd + routingUsd,
      closedConversation: false,
      model: turn.model,
      routingMethod: decision.method,
      routingReason: decision.reason,
    });

    // Agent emitted CLOSE_CONVERSATION → finalize
    if (agentMsg.closeRequest && agentId === 'lea') {
      const summary = meta.closeRequest;
      await markConversationClosed(conversationId, 'lea_summary', summary);
      turns[turns.length - 1].closedConversation = true;
      const c2 = await loadConversation(conversationId);
      return {
        turns,
        stopReason: 'closed',
        finalMessageCount: c2?.messageCount ?? conv.messageCount + 1,
        finalCostUsd: c2?.costUsd ?? conv.costUsd + turn.costUsd,
      };
    }
  }

  const finalConv = await loadConversation(conversationId);
  return {
    turns,
    stopReason: 'max_chain',
    finalMessageCount: finalConv?.messageCount ?? 0,
    finalCostUsd: finalConv?.costUsd ?? 0,
  };
}
