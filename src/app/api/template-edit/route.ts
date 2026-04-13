// ============================================================
// PAWEN — /api/template-edit — AI-powered Liquid template editing
// Uses Claude Sonnet for fast edits, streams response.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { buildTemplateEditSystemPrompt, buildTemplateEditUserMessage } from '@/lib/templates/prompts';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from '@/lib/ai/advisor';

export const maxDuration = 120;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json();
  const {
    instruction,
    currentLiquid,
    variables,
    creativeContext,
    editHistory = [],
  } = body;

  if (!instruction || !currentLiquid) {
    return NextResponse.json({ message: 'instruction and currentLiquid are required' }, { status: 400 });
  }

  const systemPrompt = buildTemplateEditSystemPrompt(creativeContext, variables || {}, editHistory);
  const userMessage = buildTemplateEditUserMessage(instruction, currentLiquid);

  const advisorEnabled = shouldUseAdvisor(MODEL);

  const requestBody: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 16384,
    temperature: 0.3,
    system: [{
      type: 'text',
      text: withAdvisorHint(systemPrompt, MODEL),
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: userMessage }],
    stream: true,
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
      signal: AbortSignal.timeout(115_000),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.error?.message || 'Anthropic API error', details: error },
        { status: response.status },
      );
    }

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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: `Template edit error: ${message}` }, { status: 500 });
  }
}
