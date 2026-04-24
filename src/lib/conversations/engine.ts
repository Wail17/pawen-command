// ============================================================
// PAWEN — Phase V — Conversation Engine (server-side)
//
// Builds an agent's "conversation mode" system prompt, calls
// Anthropic with the last 15 messages as the thread context,
// returns the agent's reply + usage. Shared by the start/message
// routes. Has no side effects on storage — caller persists.
// ============================================================

import 'server-only';

import { AGENT_PERSONAS, buildPersonaPrompt } from '../agents/personas';
import type { AgentId, Conversation, ConversationMessage, PersonaDistillation, AgentConstitution } from '../kb/types';
import { getSql } from '../db/client';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const AGENT_MODEL_DEFAULT = 'claude-sonnet-4-6';
const AGENT_MODEL_OPUS = 'claude-opus-4-6';

const OPUS_AGENTS = new Set<AgentId>(['marcus', 'alex']);

const TRIM_MESSAGES = 15;
const MAX_MSG_CHARS_IN_CONTEXT = 2000;
const MAX_AGENT_REPLY_TOKENS = 600;

function modelForAgent(agentId: AgentId): string {
  return OPUS_AGENTS.has(agentId) ? AGENT_MODEL_OPUS : AGENT_MODEL_DEFAULT;
}

function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  if (model.includes('opus')) {
    return (inputTokens / 1_000_000) * 15 + (outputTokens / 1_000_000) * 75;
  }
  // Sonnet pricing (approx)
  return (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
}

// --- Fetch per-agent distillation + constitution from Neon mirror ---

type MirrorRow = { data: unknown };

async function loadDistillation(agentId: AgentId): Promise<PersonaDistillation | null> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT data FROM persona_distillations_mirror WHERE agent_id = ${agentId} LIMIT 1
    `) as MirrorRow[];
    return rows[0]?.data ? (rows[0].data as PersonaDistillation) : null;
  } catch {
    return null;
  }
}

async function loadConstitution(agentId: AgentId): Promise<AgentConstitution | null> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT data FROM agent_constitutions_mirror WHERE agent_id = ${agentId} LIMIT 1
    `) as MirrorRow[];
    return rows[0]?.data ? (rows[0].data as AgentConstitution) : null;
  } catch {
    return null;
  }
}

// --- Build system prompt for an agent in conversation mode ---

export async function buildAgentSystemPrompt(params: {
  agentId: AgentId;
  conversation: Conversation;
}): Promise<string> {
  const { agentId, conversation } = params;
  const persona = AGENT_PERSONAS[agentId];
  if (!persona) throw new Error(`Unknown persona: ${agentId}`);

  const [distillation, constitution] = await Promise.all([
    loadDistillation(agentId),
    loadConstitution(agentId),
  ]);

  // V.12 — Phase V depends on Phase U. When an agent has no distillation,
  // they participate on legacy persona only (still fine) but we log a
  // warning so the admin knows downstream quality will be lower.
  if (!distillation) {
    console.warn(`[phase-v] ${agentId} participating without distillation (U.1 missing) — legacy persona only, quality will be degraded. Conversation ${conversation.id}.`);
  }

  return buildPersonaPrompt(persona, {
    distillation,
    constitution,
    mode: 'conversation',
    conversationTopic: conversation.topic,
    participants: conversation.participants,
  });
}

// --- Build Anthropic messages array from a thread ---

export function buildThreadMessages(thread: ConversationMessage[], includeUpTo?: number): Array<{ role: 'user' | 'assistant'; content: string }> {
  const cutoff = includeUpTo ?? thread.length;
  const slice = thread.slice(Math.max(0, cutoff - TRIM_MESSAGES), cutoff);

  // For Anthropic we collapse the whole thread into a single 'user' block
  // so the model sees every teammate's voice with an explicit label. Then
  // we ask it to write its own next turn. We deliberately do NOT use
  // role=assistant for past agent messages — in a multi-agent chat, a given
  // agent's previous message is not "its" assistant history, it's someone
  // else's voice. A single user block preserves that framing.
  const lines = slice.map(m => {
    const label = m.authorType === 'user'
      ? `USER(${m.authorId})`
      : m.authorType === 'system'
        ? 'SYSTEM'
        : m.authorId.toUpperCase();
    return `[${label}] ${m.content.slice(0, MAX_MSG_CHARS_IN_CONTEXT)}`;
  });

  return [{ role: 'user', content: `THREAD TRANSCRIPT (oldest → newest):\n\n${lines.join('\n\n')}\n\nYour turn. Write your next message only — no preamble.` }];
}

// --- Run one agent's turn ---

export interface AgentTurnResult {
  content: string;
  tokensUsed: number;
  costUsd: number;
  model: string;
}

export async function runAgentTurn(params: {
  agentId: AgentId;
  conversation: Conversation;
  thread: ConversationMessage[];
  apiKey: string;
}): Promise<AgentTurnResult | null> {
  const { agentId, conversation, thread, apiKey } = params;
  const systemPrompt = await buildAgentSystemPrompt({ agentId, conversation });
  const messages = buildThreadMessages(thread);
  const model = modelForAgent(agentId);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_AGENT_REPLY_TOKENS,
        temperature: 0.7,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages,
      }),
    });
    if (!res.ok) return null;
    type AnthropicResp = {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    };
    const data = (await res.json()) as AnthropicResp;
    const text = (data.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();
    if (!text) return null;
    const usage = data.usage ?? {};
    const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    const outputTokens = usage.output_tokens ?? 0;
    const tokens = inputTokens + outputTokens;
    return { content: text, tokensUsed: tokens, costUsd: estimateUsd(model, inputTokens, outputTokens), model };
  } catch {
    return null;
  }
}

// --- Force Léa summary when cap/ceiling reached ---

export async function runLeaForceClose(params: {
  conversation: Conversation;
  thread: ConversationMessage[];
  apiKey: string;
  reason: 'cap_reached' | 'cost_ceiling';
}): Promise<AgentTurnResult | null> {
  const { conversation, thread, apiKey, reason } = params;
  const persona = AGENT_PERSONAS.lea;

  const [distillation, constitution] = await Promise.all([
    loadDistillation('lea'),
    loadConstitution('lea'),
  ]);

  const forceClosePrompt = buildPersonaPrompt(persona, {
    distillation,
    constitution,
    mode: 'conversation',
    conversationTopic: conversation.topic,
    participants: conversation.participants,
  }) + `\n\n=== FORCED CLOSE ===
The conversation has hit the ${reason === 'cap_reached' ? 'hard message cap' : 'cost ceiling'}. You MUST end it now. Reply with exactly one line in the format:
CLOSE_CONVERSATION: <one-sentence summary of what was decided, who is responsible, and what happens next>
Do NOT output anything else. No preamble. No reasoning.
=== END FORCED CLOSE ===`;

  const messages = buildThreadMessages(thread);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: AGENT_MODEL_DEFAULT,
        max_tokens: 400,
        temperature: 0.3,
        system: [{ type: 'text', text: forceClosePrompt, cache_control: { type: 'ephemeral' } }],
        messages,
      }),
    });
    if (!res.ok) return null;
    type AnthropicResp = {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    };
    const data = (await res.json()) as AnthropicResp;
    let text = (data.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();
    // Enforce the format
    if (!/^\s*CLOSE_CONVERSATION\s*:/m.test(text)) {
      text = `CLOSE_CONVERSATION: Forced close after ${reason.replace('_', ' ')}. ${text.slice(0, 200)}`;
    }
    const usage = data.usage ?? {};
    const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    const outputTokens = usage.output_tokens ?? 0;
    return {
      content: text,
      tokensUsed: inputTokens + outputTokens,
      costUsd: estimateUsd(AGENT_MODEL_DEFAULT, inputTokens, outputTokens),
      model: AGENT_MODEL_DEFAULT,
    };
  } catch {
    return null;
  }
}
