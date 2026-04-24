// ============================================================
// PAWEN — /api/avatars/classify
// Backfills recommended_awareness_level + recommended_awareness_reason
// + market_sophistication on a sub-avatar that was generated BEFORE
// these fields existed in the schema. Single Opus call. Non-destructive
// — caller decides how to apply the result.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { extractJSON } from '@/lib/util/extractJson';
import {
  AWARENESS_LEVELS,
  type AwarenessLevel,
  type CoreAvatarInput,
  type MarketSophistication,
  type MarketSophisticationStage,
  type SubAvatarV2,
} from '@/lib/avatars/types';
import {
  buildClassifySystemPrompt,
  buildClassifyUserMessage,
} from '@/lib/avatars/classifyPrompts';

export const maxDuration = 120;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-4-6';

interface ClassificationResult {
  recommended_awareness_level: AwarenessLevel;
  recommended_awareness_reason: string;
  market_sophistication: MarketSophistication;
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
      temperature: 0.3,
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
      `Claude ${response.status}: ${err?.error?.message || 'classify call failed'}`,
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

function normalizeStage(raw: unknown): MarketSophisticationStage {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 3;
  const clamped = Math.max(1, Math.min(5, Math.round(n)));
  return clamped as MarketSophisticationStage;
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      core?: CoreAvatarInput;
      subAvatar?: SubAvatarV2;
    };

    const { core, subAvatar } = body;

    if (!core || !subAvatar) {
      return NextResponse.json(
        { ok: false, message: 'Missing core or subAvatar' },
        { status: 400 },
      );
    }

    const systemPrompt = buildClassifySystemPrompt();
    const userMessage = buildClassifyUserMessage(core, subAvatar);

    const { content, tokensIn, tokensOut } = await callClaude(systemPrompt, userMessage);
    const parsed = extractJSON<{
      recommended_awareness_level?: string;
      recommended_awareness_reason?: string;
      market_sophistication?: Partial<MarketSophistication> & { stage?: unknown };
    }>(content);

    if (!parsed) {
      console.error('[avatars:classify] JSON parse failed — raw:', content.slice(0, 400));
      return NextResponse.json(
        { ok: false, message: 'Claude returned invalid JSON' },
        { status: 502 },
      );
    }

    const lvl = String(parsed.recommended_awareness_level ?? '').toLowerCase() as AwarenessLevel;
    if (!AWARENESS_LEVELS.includes(lvl)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Claude returned invalid awareness level: "${parsed.recommended_awareness_level}"`,
        },
        { status: 502 },
      );
    }

    const ms = parsed.market_sophistication ?? {};
    const classification: ClassificationResult = {
      recommended_awareness_level: lvl,
      recommended_awareness_reason: String(parsed.recommended_awareness_reason ?? ''),
      market_sophistication: {
        stage: normalizeStage(ms.stage),
        stage_name: String(ms.stage_name ?? ''),
        reasoning: String(ms.reasoning ?? ''),
        recommended_approach: String(ms.recommended_approach ?? ''),
        copy_implications: Array.isArray(ms.copy_implications)
          ? ms.copy_implications.map(String).filter(Boolean).slice(0, 8)
          : [],
      },
    };

    await writeAudit(req, session.user, 'avatar.classify.generate', {
      subAvatarId: subAvatar.id,
      awarenessLevel: lvl,
      sophisticationStage: classification.market_sophistication.stage,
      tokensUsed: tokensIn + tokensOut,
    });

    return NextResponse.json({ ok: true, classification });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[avatars:classify] error:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
