// ============================================================
// PAWEN — /api/generate — Claude API (Anthropic)
// Supports: all Claude models, prompt caching, streaming,
// advisor tool (Sonnet/Haiku executors get Opus as a server-side advisor).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from '@/lib/ai/advisor';
import { requireSession } from '@/lib/auth/session';

// Allow up to 5 minutes for Opus with large prompts
export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function POST(req: NextRequest) {
  // Defense-in-depth: even though the proxy gates /api/*, we re-verify
  // here so that any matcher misconfig or internal rewrite can't let
  // unauthed callers burn Anthropic budget.
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const {
    model,
    systemPrompt,
    systemPrefix, // optional large static prefix (e.g. Avatar Training doc) — always cached
    userMessage,
    temperature = 0.7,
    maxTokens = 16384,
    cacheControl = true,
    stream = false,
  } = body;

  // Advisor strategy: Sonnet/Haiku executors get Opus as a server-side
  // advisor. Opus calls stay solo (advising Opus with Opus is pointless).
  const advisorEnabled = typeof model === 'string' && shouldUseAdvisor(model);
  const effectiveSystemPrompt = advisorEnabled
    ? withAdvisorHint(systemPrompt, model)
    : systemPrompt;

  // Build system blocks:
  // - If a systemPrefix is provided, it becomes the first block with its own
  //   cache_control — Anthropic caches the prefix alone, so the cache is shared
  //   across any call that re-uses the same prefix (e.g. all Avatar gate calls).
  // - The phase-specific systemPrompt follows as a second block (cached too if
  //   cacheControl is on, which keeps backwards compat with the single-block
  //   caching behavior). The advisor hint is appended here so it stays in the
  //   cached portion and doesn't bust the prefix cache.
  type SystemBlock = {
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral' };
  };
  const systemBlocks: SystemBlock[] = [];
  if (typeof systemPrefix === 'string' && systemPrefix.length > 0) {
    systemBlocks.push({
      type: 'text',
      text: systemPrefix,
      cache_control: { type: 'ephemeral' },
    });
  }
  systemBlocks.push({
    type: 'text',
    text: effectiveSystemPrompt,
    ...(cacheControl ? { cache_control: { type: 'ephemeral' } } : {}),
  });

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemBlocks,
    messages: [{ role: 'user', content: userMessage }],
    stream,
  };

  if (advisorEnabled) {
    requestBody.tools = [ADVISOR_TOOL];
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  const beta = composeBetaHeader({
    caching: cacheControl,
    advisor: advisorEnabled,
  });
  if (beta) headers['anthropic-beta'] = beta;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(295_000), // ~5 min, just under maxDuration
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.error?.message || 'Anthropic API error', details: error },
        { status: response.status }
      );
    }

    // === STREAMING ===
    if (stream) {
      const readable = response.body;
      if (!readable) {
        return NextResponse.json({ message: 'No response body' }, { status: 500 });
      }

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // === NON-STREAMING ===
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
      cached: (data.usage?.cache_read_input_tokens ?? 0) > 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
