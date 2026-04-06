// ============================================================
// PAWEN — /api/generate — Claude API (Anthropic)
// Supports: all Claude models, prompt caching, streaming
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

// Allow up to 5 minutes for Opus with large prompts
export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const {
    model,
    systemPrompt,
    userMessage,
    temperature = 0.7,
    maxTokens = 16384,
    cacheControl = true,
    stream = false,
  } = body;

  // Build system blocks with optional cache control
  const systemBlocks = [
    {
      type: 'text' as const,
      text: systemPrompt,
      ...(cacheControl ? { cache_control: { type: 'ephemeral' as const } } : {}),
    },
  ];

  const requestBody = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemBlocks,
    messages: [{ role: 'user', content: userMessage }],
    stream,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  // Enable prompt caching beta
  if (cacheControl) {
    headers['anthropic-beta'] = 'prompt-caching-2024-07-31';
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(270_000), // 4.5 min timeout
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
