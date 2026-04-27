// ============================================================
// PAWEN — /api/generate — Claude API (Anthropic) — thin proxy
//
// All logic lives in src/lib/ai/anthropicDirect.ts so that server-
// side callers (the Inngest worker) can bypass this HTTP hop entirely.
// This route remains the single entry point for browser callers
// (chat UI, IndexedDB-driven gates 2-9) and any caller that needs
// the streaming SSE response.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import {
  callAnthropicDirect,
  callAnthropicDirectStream,
} from '@/lib/ai/anthropicDirect';

// Pro plan with Fluid Compute = 800s. Anthropic call timeout is 720s
// inside callAnthropicDirect so we always have a margin to surface a
// clean error to the browser instead of letting Vercel kill us.
export const maxDuration = 800;

export async function POST(req: NextRequest) {
  // Defense-in-depth: even though the proxy gates /api/*, we re-verify
  // here so that any matcher misconfig or internal rewrite can't let
  // unauthed callers burn Anthropic budget.
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'invalid JSON body' }, { status: 400 });
  }
  const {
    model,
    systemPrompt,
    systemPrefix,
    userMessage,
    temperature = 0.7,
    maxTokens = 16384,
    cacheControl = true,
    stream = false,
  } = body ?? {};

  if (typeof model !== 'string' || typeof systemPrompt !== 'string' || typeof userMessage !== 'string') {
    return NextResponse.json({ message: 'model, systemPrompt, userMessage required' }, { status: 400 });
  }

  try {
    if (stream) {
      const upstream = await callAnthropicDirectStream({
        model,
        systemPrompt,
        systemPrefix,
        userMessage,
        temperature,
        maxTokens,
        cacheControl,
        stream: true,
      });
      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        return NextResponse.json(
          { message: err.error?.message ?? `Anthropic stream HTTP ${upstream.status}`, details: err },
          { status: upstream.status },
        );
      }
      const readable = upstream.body;
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

    const result = await callAnthropicDirect({
      model,
      systemPrompt,
      systemPrefix,
      userMessage,
      temperature,
      maxTokens,
      cacheControl,
    });
    return NextResponse.json({
      content: result.content,
      tokensUsed: result.tokensUsed,
      cached: result.cached,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
