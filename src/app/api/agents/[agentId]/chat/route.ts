// ============================================================
// PAWEN — /api/agents/[agentId]/chat
//
// 1-on-1 chat with a single agent. Stateless: caller sends the
// full thread and gets the next reply. Server pulls the agent's
// distillation + constitution + memory and injects them as the
// system prompt so the agent speaks with full context.
//
// POST { messages: [{role:'user'|'assistant', content}], project?: { id, niche, name, language } }
//   → { ok, reply: string, tokens, model }
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { AGENT_PERSONAS, buildPersonaPrompt } from '@/lib/agents/personas';
import { getSql } from '@/lib/db/client';
import type { AgentConstitution, AgentId, PersonaDistillation } from '@/lib/kb/types';

export const maxDuration = 60;

const KNOWN: AgentId[] = ['sarah', 'marcus', 'alex', 'nina', 'david', 'lea'];

async function loadDistillation(agentId: AgentId): Promise<PersonaDistillation | null> {
  try {
    const sql = getSql();
    const rows = (await sql`SELECT data FROM persona_distillations_mirror WHERE agent_id = ${agentId} LIMIT 1`) as Array<{ data: unknown }>;
    return rows[0]?.data ? (rows[0].data as PersonaDistillation) : null;
  } catch { return null; }
}
async function loadConstitution(agentId: AgentId): Promise<AgentConstitution | null> {
  try {
    const sql = getSql();
    const rows = (await sql`SELECT data FROM agent_constitutions_mirror WHERE agent_id = ${agentId} LIMIT 1`) as Array<{ data: unknown }>;
    return rows[0]?.data ? (rows[0].data as AgentConstitution) : null;
  } catch { return null; }
}

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const { agentId: rawId } = await params;
  const agentId = rawId.toLowerCase() as AgentId;
  if (!KNOWN.includes(agentId)) {
    return NextResponse.json({ ok: false, message: 'unknown agent' }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  let body: { messages?: Array<{ role: 'user' | 'assistant'; content: string }>; project?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: 'invalid JSON' }, { status: 400 }); }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return NextResponse.json({ ok: false, message: 'messages required' }, { status: 400 });

  const persona = AGENT_PERSONAS[agentId];
  const [distillation, constitution] = await Promise.all([loadDistillation(agentId), loadConstitution(agentId)]);

  const projectBlock = body.project
    ? `\n\n=== CURRENT PROJECT CONTEXT ===\n${JSON.stringify(body.project, null, 2)}\n=== END PROJECT CONTEXT ===`
    : '';

  const systemPrompt = buildPersonaPrompt(persona, {
    distillation,
    constitution,
    mode: 'conversation',
  }) + `

=== 1-ON-1 MODE ===
You are talking directly to the user. There is no team in this thread. Reply in YOUR voice (${persona.name}).
- Keep replies tight: 2-6 sentences unless the user asked for length.
- You may push back on the user when you genuinely disagree (your decisionStyle: ${persona.decisionStyle}).
- If the user issues a directive ("from now on, do X"), confirm you understood it. The system stores it as a high-priority rule for you separately — you don't need to mention it.
- Speak as yourself, not as "an AI assistant".
- NO preamble, NO meta-commentary about being an AI.
=== END 1-ON-1 MODE ===${projectBlock}`;

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: agentId === 'marcus' || agentId === 'alex' ? 'claude-opus-4-6' : 'claude-sonnet-4-6',
      max_tokens: 800,
      temperature: 0.7,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: messages.slice(-30).map(m => ({ role: m.role, content: m.content.slice(0, 8000) })),
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json(
      { ok: false, message: `Anthropic ${upstream.status}`, detail: detail.slice(0, 400) },
      { status: 502 },
    );
  }

  type Resp = { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }; model?: string };
  const data = (await upstream.json()) as Resp;
  const reply = (data.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('').trim();
  const usage = data.usage ?? {};
  const tokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);

  return NextResponse.json({ ok: true, reply, tokens, model: data.model ?? 'claude-sonnet-4-6' });
}
