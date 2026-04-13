// ============================================================
// PAWEN — /api/avatars/awareness
// On-demand awareness-level filter. Takes one sub-avatar + one
// awareness level and returns an AwarenessVariant. Non-destructive
// — the caller stacks the result into sub_avatar.awareness_variants[]
// so prior runs are never lost. Re-runnable as many times as the
// user wants.
//
// Uses Opus for best tonal control (small input, small output).
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { extractJSON } from '@/lib/util/extractJson';
import {
  AWARENESS_LEVELS,
  type AwarenessLevel,
  type AwarenessVariant,
  type CoreAvatarInput,
  type SubAvatarV2,
} from '@/lib/avatars/types';
import {
  buildAwarenessSystemPrompt,
  buildAwarenessUserMessage,
} from '@/lib/avatars/enrichPrompts';

export const maxDuration = 120;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-4-6';

type ClaudePayload = Omit<AwarenessVariant, 'id' | 'awareness_level' | 'generated_at' | 'tokens_used'>;

function randomId(): string {
  return `aw_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function callClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      temperature: 0.6,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(110_000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Claude ${response.status}: ${err?.error?.message || 'awareness call failed'}`,
    );
  }

  const data = await response.json();
  const content =
    data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? '';

  return {
    content,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
  };
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      core?: CoreAvatarInput;
      subAvatar?: SubAvatarV2;
      awarenessLevel?: AwarenessLevel;
    };

    const { core, subAvatar, awarenessLevel } = body;

    if (!core || !subAvatar || !awarenessLevel) {
      return NextResponse.json(
        { ok: false, message: 'Missing core, subAvatar, or awarenessLevel' },
        { status: 400 },
      );
    }

    if (!AWARENESS_LEVELS.includes(awarenessLevel)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Invalid awarenessLevel. Expected one of ${AWARENESS_LEVELS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const systemPrompt = buildAwarenessSystemPrompt();
    const userMessage = buildAwarenessUserMessage(core, subAvatar, awarenessLevel);

    const { content, tokensIn, tokensOut } = await callClaude(systemPrompt, userMessage);
    const parsed = extractJSON<ClaudePayload>(content);
    if (!parsed) {
      console.error('[avatars:awareness] JSON parse failed — raw:', content.slice(0, 400));
      return NextResponse.json(
        { ok: false, message: 'Claude returned invalid JSON' },
        { status: 502 },
      );
    }

    const variant: AwarenessVariant = {
      id: randomId(),
      awareness_level: awarenessLevel,
      generated_at: new Date().toISOString(),
      tokens_used: tokensIn + tokensOut,
      headline: String(parsed.headline ?? ''),
      hook: String(parsed.hook ?? ''),
      agitation: String(parsed.agitation ?? ''),
      bridge: String(parsed.bridge ?? ''),
      proof_angle: String(parsed.proof_angle ?? ''),
      cta_style: String(parsed.cta_style ?? ''),
      claude_notes: String(parsed.claude_notes ?? ''),
    };

    await writeAudit(req, session.user, 'avatar.awareness.generate', {
      subAvatarId: subAvatar.id,
      awarenessLevel,
      tokensUsed: variant.tokens_used,
    });

    return NextResponse.json({ ok: true, variant });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[avatars:awareness] error:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
