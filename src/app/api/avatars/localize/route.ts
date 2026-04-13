// ============================================================
// PAWEN — /api/avatars/localize
// Single-shot Claude Sonnet pass that takes a reverse-engineered avatar
// (from e.g. a US brand) plus fresh scraped content from the target market
// and returns a localized verbatim bundle in the target language.
//
// The caller (lib/avatars/localizeReverseEngineered.ts) handles the Tavily
// search + Firecrawl scrape client-side via /api/search and /api/scrape.
// This route is ONLY the extraction step — it does no fetching itself.
// That way the big payload stays client→server once (not twice).
// ============================================================

import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { extractJSON } from '@/lib/util/extractJson';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from '@/lib/ai/advisor';
import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';

export const maxDuration = 120;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

type LocalizedBundle = {
  verbatim_quotes: string[];
  emotional_triggers: string[];
  identity_statements: string[];
  localized_fears: string[];
  localized_desires: string[];
  cultural_anchors: string[];
  notes: string;
};

function buildSystemPrompt(targetLanguage: string, targetMarket: string): string {
  return `You are a cultural-localization research analyst. Given a reverse-engineered avatar from one market and fresh scraped content from a DIFFERENT target market, extract the language, emotions and cultural anchors that match the same avatar profile — but expressed in the voice of the new market.

RULES:
- Extract ONLY verbatims actually present in the scraped content. NEVER invent.
- All output strings MUST be in ${targetLanguage}. Translate key concepts naturally; do not copy-paste English.
- Keep verbatim_quotes short (under 40 words), emotionally loaded, first-person when possible.
- Cultural anchors = references that make sense ONLY in ${targetMarket} (brands, habits, pop-culture, institutional references).
- If the scraped content is thin, return fewer items — do NOT pad with generics.
- Output strict JSON matching the schema, no markdown, no prose.`;
}

function buildUserMessage(
  reverse: ReverseEngineeredFunnel,
  scrapedContent: string,
  targetLanguage: string,
  targetMarket: string,
): string {
  return `=== ORIGINAL REVERSE-ENGINEERED AVATAR (source market) ===
Brand: ${reverse.competitor_brand}
Avatar: ${reverse.sub_avatar.name} — ${reverse.sub_avatar.nickname}
Description: ${reverse.sub_avatar.description}
Pain points: ${(reverse.sub_avatar.pain_points || []).join(' | ')}
Desires: ${(reverse.sub_avatar.desires || []).join(' | ')}
Fears: ${(reverse.sub_avatar.fears || []).join(' | ')}
Mechanism: ${reverse.mechanism.name} — ${reverse.mechanism.description}

=== TARGET MARKET ===
Market: ${targetMarket}
Language: ${targetLanguage}

=== FRESH SCRAPED CONTENT (from ${targetMarket} forums, articles, reviews) ===
${scrapedContent.slice(0, 80_000)}

=== TASK ===
Extract how this same avatar profile expresses itself in ${targetMarket}. Same person, different cultural/linguistic skin.

Output JSON schema:
{
  "verbatim_quotes": ["string in ${targetLanguage}", ...],
  "emotional_triggers": ["string in ${targetLanguage}", ...],
  "identity_statements": ["string in ${targetLanguage}", ...],
  "localized_fears": ["string in ${targetLanguage}", ...],
  "localized_desires": ["string in ${targetLanguage}", ...],
  "cultural_anchors": ["string in ${targetLanguage}", ...],
  "notes": "string in ${targetLanguage}"
}`;
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const advisorEnabled = shouldUseAdvisor(MODEL);

  const requestBody: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 4096,
    temperature: 0.6,
    system: [
      {
        type: 'text',
        text: withAdvisorHint(systemPrompt, MODEL),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  };

  if (advisorEnabled) {
    requestBody.tools = [ADVISOR_TOOL];
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  const beta = composeBetaHeader({ caching: true, advisor: advisorEnabled });
  if (beta) headers['anthropic-beta'] = beta;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(110_000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Claude ${response.status}: ${err?.error?.message || 'localize call failed'}`,
    );
  }

  const data = await response.json();
  return (
    data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? ''
  );
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => String(x)).filter(x => x.length > 0);
}

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = (await req.json()) as {
      reverse?: ReverseEngineeredFunnel;
      scrapedContent?: string;
      targetLanguage?: string;
      targetMarket?: string;
    };

    const { reverse, scrapedContent, targetLanguage, targetMarket } = body;

    if (!reverse || !scrapedContent || !targetLanguage || !targetMarket) {
      return NextResponse.json(
        { ok: false, message: 'Missing reverse, scrapedContent, targetLanguage or targetMarket' },
        { status: 400 },
      );
    }

    const systemPrompt = buildSystemPrompt(targetLanguage, targetMarket);
    const userMessage = buildUserMessage(reverse, scrapedContent, targetLanguage, targetMarket);

    const raw = await callClaude(systemPrompt, userMessage);
    const parsed = extractJSON<Record<string, unknown>>(raw);
    if (!parsed) {
      console.error('[avatars:localize] JSON parse failed — raw:', raw.slice(0, 400));
      return NextResponse.json(
        { ok: false, message: 'Claude returned invalid JSON' },
        { status: 502 },
      );
    }

    const bundle: LocalizedBundle = {
      verbatim_quotes: asStringArray(parsed.verbatim_quotes),
      emotional_triggers: asStringArray(parsed.emotional_triggers),
      identity_statements: asStringArray(parsed.identity_statements),
      localized_fears: asStringArray(parsed.localized_fears),
      localized_desires: asStringArray(parsed.localized_desires),
      cultural_anchors: asStringArray(parsed.cultural_anchors),
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };

    await writeAudit(req, session.user, 'avatar.localize.generate', {
      competitor_brand: reverse.competitor_brand,
      targetLanguage,
      targetMarket,
      verbatim_count: bundle.verbatim_quotes.length,
    });

    return NextResponse.json({ ok: true, bundle });
  } catch (err) {
    console.error('[avatars:localize] error:', err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'localize failed' },
      { status: 500 },
    );
  }
}
