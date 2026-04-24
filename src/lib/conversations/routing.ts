// ============================================================
// PAWEN — Phase V.3 — Conversation Routing
//
// Given a thread, decide who speaks next. Hybrid logic:
//   1. Explicit @agent mention in latest message → that agent next.
//   2. SCRAPE_REQUEST marker → Scout next.
//   3. Léa (moderator) Sonnet call → returns { next, reason }.
// Plus parsers for message markers (mentions, SCRAPE_REQUEST, CLOSE).
// ============================================================

import 'server-only';

import type { ConversationMessage } from '../kb/types';

const KNOWN_AGENTS = ['sarah', 'marcus', 'alex', 'nina', 'david', 'lea', 'scout'] as const;
type AgentKey = typeof KNOWN_AGENTS[number];

export interface RoutingDecision {
  next: AgentKey | 'user' | 'none';
  reason: string;
  method: 'explicit_mention' | 'scrape_request' | 'lea_moderator' | 'cap_reached' | 'user_turn' | 'fallback';
  leaCost?: { tokens: number; usd: number };
}

const MENTION_REGEX = /@(sarah|marcus|alex|nina|david|lea|scout)\b/gi;
const SCRAPE_REGEX = /^\s*SCRAPE_REQUEST\s*:\s*(.+)$/m;
const CLOSE_REGEX = /^\s*CLOSE_CONVERSATION\s*:\s*(.+)$/m;

export function parseMentions(content: string): AgentKey[] {
  const seen = new Set<AgentKey>();
  let m: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;
  while ((m = MENTION_REGEX.exec(content)) !== null) {
    const id = m[1].toLowerCase() as AgentKey;
    if ((KNOWN_AGENTS as readonly string[]).includes(id)) seen.add(id);
  }
  return [...seen];
}

export function parseScrapeRequest(content: string): string | null {
  const m = SCRAPE_REGEX.exec(content);
  if (!m) return null;
  return m[1].trim().slice(0, 300);
}

export function parseCloseRequest(content: string, authorId: string): string | null {
  if (authorId !== 'lea') return null;
  const m = CLOSE_REGEX.exec(content);
  if (!m) return null;
  return m[1].trim().slice(0, 800);
}

/**
 * Strip any routing-sensitive markers from the public message body.
 * CLOSE_CONVERSATION / SCRAPE_REQUEST lines are kept inline so the UI can
 * render them as badges — clients know to not treat them as prose.
 */
export function extractMessageMeta(content: string, authorType: 'user' | 'agent' | 'system', authorId: string): {
  mentionedAgents: AgentKey[];
  scrapeRequest?: string;
  closeRequest?: string;
} {
  return {
    mentionedAgents: parseMentions(content),
    scrapeRequest: parseScrapeRequest(content) ?? undefined,
    closeRequest: authorType === 'agent' ? parseCloseRequest(content, authorId) ?? undefined : undefined,
  };
}

// ---- Léa moderator routing call ----

const ROUTING_SYSTEM_PROMPT = `You are Léa, PM of Pawen Agency, silently acting as a thread router — NOT a participant.

You receive a chat transcript between teammates (Sarah, Marcus, Alex, Nina, David, Léa, Scout, plus the human user). Your job: pick exactly ONE next speaker whose input would most move the conversation forward. Do NOT generate a message — only pick who.

Choices:
- "sarah"  — strategy / PMF / positioning
- "marcus" — avatar research / VOC / psychology
- "alex"   — copywriting / hooks / advertorial
- "nina"   — visual creative / image ads
- "david"  — media buying / data / scaling
- "lea"    — only if it's time to summarize or close
- "scout"  — if the thread needs fresh external intel
- "user"   — if the conversation needs the human to answer a question before agents can continue
- "none"   — if the thread has reached a natural close and should end

OUTPUT CONTRACT: reply with VALID JSON ONLY, no fences, no preamble:
{ "next": "<one of the choices above>", "reason": "one short sentence" }

RULES:
- Do not repeat the agent who just spoke unless no one else has substantive input.
- If two agents have been ping-ponging (tagging each other) for 4+ turns, pick someone else or "lea" to close.
- If the thread has already delivered a decision and nothing new is being added, pick "none".`;

interface RoutingModelCallParams {
  apiKey: string;
  model: string;
  thread: ConversationMessage[];
  lastSpeakerId: string;
}

/**
 * Call Sonnet (via direct Anthropic fetch) to decide the next speaker.
 * Pure server-side. Returns `null` on any failure (caller falls back to user).
 */
export async function callLeaRouter(params: RoutingModelCallParams): Promise<{ next: RoutingDecision['next']; reason: string; tokens: number; usd: number } | null> {
  const { apiKey, model, thread, lastSpeakerId } = params;
  if (!apiKey) return null;

  // Show the last 12 messages to keep routing cost low
  const recent = thread.slice(-12);
  const transcript = recent.map(m => {
    const label = m.authorType === 'user' ? `USER(${m.authorId})` : m.authorType === 'system' ? 'SYSTEM' : m.authorId.toUpperCase();
    return `[${label}] ${m.content.slice(0, 800)}`;
  }).join('\n\n');

  const userMessage = `LAST SPEAKER: ${lastSpeakerId}\n\nTRANSCRIPT:\n${transcript}\n\nReply with the JSON routing decision.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        temperature: 0.2,
        system: [
          { type: 'text', text: ROUTING_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) return null;
    type AnthropicResp = {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    };
    const data = (await res.json()) as AnthropicResp;
    const raw = (data.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();
    // Strip code fences defensively
    const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const match = /\{[\s\S]*\}/.exec(unfenced);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { next?: string; reason?: string };
    const next = (parsed.next ?? '').toLowerCase();
    const allowed = [...KNOWN_AGENTS, 'user', 'none'];
    if (!allowed.includes(next)) return null;
    const usage = data.usage ?? {};
    const tokens =
      (usage.input_tokens ?? 0) +
      (usage.output_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0);
    // Rough cost: Sonnet 4.6 ~$3/1M input, $15/1M output. We treat avg $8/1M.
    const usd = (tokens / 1_000_000) * 8;
    return {
      next: next as RoutingDecision['next'],
      reason: (parsed.reason ?? '').slice(0, 200) || 'lea routing decision',
      tokens,
      usd,
    };
  } catch {
    return null;
  }
}

// ---- Top-level decide() used by the message route ----

export interface DecideParams {
  thread: ConversationMessage[];       // full transcript (oldest → newest)
  latest: ConversationMessage;         // the message just written
  leaApiKey?: string;
  leaModel: string;
}

export async function decideNextSpeaker(params: DecideParams): Promise<RoutingDecision> {
  const { thread, latest } = params;

  // 1. SCRAPE_REQUEST marker (any speaker) → Scout next
  if (parseScrapeRequest(latest.content)) {
    return { next: 'scout', reason: 'SCRAPE_REQUEST marker detected', method: 'scrape_request' };
  }

  // 2. Explicit @mention in latest message → that agent next
  const mentions = parseMentions(latest.content).filter(a => a !== latest.authorId);
  if (mentions.length > 0) {
    return { next: mentions[0], reason: `@${mentions[0]} was tagged`, method: 'explicit_mention' };
  }

  // 3. If latest author is user, flip to Léa routing. If latest author is agent,
  //    also use Léa unless the agent tagged no one (then we let Léa decide too).
  const lastSpeakerId = latest.authorType === 'user' ? `user:${latest.authorId}` : latest.authorId;

  if (!params.leaApiKey) {
    // No Anthropic key → safe fallback
    return { next: 'user', reason: 'no routing model available — waiting for user', method: 'fallback' };
  }

  const lea = await callLeaRouter({
    apiKey: params.leaApiKey,
    model: params.leaModel,
    thread,
    lastSpeakerId,
  });

  if (!lea) {
    return { next: 'user', reason: 'routing call failed — waiting for user', method: 'fallback' };
  }

  return {
    next: lea.next,
    reason: lea.reason,
    method: 'lea_moderator',
    leaCost: { tokens: lea.tokens, usd: lea.usd },
  };
}

// ---- Ping-pong detector ----

/**
 * Detect if the last 4 messages are a ping-pong between exactly two agents.
 * If yes, caller should override routing to a third party or to Léa for
 * close. Mitigation for V.11 item 18.
 */
export function detectPingPong(thread: ConversationMessage[]): boolean {
  if (thread.length < 4) return false;
  const last4 = thread.slice(-4).filter(m => m.authorType === 'agent');
  if (last4.length < 4) return false;
  const ids = new Set(last4.map(m => m.authorId));
  if (ids.size !== 2) return false;
  // Pattern A-B-A-B specifically
  return last4[0].authorId === last4[2].authorId && last4[1].authorId === last4[3].authorId;
}
