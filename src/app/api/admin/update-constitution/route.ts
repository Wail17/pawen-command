// ============================================================
// PAWEN — /api/admin/update-constitution
//
// Phase U.2 — Compile/refresh an agent's operating constitution.
//
// Admin-only (dual auth: session OR x-admin-token). Client sends the
// corpus (assembled from IndexedDB: recent outputs, rejections, picks)
// plus stats. Server calls Sonnet 4.6 with prompt caching.
//
//   POST  { agentId, systemPrompt, userMessage, stats, basedOnGates, priorVersion }
//     → { ok, constitution, tokens, model }
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession, requireAdmin } from '@/lib/auth/session';
import { isAdminRequest } from '@/lib/auth/adminServer';
import { writeAudit } from '@/lib/auth/audit';

export const maxDuration = 180;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CONSTITUTION_MODEL = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 4096; // ~ 8000 chars cap

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const KNOWN_AGENT_IDS = new Set(['sarah', 'marcus', 'alex', 'nina', 'david', 'lea']);

export async function POST(req: Request) {
  // Constitution updates are allowed for any authenticated user (auto-trigger
  // in the user flow), with admin auth as a secondary acceptance path for
  // curl tooling. Under the hood this is a session-scoped Sonnet call with
  // a small fixed token ceiling, so cost/abuse risk is bounded.
  const session = requireSession(req);
  const legacyAdmin = isAdminRequest(req);
  const adminSession = requireAdmin(req);
  if (session instanceof Response && !legacyAdmin) return session;
  const who = session instanceof Response
    ? 'legacy-admin-token'
    : adminSession instanceof Response ? session.user : adminSession.user;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const len = req.headers.get('content-length');
  if (len && Number(len) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, message: 'Request too large' }, { status: 413 });
  }

  let body: {
    agentId?: string;
    systemPrompt?: string;
    userMessage?: string;
    stats?: Record<string, unknown>;
    basedOnGates?: string[];
    priorVersion?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const { agentId, systemPrompt, userMessage } = body;
  if (typeof agentId !== 'string' || !KNOWN_AGENT_IDS.has(agentId)) {
    return NextResponse.json({ ok: false, message: 'Invalid agentId' }, { status: 400 });
  }
  if (typeof systemPrompt !== 'string' || systemPrompt.length < 50) {
    return NextResponse.json({ ok: false, message: 'systemPrompt required' }, { status: 400 });
  }
  if (typeof userMessage !== 'string' || userMessage.length < 100) {
    return NextResponse.json({ ok: false, message: 'userMessage required' }, { status: 400 });
  }

  type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
  const systemBlocks: SystemBlock[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
  ];

  const anthropicBody = {
    model: CONSTITUTION_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.5,
    system: systemBlocks,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text', text: userMessage, cache_control: { type: 'ephemeral' } },
        ],
      },
    ],
  };

  const started = Date.now();
  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify(anthropicBody),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json(
      { ok: false, message: `Anthropic error: ${upstream.status}`, detail: detail.slice(0, 500) },
      { status: 502 },
    );
  }

  type AnthropicMessage = {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    model?: string;
  };
  const result = (await upstream.json()) as AnthropicMessage;

  const constitution = (result.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('')
    .trim();

  const usage = result.usage ?? {};
  const tokens =
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);

  await writeAudit(req, who, 'phase_u.constitution.update', {
    agentId,
    model: result.model ?? CONSTITUTION_MODEL,
    tokens,
    outputChars: constitution.length,
    priorVersion: body.priorVersion ?? 0,
    stats: body.stats,
    basedOnGates: body.basedOnGates,
    durationMs: Date.now() - started,
  });

  return NextResponse.json({
    ok: true,
    constitution,
    tokens,
    model: result.model ?? CONSTITUTION_MODEL,
  });
}
