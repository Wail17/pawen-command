// ============================================================
// PAWEN — /api/avatars/deep-dive
// On-demand "approfondis encore +". Takes a sub-avatar + optional
// focus hint + prior dives (so the model knows what NOT to repeat)
// and returns a new DeepDiveResult that stacks into
// sub_avatar.deep_dives[]. Re-runnable — each call goes deeper.
//
// Uses Opus because the creative/inferential work benefits from
// it. Output is larger than awareness so maxTokens is higher.
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { extractJSON } from '@/lib/util/extractJson';
import type {
  CoreAvatarInput,
  DeepDiveResult,
  SubAvatarV2,
  VerbatimQuote,
  MicroSegment,
} from '@/lib/avatars/types';
import {
  buildDeepDiveSystemPrompt,
  buildDeepDiveUserMessage,
} from '@/lib/avatars/enrichPrompts';

export const maxDuration = 180;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-4-6';

type ClaudePayload = {
  focus: string;
  new_verbatims: VerbatimQuote[];
  hidden_fears: string[];
  contradictions: string[];
  sharper_triggers: string[];
  micro_segments: MicroSegment[];
  buying_objections: string[];
  meta_story: string;
  claude_notes: string;
};

function randomId(): string {
  return `dd_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
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
      max_tokens: 6144,
      temperature: 0.7,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(170_000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Claude ${response.status}: ${err?.error?.message || 'deep-dive call failed'}`,
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

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((x) => x.length > 0);
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      core?: CoreAvatarInput;
      subAvatar?: SubAvatarV2;
      focus?: string | null;
      priorDives?: DeepDiveResult[];
    };

    const { core, subAvatar } = body;
    const focus = body.focus?.trim() || null;
    const priorDives = Array.isArray(body.priorDives) ? body.priorDives : [];

    if (!core || !subAvatar) {
      return NextResponse.json(
        { ok: false, message: 'Missing core or subAvatar' },
        { status: 400 },
      );
    }

    const systemPrompt = buildDeepDiveSystemPrompt();
    const userMessage = buildDeepDiveUserMessage(core, subAvatar, focus, priorDives);

    const { content, tokensIn, tokensOut } = await callClaude(systemPrompt, userMessage);
    const parsed = extractJSON<ClaudePayload>(content);
    if (!parsed) {
      console.error('[avatars:deep-dive] JSON parse failed — raw:', content.slice(0, 400));
      return NextResponse.json(
        { ok: false, message: 'Claude returned invalid JSON' },
        { status: 502 },
      );
    }

    const dive: DeepDiveResult = {
      id: randomId(),
      generated_at: new Date().toISOString(),
      tokens_used: tokensIn + tokensOut,
      focus: String(parsed.focus ?? focus ?? 'general enrichment'),
      new_verbatims: Array.isArray(parsed.new_verbatims)
        ? parsed.new_verbatims
            .slice(0, 15)
            .map((v): VerbatimQuote => ({
              quote: String(v?.quote ?? '').slice(0, 600),
              source_type: (v?.source_type ?? 'searchWide') as VerbatimQuote['source_type'],
              source_url: String(v?.source_url ?? ''),
              emotion_tag: v?.emotion_tag ?? undefined,
            }))
            .filter((v) => v.quote.length > 10)
        : [],
      hidden_fears: asStringArray(parsed.hidden_fears).slice(0, 10),
      contradictions: asStringArray(parsed.contradictions).slice(0, 10),
      sharper_triggers: asStringArray(parsed.sharper_triggers).slice(0, 10),
      micro_segments: Array.isArray(parsed.micro_segments)
        ? parsed.micro_segments
            .slice(0, 6)
            .map((s) => ({
              name: String(s?.name ?? '').slice(0, 80),
              description: String(s?.description ?? ''),
              what_makes_them_different: String(s?.what_makes_them_different ?? ''),
              recommended_hook: String(s?.recommended_hook ?? ''),
            }))
            .filter((s) => s.name.length > 0)
        : [],
      buying_objections: asStringArray(parsed.buying_objections).slice(0, 10),
      meta_story: String(parsed.meta_story ?? ''),
      claude_notes: String(parsed.claude_notes ?? ''),
    };

    await writeAudit(req, session.user, 'avatar.deepdive.generate', {
      subAvatarId: subAvatar.id,
      priorDives: priorDives.length,
      focus,
      tokensUsed: dive.tokens_used,
    });

    return NextResponse.json({ ok: true, dive });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[avatars:deep-dive] error:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
