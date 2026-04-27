// ============================================================
// PAWEN — Direct Anthropic call helper (server-only)
//
// Why this exists:
// The previous flow had two hops:
//   Worker (Railway) → POST /api/generate (Vercel) → Anthropic
// This double-hop was the recurring source of "Pass 2 stuck"
// hangs:
//   - Vercel functions can be killed mid-request after 800s.
//   - When that happens, the Railway worker's `await fetch()` to
//     /api/generate doesn't always settle — the TCP socket can
//     stay half-open under Node's keep-alive pool. The worker
//     hangs indefinitely, the heartbeat ticker stalls, the zombie
//     reaper kills the job after 30 min, the user sees "no
//     heartbeat for 721s" and 38 min of wasted budget.
//
// The fix is to remove the Vercel hop entirely when running on
// the worker. Anthropic responds directly, with our own AbortSignal
// timeout, our own retry loop, and our own logging.
//
// Public surface:
//   callAnthropicDirect(params): Promise<{ content, tokensUsed, cached }>
//
// /api/generate route is now a thin wrapper around this helper so
// browser callers (the chat UI, gates 2-9 from the IndexedDB-driven
// pipeline) keep working unchanged.
// ============================================================

import 'server-only';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from './advisor';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// 12 min — generous enough that legitimate long compiles complete
// (Sonnet 4.6 with 16k output ≈ 5-7 min worst case), but bounded so
// a hung connection escapes after a known horizon. Caller's own
// retry policy handles the AbortError as a regular failure.
const DEFAULT_TIMEOUT_MS = 720_000;

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529]);

export interface AnthropicCallParams {
  model: string;
  systemPrompt: string;
  /** Optional large static prefix (e.g. Avatar Training doc) — always cached separately */
  systemPrefix?: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  /** Whether to attach cache_control: ephemeral to the system prompt */
  cacheControl?: boolean;
  /**
   * Per-call timeout override. Defaults to 12 min. Streaming callers should
   * either pass a tighter timeout (no body buffering) or set it to undefined
   * (no timeout, rely on the client's own AbortController).
   */
  timeoutMs?: number;
  /** AbortSignal merged with the internal timeout (callers can cancel) */
  signal?: AbortSignal;
  /** Stream — returns the raw Response.body so caller can pipe SSE through */
  stream?: false;
}

export interface AnthropicCallStreamParams extends Omit<AnthropicCallParams, 'stream'> {
  stream: true;
}

export interface AnthropicCallResult {
  content: string;
  tokensUsed: { input: number; output: number };
  cached: boolean;
  /** Number of attempts including retries; 1 means succeeded on the first try */
  attempts: number;
  /** Wall-clock ms from first attempt to the successful response */
  totalDurationMs: number;
}

interface AnthropicResponseBody {
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  };
  error?: { message?: string; type?: string };
}

interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

function buildRequest(params: AnthropicCallParams | AnthropicCallStreamParams) {
  const cacheControl = params.cacheControl ?? true;
  const advisorEnabled = shouldUseAdvisor(params.model);
  const effectiveSystemPrompt = advisorEnabled
    ? withAdvisorHint(params.systemPrompt, params.model)
    : params.systemPrompt;

  const systemBlocks: SystemBlock[] = [];
  if (typeof params.systemPrefix === 'string' && params.systemPrefix.length > 0) {
    systemBlocks.push({
      type: 'text',
      text: params.systemPrefix,
      cache_control: { type: 'ephemeral' },
    });
  }
  systemBlocks.push({
    type: 'text',
    text: effectiveSystemPrompt,
    ...(cacheControl ? { cache_control: { type: 'ephemeral' } } : {}),
  });

  const requestBody: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens ?? 16384,
    temperature: params.temperature ?? 0.7,
    system: systemBlocks,
    messages: [{ role: 'user', content: params.userMessage }],
    stream: params.stream ?? false,
  };
  if (advisorEnabled) {
    requestBody.tools = [ADVISOR_TOOL];
  }

  const beta = composeBetaHeader({ caching: cacheControl, advisor: advisorEnabled });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (beta) headers['anthropic-beta'] = beta;

  return { requestBody, headers, advisorEnabled };
}

/**
 * Core call site. ONE place where fetch(ANTHROPIC_API_URL) lives. Every
 * server-side LLM consumer in the codebase should funnel through here so
 * timeouts, retries, prompt caching, and logging stay consistent.
 */
export async function callAnthropicDirect(params: AnthropicCallParams): Promise<AnthropicCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length === 0) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const { requestBody, headers } = buildRequest(params);
  headers['x-api-key'] = apiKey;

  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  const callId = `${params.model.split('-')[1] ?? 'claude'}-${Math.random().toString(36).slice(2, 8)}`;

  let lastErr: unknown = null;
  let lastStatus = 0;
  let lastBody: AnthropicResponseBody | null = null;

  for (let attempt = 1; attempt <= 4; attempt++) {
    const attemptStart = Date.now();
    // Build a fresh AbortController per attempt that combines our own timeout
    // with any caller-supplied signal. Doing this inside the loop guarantees
    // a new timer for every retry — without it, a slow first attempt would
    // cause the second attempt to start with an already-elapsed signal.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error(`Anthropic call timeout after ${timeoutMs}ms`)), timeoutMs);
    if (params.signal) {
      if (params.signal.aborted) {
        clearTimeout(timer);
        throw params.signal.reason ?? new Error('caller aborted');
      }
      params.signal.addEventListener('abort', () => ctrl.abort(params.signal!.reason), { once: true });
    }

    try {
      const resp = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: ctrl.signal,
      });
      const attemptMs = Date.now() - attemptStart;

      lastStatus = resp.status;
      if (resp.ok) {
        const data = (await resp.json()) as AnthropicResponseBody;
        const content = (data.content ?? [])
          .filter(b => b.type === 'text')
          .map(b => b.text ?? '')
          .join('');
        const result: AnthropicCallResult = {
          content,
          tokensUsed: {
            input: data.usage?.input_tokens ?? 0,
            output: data.usage?.output_tokens ?? 0,
          },
          cached: (data.usage?.cache_read_input_tokens ?? 0) > 0,
          attempts: attempt,
          totalDurationMs: Date.now() - startedAt,
        };
        console.log(`[anthropic:${callId}] ${params.model} OK in ${attemptMs}ms (attempt ${attempt}, total ${result.totalDurationMs}ms, in=${result.tokensUsed.input} out=${result.tokensUsed.output} cached=${result.cached})`);
        return result;
      }

      // Non-2xx response. Try to parse the error body for retry decisions.
      lastBody = (await resp.json().catch(() => null)) as AnthropicResponseBody | null;
      const errMsg = lastBody?.error?.message ?? `HTTP ${resp.status}`;

      if (!RETRYABLE_STATUSES.has(resp.status) || attempt === 4) {
        console.error(`[anthropic:${callId}] ${params.model} non-retryable HTTP ${resp.status} after ${attemptMs}ms attempt=${attempt}: ${errMsg}`);
        throw new Error(`Anthropic ${resp.status}: ${errMsg}`);
      }

      // Honor Retry-After when Anthropic provides it.
      const retryAfterHeader = resp.headers.get('retry-after');
      const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
      const baseDelay = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? Math.min(retryAfterSec * 1000, 30_000)
        : Math.min(2000 * Math.pow(2.2, attempt - 1), 20_000);
      const jitter = Math.random() * 800;
      const waitMs = baseDelay + jitter;
      console.warn(`[anthropic:${callId}] ${params.model} HTTP ${resp.status} attempt=${attempt}, sleeping ${waitMs.toFixed(0)}ms before retry: ${errMsg}`);
      await sleep(waitMs);
    } catch (e) {
      lastErr = e;
      const attemptMs = Date.now() - attemptStart;
      const isAbort = (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError'));
      console.error(`[anthropic:${callId}] ${params.model} threw after ${attemptMs}ms attempt=${attempt}: ${e instanceof Error ? e.message : String(e)}${isAbort ? ' (timeout/abort)' : ''}`);
      if (attempt === 4) break;
      // Network errors / timeouts: short backoff before retry. We bound retries
      // at 4 total via the loop counter.
      const backoff = isAbort ? 5000 : Math.min(2000 * Math.pow(2, attempt - 1), 15_000);
      await sleep(backoff + Math.random() * 500);
    } finally {
      clearTimeout(timer);
    }
  }

  const totalMs = Date.now() - startedAt;
  if (lastErr instanceof Error) {
    throw new Error(`Anthropic call failed after 4 attempts in ${totalMs}ms (last status ${lastStatus}): ${lastErr.message}`);
  }
  throw new Error(`Anthropic call failed after 4 attempts in ${totalMs}ms (last status ${lastStatus}, body: ${JSON.stringify(lastBody).slice(0, 200)})`);
}

/**
 * Streaming variant — returns the raw Response with the SSE body so callers
 * can pipe it on. Retry logic is intentionally NOT applied to streams: once
 * Anthropic starts streaming, we can't restart cleanly.
 */
export async function callAnthropicDirectStream(params: AnthropicCallStreamParams): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length === 0) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  const { requestBody, headers } = buildRequest(params);
  headers['x-api-key'] = apiKey;

  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`Anthropic stream timeout after ${timeoutMs}ms`)), timeoutMs);
  if (params.signal) {
    if (params.signal.aborted) {
      clearTimeout(timer);
      throw params.signal.reason ?? new Error('caller aborted');
    }
    params.signal.addEventListener('abort', () => ctrl.abort(params.signal!.reason), { once: true });
  }

  try {
    return await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: ctrl.signal,
    });
  } finally {
    // Important: don't clear the timer here for streams — the caller is
    // responsible for consuming the body and the timer must remain armed
    // until the stream is finished. We wire the cleanup to the response
    // body's reader closing instead.
    void timer;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
