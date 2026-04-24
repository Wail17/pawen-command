// ============================================================
// PAWEN — Deep-Dive Job Worker
//
// Runs the "Approfondis encore +" pipeline in the BACKGROUND via
// Next.js `after()`. The user fires the start endpoint, gets a
// jobId immediately, can close the tab — the worker continues
// hammering Opus until it returns. State + result are checkpointed
// to pipeline_jobs, the client polls `/api/avatars/jobs/{id}`.
//
// Mirrors the architecture of avatarWorker.ts. Output schema is
// identical to the synchronous /api/avatars/deep-dive route, so
// the existing append helper (appendDeepDive) on the client side
// keeps working unchanged once the result hydrates.
// ============================================================

import 'server-only';
import { extractJSON } from '@/lib/util/extractJson';
import type {
  CoreAvatarInput,
  DeepDiveResult,
  MicroSegment,
  SubAvatarV2,
  VerbatimQuote,
} from '@/lib/avatars/types';
import {
  buildDeepDiveSystemPrompt,
  buildDeepDiveUserMessage,
} from '@/lib/avatars/enrichPrompts';
import { updateJob } from './db';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-4-6';

interface RunDeepDiveJobParams {
  jobId: string;
  core: CoreAvatarInput;
  subAvatar: SubAvatarV2;
  focus: string | null;
  priorDives: DeepDiveResult[];
}

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

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((x) => x.length > 0);
}

async function callClaude(systemPrompt: string, userMessage: string) {
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
      max_tokens: 10000,
      temperature: 0.7,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userMessage }],
    }),
    // Abort 5s before the 300s function cap so we surface a clean error
    // rather than letting Vercel hard-kill mid-stream.
    signal: AbortSignal.timeout(290_000),
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

export async function runDeepDiveJob(params: RunDeepDiveJobParams): Promise<void> {
  const { jobId, core, subAvatar, focus, priorDives } = params;

  try {
    await updateJob(jobId, {
      status: 'running',
      phase: 'calling_opus',
      progress: {
        phase: 'analyzing',
        message: `Excavating ${subAvatar.nickname} across 7 dimensions…`,
        percent: 20,
      },
    });

    const systemPrompt = buildDeepDiveSystemPrompt();
    const userMessage = buildDeepDiveUserMessage(core, subAvatar, focus, priorDives);

    const { content, tokensIn, tokensOut } = await callClaude(systemPrompt, userMessage);

    await updateJob(jobId, {
      phase: 'parsing',
      progress: { phase: 'compiling', message: 'Parsing Opus response…', percent: 80 },
      bumpTick: true,
    });

    const parsed = extractJSON<ClaudePayload>(content);
    if (!parsed) {
      const message = 'Claude returned invalid JSON';
      console.error(`[deepDiveWorker:${jobId}] JSON parse failed — raw:`, content.slice(0, 400));
      await updateJob(jobId, {
        status: 'failed',
        phase: 'error',
        error: message,
        progress: { phase: 'error', message, percent: 0 },
      });
      return;
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

    await updateJob(jobId, {
      status: 'completed',
      phase: 'done',
      progress: {
        phase: 'done',
        message: `Done — ${dive.new_verbatims.length} new verbatims, ${dive.hidden_fears.length} hidden fears`,
        percent: 100,
      },
      result: {
        dive,
        subAvatarId: subAvatar.id,
        totalTokens: { input: tokensIn, output: tokensOut },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[deepDiveWorker:${jobId}] crashed:`, err);
    await updateJob(jobId, {
      status: 'failed',
      phase: 'error',
      error: message,
      progress: { phase: 'error', message, percent: 0 },
    }).catch(() => {});
  }
}
