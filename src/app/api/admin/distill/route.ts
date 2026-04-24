// ============================================================
// PAWEN — /api/admin/distill
//
// Phase U.1 — Compile a persona's baked-in expertise corpus.
//
// Admin-only. Client sends the already-assembled training payload
// (built from IndexedDB training chunks + curated knowledge); this
// route calls Opus with prompt caching and returns the distilled text.
// The client persists the result to IndexedDB + mirrors to Postgres.
//
//   POST  { agentId, systemPrompt, userMessage, inputStats }
//     → { distilledExpertise, tokens, model }
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { isAdminRequest } from '@/lib/auth/adminServer';
import { writeAudit } from '@/lib/auth/audit';

export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DISTILL_MODEL = 'claude-opus-4-6';
const MAX_OUTPUT_TOKENS = 16_384;

// Hard cap to prevent a runaway client from shipping gigabytes.
const MAX_REQUEST_BYTES = 3 * 1024 * 1024;

type DistillRequest = {
  agentId: string;
  systemPrompt: string;
  userMessage: string;
  inputStats?: {
    chunkCount: number;
    sourceCount: number;
    knowledgeCount: number;
    totalChars: number;
    truncatedChars: number;
  };
};

const KNOWN_AGENT_IDS = new Set(['sarah', 'marcus', 'alex', 'nina', 'david', 'lea']);

export async function POST(req: Request) {
  // Accept both paths (same pattern as /api/admin/db-migrate):
  //   1. Cookie-session admin (new auth)
  //   2. Legacy x-admin-token header (matches ADMIN_PASSWORD)
  const session = requireAdmin(req);
  const legacyAdmin = isAdminRequest(req);
  if (session instanceof Response && !legacyAdmin) return session;

  const who = session instanceof Response ? 'legacy-admin-token' : session.user;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 },
    );
  }

  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { ok: false, message: 'Request body too large' },
      { status: 413 },
    );
  }

  let body: DistillRequest;
  try {
    body = (await req.json()) as DistillRequest;
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { agentId, systemPrompt, userMessage } = body;

  if (typeof agentId !== 'string' || !KNOWN_AGENT_IDS.has(agentId)) {
    return NextResponse.json(
      { ok: false, message: `Unknown agentId: ${String(agentId)}` },
      { status: 400 },
    );
  }
  if (typeof systemPrompt !== 'string' || systemPrompt.length < 50) {
    return NextResponse.json({ ok: false, message: 'systemPrompt required' }, { status: 400 });
  }
  if (typeof userMessage !== 'string' || userMessage.length < 100) {
    return NextResponse.json({ ok: false, message: 'userMessage required' }, { status: 400 });
  }

  // Build system blocks with cache_control — the user message is large and
  // cachable across re-runs with the same payload; the system prompt is
  // persona-scoped and also cached. Stays within prompt-caching beta rules.
  type SystemBlock = {
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral' };
  };
  const systemBlocks: SystemBlock[] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
  ];

  const anthropicBody = {
    model: DISTILL_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.4,
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

  const distilledExpertise = (result.content ?? [])
    .filter(block => block.type === 'text')
    .map(block => block.text ?? '')
    .join('')
    .trim();

  const usage = result.usage ?? {};
  const tokens =
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);

  await writeAudit(req, who, 'phase_u.distill', {
    agentId,
    model: result.model ?? DISTILL_MODEL,
    tokens,
    outputChars: distilledExpertise.length,
    inputStats: body.inputStats,
    durationMs: Date.now() - started,
  });

  return NextResponse.json({
    ok: true,
    distilledExpertise,
    tokens,
    model: result.model ?? DISTILL_MODEL,
  });
}
