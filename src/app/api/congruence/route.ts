// ============================================================
// PAWEN — /api/congruence — Congruence Agent (Sonnet + Opus advisor)
// Lower temperature for strict alignment checking.
// Executor: Sonnet. Advisor: Opus via server-side advisor tool.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from '@/lib/ai/advisor';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { model: requestedModel, systemPrompt, userMessage, maxTokens = 8192 } = body;
  const model: string = requestedModel || 'claude-sonnet-4-6';
  const advisorEnabled = shouldUseAdvisor(model);

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature: 0.2,
    system: [
      {
        type: 'text' as const,
        text: withAdvisorHint(systemPrompt, model),
        cache_control: { type: 'ephemeral' as const },
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

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.error?.message || 'Anthropic API error' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? '';

    return NextResponse.json({
      content,
      tokensUsed: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
