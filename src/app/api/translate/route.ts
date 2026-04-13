// ============================================================
// PAWEN — /api/translate — Claude Haiku fast translation
// Used by per-item "🌐" toggle buttons in gate outputs so the user
// can see an instant English translation of Italian/French/ES/DE
// output without losing the original voice.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 30;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { text, targetLanguage = 'English' } = body;

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ message: 'text required' }, { status: 400 });
  }
  if (text.length > 6000) {
    return NextResponse.json({ message: 'text too long (max 6000 chars)' }, { status: 400 });
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0,
        system: `You are a translator. Translate the user's text into ${targetLanguage} as literally and naturally as possible. Preserve tone, intent, emojis and punctuation. Output ONLY the translation — no quotes, no explanation, no preamble.`,
        messages: [{ role: 'user', content: text }],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: err?.error?.message || 'Translation failed' },
        { status: response.status },
      );
    }

    const result = await response.json();
    const translation =
      result.content
        ?.filter((block: { type: string }) => block.type === 'text')
        .map((block: { text: string }) => block.text)
        .join('') ?? '';

    return NextResponse.json({ translation, model: MODEL });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
