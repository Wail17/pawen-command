// ============================================================
// PAWEN — Avatar Excavation Pipeline
// Phase 1: Discovery     (1 Sonnet call → plan)
// Phase 2: Fetching      (real scraping — no LLM)
// Phase 3: Per-source Analyzers  (N Sonnet calls, parallel)
// Phase 4: Lead Compile  (1 Opus call → sub-avatars + angles)
//
// Client-side orchestrator. Mirrors the pattern used by runSubAgents.ts
// (relative /api fetch calls, EventEmitter-style callbacks).
// ============================================================

import {
  CoreAvatarInput,
  SourceConfig,
  DEFAULT_SOURCE_CONFIG,
  SourceDiscoveryPlan,
  SourceAnalysis,
  AvatarRunResult,
  AvatarProgressEvent,
  SourceType,
  RawSourceData,
  SubAvatarV2,
  SubAvatarAngles,
  ComparativeRow,
} from './types';
import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';

import { extractJSON } from '../util/extractJson';
import { runSourceFetchers } from '../sources';
import type { RedditDepth } from '../sources/reddit';
import { webSearch, scrapeMany, toRawItem, languageModifier } from '../sources/common';
import { buildRawSignal } from './rawSignal';
import type { RawSignal } from './types';
import {
  buildDiscoverySystemPrompt,
  buildDiscoveryUserMessage,
  buildAnalyzerSystemPrompt,
  buildAnalyzerUserMessage,
  buildCompileSystemPrompt,
  buildCompileUserMessage,
  buildCompileSkeletonUserMessage,
  buildCompileSkeletonSystemPrompt,
  buildAnglesUserMessage,
  buildAnglesSystemPrompt,
} from './prompts';
import { EVOLVE_AVATAR_TRAINING } from './knowledge/evolveAvatarTraining';
import { buildConfidenceMatrix, buildConfidenceMatrixPrompt, type SignalConfidenceMatrix } from './crossSourceValidation';
import { buildAdversarialPrompt, applyAdversarialReport, type AdversarialReport } from './adversarialValidation';
import { rankVerbatims, buildRankedVerbatimsPrompt } from './verbatimRanking';
import { buildSwipeVocabulary, buildSwipeVocabularyPrompt, type SwipeVocabulary } from './swipeVocabulary';

// Shared system-prompt prefix — the EVOLVE methodology doc. Injected into
// analyzer + compile + skeleton + angles calls via the systemPrefix cache block,
// so Anthropic caches it once and every subsequent call hits the cache at 10%
// cost. Wrapped with a short framing header so the model knows what role the
// doc plays in its task.
//
// BASE_AVATAR_KNOWLEDGE_PREFIX is the static methodology. At runtime we fetch
// Marcus's curated team-contributed KB from /api/curated-prefix and prepend it
// so every analyzer/compile call gets both the methodology AND the team's
// evolving playbook in one cached system block.
const BASE_AVATAR_KNOWLEDGE_PREFIX = `# REFERENCE METHODOLOGY — The Evolve Avatar Training

You will receive a task below that requires you to work with customer avatars,
verbatim quotes, emotional triggers, or ad angles. Before you respond, internalize
the methodology in this document. Apply its principles — specificity, relatability,
"that's exactly me" resonance, action-oriented framing — to every decision you
make in the task.

This methodology is the authoritative source of truth for how avatars and angles
should be constructed in this pipeline. When the task below is ambiguous, defer
to what this training says.

---

${EVOLVE_AVATAR_TRAINING}

---

END OF REFERENCE METHODOLOGY. The task-specific instructions follow.`;

// Fetch the team's curated KB for Marcus and render it as a prefix to
// be prepended to BASE_AVATAR_KNOWLEDGE_PREFIX. Runs once per pipeline
// run. Never throws — falls back to just the base prefix on error.
async function buildAvatarKnowledgePrefix(): Promise<string> {
  try {
    const res = await fetch('/api/curated-prefix?agent=marcus');
    if (!res.ok) return BASE_AVATAR_KNOWLEDGE_PREFIX;
    const data = await res.json();
    const curatedPrefix = typeof data?.prefix === 'string' ? data.prefix : '';
    if (!curatedPrefix) return BASE_AVATAR_KNOWLEDGE_PREFIX;
    return `${curatedPrefix}\n\n${BASE_AVATAR_KNOWLEDGE_PREFIX}`;
  } catch (err) {
    if (typeof window !== 'undefined') {
      console.warn('[avatar:curated-prefix] fetch failed, using base only:', err);
    }
    return BASE_AVATAR_KNOWLEDGE_PREFIX;
  }
}

// === CONSTANTS ===

const DISCOVERY_MODEL = 'claude-sonnet-4-6';
const ANALYZER_MODEL = 'claude-sonnet-4-6';
// Compile used to run on Opus, but Opus 4.6 generates at ~70 tok/s, so a 32k
// output request takes 7-8 min and always hits the /api/generate 5-min timeout.
// Sonnet generates at ~120-150 tok/s → same output in ~2-3 min, comfortably
// inside the timeout. Clustering quality is more than sufficient for this task.
const COMPILE_MODEL = 'claude-sonnet-4-6';

// Anthropic free/dev tier rate limit: 30k input tokens / minute on Sonnet 4.6.
// One analyzer call ~= (system prompt 2k) + (raw content 30k) ~= 32k input tokens.
// → run analyzers SEQUENTIALLY with a small spacing, and cap input chars.
// Bumped 80k → 120k for the v2 "deeper research" push: more verbatims per source.
const MAX_ANALYZER_INPUT_CHARS = 120_000; // ~30k input tokens of content
const ANALYZER_SPACING_MS = 3000;         // gap between analyzer calls (rate limit safety)

// Retry config. Rate-limit errors (429/529/503) get long backoffs + 4 retries.
// Other errors (500, network, timeouts) get at most 1 retry with short backoff —
// retrying a 5-min timeout 4 times burns 20 min per call, which is unacceptable.
const MAX_LLM_RETRIES = 4;
const MAX_TIMEOUT_RETRIES = 1;

// === HELPERS ===

interface LLMCallParams {
  model: string;
  systemPrompt: string;
  // Large static prefix that the /api/generate route will put in its own cache
  // block. Used for things like the Avatar Training methodology doc — identical
  // across calls, so Anthropic caches it once and every subsequent call hits
  // the cache at 10% cost.
  systemPrefix?: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}

interface LLMCallResult {
  content: string;
  tokensUsed: { input: number; output: number };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callLLM(params: LLMCallParams): Promise<LLMCallResult> {
  let lastErr: unknown = null;
  let timeoutAttempts = 0;

  for (let attempt = 0; attempt < MAX_LLM_RETRIES; attempt++) {
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: params.model,
          systemPrompt: params.systemPrompt,
          systemPrefix: params.systemPrefix,
          userMessage: params.userMessage,
          temperature: params.temperature ?? 0.5,
          maxTokens: params.maxTokens ?? 8192,
          cacheControl: true,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          content: data.content ?? '',
          tokensUsed: data.tokensUsed ?? { input: 0, output: 0 },
        };
      }

      const err = await res.json().catch(() => ({}));
      const msg: string = err.message || `LLM call failed with status ${res.status}`;
      const isRateLimit = res.status === 429 || /rate limit|exceed your organization/i.test(msg);
      const isOverloaded = res.status === 529 || res.status === 503;
      // 500 errors here are almost always AbortSignal.timeout from /api/generate
      // (the model took too long). Retrying 3 more times = 15+ min wasted.
      const isServerError = res.status >= 500 && !isOverloaded;

      if ((isRateLimit || isOverloaded) && attempt < MAX_LLM_RETRIES - 1) {
        // Rate limit window is 1 minute. Wait long enough to drain the bucket.
        // Backoff: 35s, 65s, 95s.
        const waitMs = 35_000 + attempt * 30_000;
        await sleep(waitMs);
        continue;
      }

      if (isServerError && timeoutAttempts < MAX_TIMEOUT_RETRIES) {
        timeoutAttempts++;
        await sleep(2_000);
        continue;
      }

      throw new Error(msg);
    } catch (e) {
      lastErr = e;
      // True network errors (fetch threw before getting a response) get 1 retry max.
      if (timeoutAttempts < MAX_TIMEOUT_RETRIES) {
        timeoutAttempts++;
        await sleep(2_000);
        continue;
      }
      break;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('LLM call failed after retries');
}

// extractJSON moved to ../util/extractJson — imported above.

function buildAnalyzerInput(raw: RawSourceData): string {
  // Concatenate all items into one bounded text blob.
  const parts: string[] = [];
  let totalLen = 0;
  for (const item of raw.items) {
    const block = `--- ITEM: ${item.url} ---\n${item.title ? `TITLE: ${item.title}\n` : ''}${item.content}`;
    if (totalLen + block.length > MAX_ANALYZER_INPUT_CHARS) {
      const remaining = MAX_ANALYZER_INPUT_CHARS - totalLen;
      if (remaining > 500) parts.push(block.slice(0, remaining));
      break;
    }
    parts.push(block);
    totalLen += block.length;
  }
  return parts.join('\n\n');
}

function estimateCostUSD(tokens: { input: number; output: number }, model: string): number {
  // Rough 4-6 family estimates (USD per MTok)
  const rates: Record<string, { in: number; out: number }> = {
    'claude-opus-4-6': { in: 15, out: 75 },
    'claude-sonnet-4-6': { in: 3, out: 15 },
  };
  const rate = rates[model] ?? rates['claude-sonnet-4-6'];
  return (tokens.input * rate.in + tokens.output * rate.out) / 1_000_000;
}

// === COMPILE CASCADE HELPERS ===
// Phase 4 uses a 3-layer cascade:
//   Layer A — tryFullCompile   : single-shot Opus with 32k tokens + stricter retry
//   Layer B — tryTwoPassCompile: Opus skeleton (no angles) + Sonnet per-sub-avatar angles
//   Layer C — synthesizeMinimalResult : deterministic heuristic fallback from raw analyses
// If all 3 succeed → the user gets the best available quality.
// If only C succeeds → the user still gets a valid AvatarRunResult in the UI.

interface CompileOutput {
  sub_avatars: SubAvatarV2[];
  comparative_table: ComparativeRow[];
  final_recommendation: AvatarRunResult['final_recommendation'];
}

interface CostAccumulator {
  tokens: { input: number; output: number };
  costUSD: number;
}

// ---------- Layer A: full single-shot compile (Sonnet, 16k tokens) ----------
// Output-token budget is the main constraint here: at Sonnet's ~120 tok/s,
// 16k tokens finishes in ~2.2 min — well inside the 5-min /api/generate timeout.
async function tryFullCompile(
  core: CoreAvatarInput,
  analysesText: Record<string, string>,
  acc: CostAccumulator,
  systemPrefix: string,
  onProgress?: (e: AvatarProgressEvent) => void,
): Promise<{ parsed: CompileOutput | null; rawText: string }> {
  onProgress?.({
    phase: 'compiling',
    message: 'Marcus: full single-shot compile (Sonnet, 16k tokens)...',
  });

  const resp = await callLLM({
    model: COMPILE_MODEL,
    systemPrompt: buildCompileSystemPrompt(core),
    systemPrefix,
    userMessage: buildCompileUserMessage(core, analysesText),
    temperature: 0.6,
    maxTokens: 16000,
  });
  acc.tokens.input += resp.tokensUsed.input;
  acc.tokens.output += resp.tokensUsed.output;
  acc.costUSD += estimateCostUSD(resp.tokensUsed, COMPILE_MODEL);

  if (typeof window !== 'undefined') {
    console.log('[compile:full] output head:', resp.content.slice(0, 1000));
    console.log('[compile:full] output tail:', resp.content.slice(-500));
  }

  const parsed = extractJSON<CompileOutput>(resp.content);
  if (parsed) return { parsed, rawText: resp.content };

  // Stricter retry (same token cap) — occasionally the model produces commentary
  // on the first try, and a stricter system prompt fixes it.
  onProgress?.({
    phase: 'compiling',
    message: 'First compile unparseable — retrying with stricter JSON-only prompt...',
  });
  const retryResp = await callLLM({
    model: COMPILE_MODEL,
    systemPrompt:
      'You output ONLY valid JSON inside a ```json fence. No commentary, no preamble, no apology. Always close every string, array and object cleanly. Never get cut off mid-string — if you feel output is getting long, shorten each verbatim quote rather than truncating.',
    systemPrefix,
    userMessage:
      buildCompileUserMessage(core, analysesText) +
      '\n\nIMPORTANT: Output COMPLETE valid JSON. Keep each verbatim quote SHORT (1-2 sentences). NEVER refuse. NEVER explain thin data. Just produce 3-5 sub-avatars with whatever is available.',
    temperature: 0.4,
    maxTokens: 16000,
  });
  acc.tokens.input += retryResp.tokensUsed.input;
  acc.tokens.output += retryResp.tokensUsed.output;
  acc.costUSD += estimateCostUSD(retryResp.tokensUsed, COMPILE_MODEL);

  if (typeof window !== 'undefined') {
    console.log('[compile:full-retry] output head:', retryResp.content.slice(0, 1000));
    console.log('[compile:full-retry] output tail:', retryResp.content.slice(-500));
  }

  const retryParsed = extractJSON<CompileOutput>(retryResp.content);
  return { parsed: retryParsed, rawText: retryResp.content };
}

// ---------- Layer B: chunked 2-pass compile ----------
// Pass 1: Opus produces skeletons (no angles, short verbatims) → small output
// Pass 2: Sonnet generates angles for each skeleton sequentially → one call per SA
type SkeletonSubAvatar = Omit<
  SubAvatarV2,
  'angles' | 'launch_order' | 'recommended_for_test' | 'recommendation_reason'
>;

async function tryTwoPassCompile(
  core: CoreAvatarInput,
  analysesText: Record<string, string>,
  acc: CostAccumulator,
  systemPrefix: string,
  onProgress?: (e: AvatarProgressEvent) => void,
): Promise<{ parsed: CompileOutput | null; rawText: string }> {
  onProgress?.({
    phase: 'compiling',
    message: 'Chunked compile — Pass 1 (Sonnet skeletons, no angles)...',
  });

  // === PASS 1: Sonnet produces sub-avatar skeletons ===
  // No angles in this pass, so 10k tokens is plenty. Sonnet keeps it under 2 min.
  const skeletonResp = await callLLM({
    model: ANALYZER_MODEL,
    systemPrompt: buildCompileSkeletonSystemPrompt(core),
    systemPrefix,
    userMessage: buildCompileSkeletonUserMessage(core, analysesText),
    temperature: 0.5,
    maxTokens: 10000,
  });
  acc.tokens.input += skeletonResp.tokensUsed.input;
  acc.tokens.output += skeletonResp.tokensUsed.output;
  acc.costUSD += estimateCostUSD(skeletonResp.tokensUsed, COMPILE_MODEL);

  if (typeof window !== 'undefined') {
    console.log('[compile:pass1] skeleton head:', skeletonResp.content.slice(0, 1000));
    console.log('[compile:pass1] skeleton tail:', skeletonResp.content.slice(-500));
  }

  const skeleton = extractJSON<{ sub_avatars: SkeletonSubAvatar[] }>(skeletonResp.content);
  if (!skeleton || !Array.isArray(skeleton.sub_avatars) || skeleton.sub_avatars.length === 0) {
    return { parsed: null, rawText: skeletonResp.content };
  }

  onProgress?.({
    phase: 'compiling',
    message: `Pass 1 done: ${skeleton.sub_avatars.length} skeletons. Generating angles (Sonnet, sequential)...`,
  });

  // === PASS 2: Sonnet generates angles per sub-avatar, sequentially ===
  const enrichedSubAvatars: SubAvatarV2[] = [];

  for (let i = 0; i < skeleton.sub_avatars.length; i++) {
    const sa = skeleton.sub_avatars[i];
    onProgress?.({
      phase: 'compiling',
      message: `Pass 2: angles for ${sa.nickname || sa.name} (${i + 1}/${skeleton.sub_avatars.length})...`,
    });

    const summary = {
      id: sa.id,
      name: sa.name,
      nickname: sa.nickname,
      dominant_category: sa.dominant_category,
      description: sa.description,
      top_verbatims: (sa.verbatim_quotes ?? []).slice(0, 15).map(v => v.quote),
      emotional_triggers: sa.emotional_triggers ?? [],
      past_attempts_failures: sa.past_attempts_failures ?? [],
    };

    let angles: SubAvatarAngles | null = null;
    try {
      const anglesResp = await callLLM({
        model: ANALYZER_MODEL, // Sonnet is fast + cheap for the angles task
        systemPrompt: buildAnglesSystemPrompt(core),
        systemPrefix,
        userMessage: buildAnglesUserMessage(summary),
        temperature: 0.6,
        maxTokens: 4096,
      });
      acc.tokens.input += anglesResp.tokensUsed.input;
      acc.tokens.output += anglesResp.tokensUsed.output;
      acc.costUSD += estimateCostUSD(anglesResp.tokensUsed, ANALYZER_MODEL);

      angles = extractJSON<SubAvatarAngles>(anglesResp.content);

      if (typeof window !== 'undefined') {
        console.log(`[compile:pass2:${sa.id}]`, angles ? 'angles parsed OK' : 'angles parse FAILED');
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn(`[compile:pass2:${sa.id}] angles call threw:`, e);
      }
    }

    // Safe fallback angles if the Sonnet call flopped
    const safeAngles: SubAvatarAngles = angles ?? {
      positioning: {
        framework: 'new_mechanism',
        description: `Position ${core.product} as a new way to address ${sa.dominant_category}-driven ${core.niche} pain.`,
        rationale: 'Auto-generated default — angle LLM call failed.',
      },
      hooks: [
        (sa.description ?? '').split('.')[0] || sa.name,
        `Have you tried everything for ${core.surface_desire}?`,
        `What if the real cause was ${sa.dominant_category}?`,
      ],
      story_angle: {
        problem: sa.description ?? '',
        agitation: (sa.past_attempts_failures ?? []).slice(0, 2).join('; '),
        solution: core.product,
        mechanism: 'A new approach.',
        cta: `Discover ${core.product}.`,
      },
    };

    enrichedSubAvatars.push({
      ...sa,
      angles: safeAngles,
      launch_order: i + 1,
      recommended_for_test: false, // set properly below
      recommendation_reason: '',
    });

    // Rate-limit spacing between Sonnet calls
    if (i < skeleton.sub_avatars.length - 1) {
      await sleep(2000);
    }
  }

  // === Assemble comparative_table + final_recommendation deterministically ===
  let bestIdx = 0;
  let bestScore = -1;
  enrichedSubAvatars.forEach((sa, idx) => {
    const score = ((sa.urgency_score ?? 0) + (sa.scope_score ?? 0)) / 2;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  enrichedSubAvatars.forEach((sa, idx) => {
    sa.recommended_for_test = idx === bestIdx;
    if (idx === bestIdx) {
      sa.recommendation_reason = `Best urgency × scope balance (U${sa.urgency_score} × S${sa.scope_score}).`;
    }
  });

  const comparative_table: ComparativeRow[] = enrichedSubAvatars.map(sa => ({
    sub_avatar_id: sa.id,
    nickname: sa.nickname,
    tam: sa.tam_estimate ?? '—',
    urgency: sa.urgency_score ?? 0,
    scope: sa.scope_score ?? 0,
    staying_power: sa.staying_power_score ?? 0,
    recommended: sa.recommended_for_test,
  }));

  const best = enrichedSubAvatars[bestIdx];
  const final_recommendation: AvatarRunResult['final_recommendation'] = {
    first_to_test: best.id,
    reason: `Highest combined urgency (${best.urgency_score}) × scope (${best.scope_score}).`,
    strategy: `Test the ${best.nickname} angle first using the ${best.angles.positioning.framework} framework.`,
  };

  return {
    parsed: { sub_avatars: enrichedSubAvatars, comparative_table, final_recommendation },
    rawText: skeletonResp.content,
  };
}

// ---------- Layer C: deterministic minimal-result synthesizer ----------
// Never calls an LLM. Always returns a valid CompileOutput so the UI gets SOMETHING.
function synthesizeMinimalResult(
  core: CoreAvatarInput,
  analyzerResults: Array<{ source: SourceType; analysis: SourceAnalysis | null }>,
): CompileOutput {
  const valid = analyzerResults
    .filter(r => r.analysis && (r.analysis.verbatim_quotes?.length ?? 0) > 0)
    .map(r => ({ source: r.source, analysis: r.analysis as SourceAnalysis }));

  if (valid.length === 0) {
    const empty: SubAvatarV2 = {
      id: 'sa-1',
      name: 'Avatar (insufficient data)',
      nickname: 'unknown',
      dominant_category: 'experience',
      surface_desire: core.surface_desire,
      description:
        'Avatar excavation produced no usable signal. Retry with broader sources or different depth.',
      tam_estimate: '—',
      urgency_score: 0,
      scope_score: 0,
      staying_power_score: 0,
      verbatim_quotes: [],
      emotional_triggers: [],
      past_attempts_failures: [],
      implicit_demographics: [],
      angles: {
        positioning: {
          framework: 'new_mechanism',
          description: '',
          rationale: 'Auto-generated fallback — no analyzer data available.',
        },
        hooks: [],
        story_angle: { problem: '', agitation: '', solution: '', mechanism: '', cta: '' },
      },
      source_references: [],
      launch_order: 1,
      recommended_for_test: true,
      recommendation_reason: 'Only sub-avatar produced (fallback mode).',
    };
    return {
      sub_avatars: [empty],
      comparative_table: [{
        sub_avatar_id: empty.id,
        nickname: empty.nickname,
        tam: '—',
        urgency: 0,
        scope: 0,
        staying_power: 0,
        recommended: true,
      }],
      final_recommendation: {
        first_to_test: empty.id,
        reason: 'Fallback mode: all compile strategies failed and no analyzer data was available.',
        strategy: 'Re-run with different sources or depth setting.',
      },
    };
  }

  // Build up to 5 sub-avatars, one per richest source.
  const sorted = valid
    .slice()
    .sort((a, b) => (b.analysis.verbatim_quotes.length - a.analysis.verbatim_quotes.length))
    .slice(0, 5);

  const sub_avatars: SubAvatarV2[] = sorted.map((entry, idx) => {
    const { source, analysis } = entry;
    const sourceLabel = source.charAt(0).toUpperCase() + source.slice(1);
    const topVerbatims = analysis.verbatim_quotes.slice(0, 15);
    const description =
      (analysis.experiences ?? []).slice(0, 2).join('. ') ||
      (analysis.emotions ?? []).slice(0, 2).join('. ') ||
      `Sub-avatar surfaced from ${sourceLabel} signal.`;

    return {
      id: `sa-${idx + 1}`,
      name: `${sourceLabel} Voice`,
      nickname: source,
      dominant_category: 'experience',
      surface_desire: core.surface_desire,
      description,
      tam_estimate: '—',
      urgency_score: Math.min(10, 5 + Math.floor(topVerbatims.length / 3)),
      scope_score: Math.min(10, 4 + Math.floor(topVerbatims.length / 4)),
      staying_power_score: 5,
      verbatim_quotes: topVerbatims,
      emotional_triggers: (analysis.triggers ?? []).slice(0, 5),
      past_attempts_failures: (analysis.past_attempts_failures ?? []).slice(0, 5),
      implicit_demographics: (analysis.implicit_demographics ?? []).slice(0, 5),
      angles: {
        positioning: {
          framework: 'new_mechanism',
          description: `Speak to the ${sourceLabel} audience using their own surfaced experiences.`,
          rationale: 'Auto-generated fallback — angle compile failed; heuristic angle.',
        },
        hooks: [
          (analysis.emotions ?? [])[0] ?? 'You are not alone in this',
          (analysis.triggers ?? [])[0] ?? `Tired of fighting ${core.niche}?`,
          (analysis.past_attempts_failures ?? [])[0] ?? 'Ready to try a different approach?',
        ],
        story_angle: {
          problem: (analysis.experiences ?? [])[0] ?? '',
          agitation: (analysis.emotions ?? [])[0] ?? '',
          solution: core.product,
          mechanism: 'A new approach.',
          cta: `Try ${core.product}.`,
        },
      },
      source_references: [source],
      source_urls: topVerbatims.map(v => v.source_url).filter(Boolean),
      launch_order: idx + 1,
      recommended_for_test: idx === 0,
      recommendation_reason: idx === 0 ? 'Most verbatims surfaced from this source.' : '',
    };
  });

  const comparative_table: ComparativeRow[] = sub_avatars.map(sa => ({
    sub_avatar_id: sa.id,
    nickname: sa.nickname,
    tam: sa.tam_estimate ?? '—',
    urgency: sa.urgency_score,
    scope: sa.scope_score,
    staying_power: sa.staying_power_score,
    recommended: sa.recommended_for_test,
  }));

  return {
    sub_avatars,
    comparative_table,
    final_recommendation: {
      first_to_test: sub_avatars[0].id,
      reason: 'Fallback synthesis: compile passes failed, defaulted to source with most verbatims.',
      strategy: 'Re-run compile when rate limits clear for richer angles.',
    },
  };
}

// === MAIN PIPELINE ===

export interface RunAvatarExcavationParams {
  core: CoreAvatarInput;
  config?: SourceConfig;
  redditDepth?: RedditDepth;
  onProgress?: (event: AvatarProgressEvent) => void;
  // When set, the full excavation is seeded with signal from a competitor
  // funnel we already reverse-engineered. Marcus uses it to sharpen his
  // discovery plan (same pain clusters, but real third-party voices in the
  // target market). Passed through to the discovery prompt only — the rest
  // of the pipeline treats the run as a normal fresh excavation.
  reverseSeeds?: ReverseEngineeredFunnel | null;
}

export interface RunAvatarExcavationResult {
  result: AvatarRunResult | null;
  rawText: string;
  totalTokens: { input: number; output: number };
  error?: string;
}

export async function runAvatarExcavation(
  params: RunAvatarExcavationParams,
): Promise<RunAvatarExcavationResult> {
  const {
    core,
    config = DEFAULT_SOURCE_CONFIG,
    redditDepth = 'deep',
    onProgress,
    reverseSeeds = null,
  } = params;

  const runStart = Date.now();
  const totalTokens = { input: 0, output: 0 };
  let totalCostUSD = 0;

  // User tag for log filtering — lets us tell which tester kicked off which run.
  const userTag =
    typeof window !== 'undefined'
      ? localStorage.getItem('app-user') || 'unknown'
      : 'server';
  if (typeof window !== 'undefined') {
    console.log(
      `[user:${userTag}] === Gate 1 (Avatar Excavation) run started at ${new Date().toISOString()} ===`,
      { core, redditDepth },
    );
  }

  const phaseTimings = {
    discovery_ms: 0,
    fetch_ms: 0,
    analyze_ms: 0,
    compile_ms: 0,
  };

  try {
    // ================================================================
    // PHASE 0 — CURATED KB INJECTION
    // ================================================================
    // Fetch the team's curated KB for Marcus and prepend it to the base
    // methodology. This becomes the single cached system prefix for every
    // LLM call in the pipeline — so the curated playbook rides along on
    // every analyzer, compile, skeleton and angles call at cache-hit cost.
    const systemPrefix = await buildAvatarKnowledgePrefix();
    if (typeof window !== 'undefined') {
      const curatedChars = systemPrefix.length - BASE_AVATAR_KNOWLEDGE_PREFIX.length;
      console.log(
        `[avatar:curated] prefix assembled (${systemPrefix.length} chars total, +${Math.max(0, curatedChars)} from curated KB)`
      );
    }

    // ================================================================
    // PHASE 1 — DISCOVERY
    // ================================================================
    onProgress?.({
      phase: 'discovery',
      message: 'Marcus is planning the hunt: subreddits, domains, queries, marketplaces...',
    });

    const discoveryStart = Date.now();
    const discoveryResp = await callLLM({
      model: DISCOVERY_MODEL,
      systemPrompt: buildDiscoverySystemPrompt(),
      userMessage: buildDiscoveryUserMessage(core, reverseSeeds),
      temperature: 0.4,
      maxTokens: 4096,
    });
    phaseTimings.discovery_ms = Date.now() - discoveryStart;
    totalTokens.input += discoveryResp.tokensUsed.input;
    totalTokens.output += discoveryResp.tokensUsed.output;
    totalCostUSD += estimateCostUSD(discoveryResp.tokensUsed, DISCOVERY_MODEL);

    const plan = extractJSON<SourceDiscoveryPlan>(discoveryResp.content);
    if (!plan) {
      throw new Error('Discovery phase failed: no valid JSON plan in LLM output');
    }

    onProgress?.({
      phase: 'discovery',
      message: `Plan ready: ${plan.reddit?.subreddits?.length ?? 0} subreddits, ${plan.forums?.domains?.length ?? 0} forum domains, ${plan.searchWide?.queries?.length ?? 0} wide queries`,
      progress: 0.15,
    });

    // ================================================================
    // PHASE 2 — FETCHING (real scraping, parallel)
    // ================================================================
    const fetchStart = Date.now();
    onProgress?.({
      phase: 'fetching',
      message: 'Spinning up source fetchers in parallel...',
      progress: 0.2,
    });

    const fetchResult = await runSourceFetchers({
      plan,
      config,
      language: core.language,
      market: core.market,
      redditDepth,
      onProgress,
    });
    phaseTimings.fetch_ms = Date.now() - fetchStart;

    const fetchedSources = Object.keys(fetchResult.data) as SourceType[];
    const totalItems = fetchResult.totalItems;

    onProgress?.({
      phase: 'fetching',
      message: `Fetched ${totalItems} items across ${fetchedSources.length} sources (${fetchResult.errors.length} errors)`,
      progress: 0.5,
    });

    // ================================================================
    // PHASE 2.5 — RAW SIGNAL (deterministic, no LLM)
    // ================================================================
    // Build the preserved verbatim corpus + n-grams + emotion markers
    // BEFORE any analyzer or compile pass touches the data. This is the
    // "golden nugget safety net" — even if the LLM summary hallucinates
    // or loses detail, the raw voice stays searchable in the Gate 1 UI.
    let rawSignal: RawSignal | undefined;
    try {
      rawSignal = buildRawSignal({
        fetchData: fetchResult.data,
        language: core.language,
      });
      if (typeof window !== 'undefined') {
        console.log('[avatar:raw_signal] built', {
          items: rawSignal.total_items,
          chars: rawSignal.total_char_count,
          topPhrases: rawSignal.top_phrases.length,
          emotionHits: rawSignal.emotion_markers.length,
        });
      }
      onProgress?.({
        phase: 'fetching',
        message: `Raw signal: ${rawSignal.total_items} verbatims, ${rawSignal.top_phrases.length} top phrases, ${rawSignal.emotion_markers.length} emotion hits`,
        progress: 0.53,
      });
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('[avatar:raw_signal] build failed (non-fatal):', e);
      }
    }

    // ================================================================
    // PHASE 2.75 — DYNAMIC SOURCE DOUBLING (non-fatal)
    // Analyze which sources yielded the richest signal and run
    // additional queries on the top producers. Skip barren sources.
    // ================================================================
    try {
      if (rawSignal && rawSignal.total_items > 0) {
        const sourceBreakdown = rawSignal.source_breakdown;
        const totalItemCount = rawSignal.total_items;

        // Rank sources by item density
        const sourceRanking = Object.entries(sourceBreakdown)
          .map(([source, count]) => ({ source: source as SourceType, count, ratio: count / totalItemCount }))
          .sort((a, b) => b.count - a.count);

        // Top source gets extra queries if it has >30% of items AND the plan has more queries available
        const topSource = sourceRanking[0];
        if (topSource && topSource.ratio > 0.3 && topSource.count > 20) {
          const sourceName = topSource.source;

          onProgress?.({
            phase: 'fetching',
            message: `Source doubling: ${sourceName} has ${topSource.count} items (${(topSource.ratio * 100).toFixed(0)}%) — running extra queries...`,
            progress: 0.54,
          });

          // Generate 3-5 extra queries for the productive source
          const langMod = languageModifier(core.language);
          const extraQueries = [
            `${core.surface_desire} ${core.niche} personal experience ${langMod}`.trim(),
            `${core.niche} what I wish I knew before buying ${langMod}`.trim(),
            `${core.niche} worst mistake biggest regret ${langMod}`.trim(),
          ];

          const extraResults = await Promise.all(
            extraQueries.map(q => webSearch(q, { maxResults: 6, searchDepth: 'basic' }).catch(() => null)),
          );

          // Collect new URLs (skip already-fetched)
          const existingUrls = new Set(
            Object.values(fetchResult.data)
              .flatMap(d => d?.items.map(i => i.url) ?? []),
          );
          const newUrls: string[] = [];
          const newSnippets: string[] = [];

          for (const sr of extraResults) {
            if (!sr) continue;
            for (const r of sr.results) {
              if (!existingUrls.has(r.url)) {
                newUrls.push(r.url);
                newSnippets.push(`[${r.title}](${r.url})\n${r.content}`);
              }
            }
          }

          // Scrape unique new URLs (max 8)
          if (newUrls.length > 0) {
            const scraped = await scrapeMany(newUrls.slice(0, 8), 3);

            const doubleItems = [
              ...scraped.map(page =>
                toRawItem('searchWide', page.url, page.markdown, {
                  title: (page.metadata.title as string) ?? undefined,
                  metadata: { ...page.metadata, via: 'source-doubling' },
                }),
              ),
            ];

            // Append to searchWide bucket
            const existing = fetchResult.data.searchWide;
            if (existing) {
              existing.items = [...existing.items, ...doubleItems];
              existing.itemCount = existing.items.length;
            } else {
              fetchResult.data.searchWide = {
                source: 'searchWide',
                queries: extraQueries,
                items: doubleItems,
                itemCount: doubleItems.length,
                fetchDurationMs: 0,
              };
            }

            // Rebuild raw signal with enlarged corpus
            try {
              rawSignal = buildRawSignal({
                fetchData: fetchResult.data,
                language: core.language,
              });
            } catch { /* non-fatal */ }

            onProgress?.({
              phase: 'fetching',
              message: `Source doubling: +${doubleItems.length} new items from ${newUrls.length} URLs`,
              progress: 0.55,
            });
          }
        }
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('[avatar:source-doubling] failed (non-fatal):', e);
      }
    }

    // ================================================================
    // PHASE 3 — PER-SOURCE ANALYZERS (sequential to respect rate limits)
    // ================================================================
    const analyzeStart = Date.now();

    const analyzerTasks = fetchedSources
      .map(source => {
        const raw = fetchResult.data[source];
        if (!raw || raw.items.length === 0) return null;
        return { source, raw };
      })
      .filter((t): t is { source: SourceType; raw: RawSourceData } => t !== null);

    onProgress?.({
      phase: 'analyzing',
      message: `Running ${analyzerTasks.length} source analyzers sequentially (rate-limit safe)...`,
      progress: 0.55,
    });

    const analyzerResults: Array<{
      source: SourceType;
      analysis: SourceAnalysis | null;
    }> = [];

    for (let i = 0; i < analyzerTasks.length; i++) {
      const { source, raw } = analyzerTasks[i];
      const rawText = buildAnalyzerInput(raw);

      onProgress?.({
        phase: 'analyzing',
        source,
        message: `Analyzing ${source} (${raw.items.length} items, ${(rawText.length / 1000).toFixed(0)}k chars input, ${i + 1}/${analyzerTasks.length})...`,
      });

      try {
        const resp = await callLLM({
          model: ANALYZER_MODEL,
          systemPrompt: buildAnalyzerSystemPrompt(source, core),
          systemPrefix,
          userMessage: buildAnalyzerUserMessage(source, rawText),
          temperature: 0.3,
          maxTokens: 8192, // v2: was 6144 — more verbatims per source
        });
        totalTokens.input += resp.tokensUsed.input;
        totalTokens.output += resp.tokensUsed.output;
        totalCostUSD += estimateCostUSD(resp.tokensUsed, ANALYZER_MODEL);

        const parsed = extractJSON<SourceAnalysis>(resp.content);

        // Browser console: full visibility into what Sonnet returned
        if (typeof window !== 'undefined') {
          console.log(`[analyzer:${source}]`, {
            inputChars: rawText.length,
            inputPreview: rawText.slice(0, 400),
            outputPreview: resp.content.slice(0, 600),
            parsedVerbatims: parsed?.verbatim_quotes?.length ?? 0,
            parseFailed: parsed === null,
          });
        }

        const verbatimCount = parsed?.verbatim_quotes?.length ?? 0;
        onProgress?.({
          phase: 'analyzing',
          source,
          message: parsed
            ? `${source}: ${verbatimCount} verbatims extracted`
            : `${source}: JSON PARSE FAILED — raw: ${resp.content.slice(0, 150).replace(/\n/g, ' ')}`,
        });

        analyzerResults.push({ source, analysis: parsed });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown analyzer error';
        onProgress?.({
          phase: 'analyzing',
          source,
          message: `${source} analyzer failed: ${msg.slice(0, 120)}`,
        });
        analyzerResults.push({ source, analysis: null });
      }

      // Spacing between calls to keep input-tokens-per-minute under control
      if (i < analyzerTasks.length - 1) {
        await sleep(ANALYZER_SPACING_MS);
      }
    }
    phaseTimings.analyze_ms = Date.now() - analyzeStart;

    // Build map of structured analyses for the compile phase.
    // We pass the PARSED JSON (compact) — not the raw LLM text — to keep
    // the compile input small and avoid Opus timeouts.
    const analysesText: Record<string, string> = {};
    let successfulAnalyzers = 0;
    for (const r of analyzerResults) {
      if (r.analysis) {
        analysesText[r.source] = JSON.stringify(r.analysis, null, 2);
        successfulAnalyzers++;
      }
    }

    if (successfulAnalyzers === 0) {
      throw new Error(
        'All source analyzers failed (rate limits or empty data). Try fewer sources, or wait a minute and retry.',
      );
    }

    onProgress?.({
      phase: 'analyzing',
      message: `${successfulAnalyzers}/${analyzerTasks.length} analyzers succeeded — running gap-fill wave...`,
      progress: 0.75,
    });

    // ================================================================
    // PHASE 3.5 — GAP-FILL SECOND WAVE
    // ================================================================
    // Ask Sonnet to look at what the analyzers extracted, identify what's
    // UNDERREPRESENTED (missing emotions, missing demographics, missing
    // trigger moments), and produce 4-6 targeted follow-up queries. Then
    // run those queries through Tavily, scrape the top results, fold the
    // new items into the raw signal AND into a synthetic "searchWide2"
    // analyzer input that the compile phase will see.
    //
    // Never fatal — any failure just skips the wave.
    try {
      const gapFillStart = Date.now();

      // Compact summary of what we have so far (verbatims, triggers, demos).
      // We pass this to Sonnet and ask it to pinpoint gaps. We cap aggressively
      // so the input stays under 3k tokens.
      const summaryForGaps = analyzerResults
        .filter((r) => r.analysis)
        .map((r) => {
          const a = r.analysis!;
          return {
            source: r.source,
            verbatim_count: a.verbatim_quotes?.length ?? 0,
            top_verbatims: (a.verbatim_quotes ?? [])
              .slice(0, 5)
              .map((v) => v.quote?.slice(0, 140)),
            emotions: (a.emotions ?? []).slice(0, 6),
            triggers: (a.triggers ?? []).slice(0, 6),
            demographics: (a.implicit_demographics ?? []).slice(0, 6),
            past_attempts_failures: (a.past_attempts_failures ?? []).slice(0, 6),
          };
        });

      const gapPrompt = `You are Marcus, the Customer Researcher. You just finished a first pass of voice-of-customer research for this avatar:

Surface desire: ${core.surface_desire}
Niche:          ${core.niche}
Product:        ${core.product}
Language:       ${core.language}
Market:         ${core.market}

Here is a COMPACT summary of what the first-pass analyzers extracted across sources:

${JSON.stringify(summaryForGaps, null, 2)}

Your job: find the GAPS. What kind of customer signal is MISSING or UNDERREPRESENTED that would make this avatar sharper?
Common gap types:
- Emotional nuance we barely touched (shame, envy, despair, hope, bargaining...)
- Demographic subgroups we don't hear from (nightshift workers, new parents, elderly, specific ethnicities, income brackets...)
- Trigger moments we didn't capture (the exact day/event someone starts searching)
- Contradictions (stated desire vs. actual behavior)
- Past-attempt failures we don't have enough color on

Output STRICT JSON matching this schema — no commentary, no fences, no preamble:

{
  "gaps": [
    { "label": "short name of the gap", "rationale": "1 line — why it matters" }
  ],
  "follow_up_queries": [
    "natural-language search query that would surface the missing signal (in ${core.language})"
  ]
}

HARD LIMITS:
- gaps: exactly 4-6 items
- follow_up_queries: exactly 5-8 items
- Queries must be things a real customer would type into Google, not keyword salads.
- Queries must be in ${core.language}.`;

      const gapResp = await callLLM({
        model: ANALYZER_MODEL,
        systemPrompt:
          'You output STRICT JSON only. No prose, no fences unless the user asks. Be specific, concrete, and bias toward naming gaps that would meaningfully sharpen the avatar.',
        userMessage: gapPrompt,
        temperature: 0.4,
        maxTokens: 1024,
      });
      totalTokens.input += gapResp.tokensUsed.input;
      totalTokens.output += gapResp.tokensUsed.output;
      totalCostUSD += estimateCostUSD(gapResp.tokensUsed, ANALYZER_MODEL);

      const gaps = extractJSON<{
        gaps: Array<{ label: string; rationale: string }>;
        follow_up_queries: string[];
      }>(gapResp.content);

      if (gaps && Array.isArray(gaps.follow_up_queries) && gaps.follow_up_queries.length > 0) {
        const queries = gaps.follow_up_queries.slice(0, 8);
        const langMod = languageModifier(core.language);

        onProgress?.({
          phase: 'analyzing',
          message: `Gap-fill: ${gaps.gaps?.length ?? 0} gaps found, running ${queries.length} targeted searches...`,
          progress: 0.77,
        });

        // Run follow-up searches in parallel via Tavily
        const searchPromises = queries.map((q) =>
          webSearch(`${q} ${langMod}`.trim(), { maxResults: 8, searchDepth: 'advanced' }),
        );
        const searchResults = await Promise.all(searchPromises);

        // Dedup URLs across all queries, skip already-covered platforms so
        // gap-fill expands the corpus rather than re-running the same reddit threads.
        const followUpUrls = new Set<string>();
        const snippetBlocks: string[] = [];
        for (let i = 0; i < searchResults.length; i++) {
          const sr = searchResults[i];
          if (!sr) continue;
          if (sr.answer) {
            snippetBlocks.push(`Q: ${queries[i]}\nA: ${sr.answer}`);
          }
          for (const r of sr.results) {
            if (/reddit\.com|amazon\.|youtube\.com|tiktok\.com|quora\.com|trustpilot\.com/.test(r.url)) {
              // Surface the snippet but don't re-scrape — we already hit these sources.
              snippetBlocks.push(`[${r.title}](${r.url})\n${r.content}`);
              continue;
            }
            followUpUrls.add(r.url);
            snippetBlocks.push(`[${r.title}](${r.url})\n${r.content}`);
          }
        }

        const uniqueUrls = Array.from(followUpUrls).slice(0, 12);
        const gapScraped = await scrapeMany(uniqueUrls, 4);

        onProgress?.({
          phase: 'analyzing',
          message: `Gap-fill: scraped ${gapScraped.length} new pages (${snippetBlocks.length} snippets).`,
          progress: 0.79,
        });

        // Fold new items into fetchResult.data.searchWide so Raw Signal sees them.
        // This is non-destructive — we append to an existing bucket if present.
        const gapItems = [
          toRawItem('searchWide', 'search://gap-fill-snippets', snippetBlocks.join('\n\n---\n\n'), {
            title: 'Gap-fill aggregated snippets',
          }),
          ...gapScraped.map((page) =>
            toRawItem('searchWide', page.url, page.markdown, {
              title: (page.metadata.title as string) ?? undefined,
              metadata: { ...page.metadata, via: 'gap-fill' },
            }),
          ),
        ];

        const existing = fetchResult.data.searchWide;
        if (existing) {
          existing.items = [...existing.items, ...gapItems];
          existing.itemCount = existing.items.length;
          existing.queries = [...existing.queries, ...queries.map((q) => `gap: ${q}`)];
        } else {
          fetchResult.data.searchWide = {
            source: 'searchWide',
            queries: queries.map((q) => `gap: ${q}`),
            items: gapItems,
            itemCount: gapItems.length,
            fetchDurationMs: Date.now() - gapFillStart,
          };
        }

        // Rebuild raw_signal with the enlarged corpus — non-destructive
        // (we overwrite rawSignal but preserve user picks from the prior state,
        // which is empty at this point since it's a fresh run anyway).
        try {
          rawSignal = buildRawSignal({
            fetchData: fetchResult.data,
            language: core.language,
          });
          if (typeof window !== 'undefined') {
            console.log('[avatar:raw_signal] rebuilt after gap-fill', {
              items: rawSignal.total_items,
              topPhrases: rawSignal.top_phrases.length,
            });
          }
        } catch (e) {
          if (typeof window !== 'undefined') {
            console.warn('[avatar:raw_signal] rebuild after gap-fill failed:', e);
          }
        }

        // Run ONE extra analyzer on the gap-fill text so the compile phase sees it.
        const gapRawText = gapItems
          .map((it) => `--- ITEM: ${it.url} ---\n${it.title ? `TITLE: ${it.title}\n` : ''}${it.content}`)
          .join('\n\n')
          .slice(0, MAX_ANALYZER_INPUT_CHARS);

        if (gapRawText.length > 500) {
          onProgress?.({
            phase: 'analyzing',
            message: `Gap-fill: analyzing ${(gapRawText.length / 1000).toFixed(0)}k chars of new signal...`,
          });
          try {
            const gapAnalyzerResp = await callLLM({
              model: ANALYZER_MODEL,
              systemPrompt: buildAnalyzerSystemPrompt('searchWide', core),
              systemPrefix,
              userMessage: buildAnalyzerUserMessage('searchWide', gapRawText),
              temperature: 0.3,
              maxTokens: 6144,
            });
            totalTokens.input += gapAnalyzerResp.tokensUsed.input;
            totalTokens.output += gapAnalyzerResp.tokensUsed.output;
            totalCostUSD += estimateCostUSD(gapAnalyzerResp.tokensUsed, ANALYZER_MODEL);

            const gapParsed = extractJSON<SourceAnalysis>(gapAnalyzerResp.content);
            if (gapParsed && (gapParsed.verbatim_quotes?.length ?? 0) > 0) {
              // Merge into the searchWide analysis bucket (creating it if missing)
              // so the compile phase receives both the original and gap-fill signal.
              const existingIdx = analyzerResults.findIndex((r) => r.source === 'searchWide');
              if (existingIdx >= 0 && analyzerResults[existingIdx].analysis) {
                const orig = analyzerResults[existingIdx].analysis!;
                analyzerResults[existingIdx].analysis = {
                  source: 'searchWide',
                  verbatim_quotes: [
                    ...(orig.verbatim_quotes ?? []),
                    ...(gapParsed.verbatim_quotes ?? []),
                  ],
                  experiences: [...(orig.experiences ?? []), ...(gapParsed.experiences ?? [])],
                  emotions: [...(orig.emotions ?? []), ...(gapParsed.emotions ?? [])],
                  behaviors: [...(orig.behaviors ?? []), ...(gapParsed.behaviors ?? [])],
                  implicit_demographics: [
                    ...(orig.implicit_demographics ?? []),
                    ...(gapParsed.implicit_demographics ?? []),
                  ],
                  past_attempts_failures: [
                    ...(orig.past_attempts_failures ?? []),
                    ...(gapParsed.past_attempts_failures ?? []),
                  ],
                  triggers: [...(orig.triggers ?? []), ...(gapParsed.triggers ?? [])],
                  patterns_observed: [
                    ...(orig.patterns_observed ?? []),
                    ...(gapParsed.patterns_observed ?? []),
                  ],
                  item_count_analyzed:
                    (orig.item_count_analyzed ?? 0) + (gapParsed.item_count_analyzed ?? 0),
                };
              } else {
                analyzerResults.push({ source: 'searchWide', analysis: gapParsed });
              }
              // Refresh the compile input map with the merged analysis
              const refreshed = analyzerResults.find((r) => r.source === 'searchWide');
              if (refreshed?.analysis) {
                analysesText['searchWide'] = JSON.stringify(refreshed.analysis, null, 2);
              }
              onProgress?.({
                phase: 'analyzing',
                message: `Gap-fill: +${gapParsed.verbatim_quotes?.length ?? 0} verbatims merged into compile input.`,
                progress: 0.82,
              });
            }
          } catch (e) {
            if (typeof window !== 'undefined') {
              console.warn('[avatar:gap-fill] analyzer call failed:', e);
            }
          }
        }
      } else {
        if (typeof window !== 'undefined') {
          console.log('[avatar:gap-fill] no gaps / queries returned, skipping wave');
        }
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('[avatar:gap-fill] wave failed (non-fatal):', e);
      }
      onProgress?.({
        phase: 'analyzing',
        message: 'Gap-fill wave failed — continuing with first-pass data.',
      });
    }

    // ================================================================
    // PHASE 3.75 — CROSS-SOURCE SIGNAL VALIDATION (deterministic)
    // Cross-references signals across sources to build a confidence
    // matrix. Injected into the compile prompt so sub-avatars are
    // built on HIGH-confidence (multi-source) signals first.
    // ================================================================
    let confidenceMatrix: SignalConfidenceMatrix | undefined;
    let confidencePromptBlock = '';
    try {
      const validAnalyses = analyzerResults
        .filter((r): r is { source: SourceType; analysis: SourceAnalysis } => r.analysis !== null);

      if (validAnalyses.length >= 2) {
        confidenceMatrix = buildConfidenceMatrix(validAnalyses);
        confidencePromptBlock = buildConfidenceMatrixPrompt(confidenceMatrix);

        if (typeof window !== 'undefined') {
          console.log('[avatar:cross-source] confidence matrix built', {
            total: confidenceMatrix.total_signals,
            high: confidenceMatrix.high_confidence.length,
            medium: confidenceMatrix.medium_confidence.length,
            low: confidenceMatrix.low_confidence.length,
            strongestThemes: confidenceMatrix.strongest_themes,
          });
        }

        onProgress?.({
          phase: 'analyzing',
          message: `Cross-source validation: ${confidenceMatrix.high_confidence.length} high-confidence, ${confidenceMatrix.medium_confidence.length} medium, ${confidenceMatrix.low_confidence.length} low signals`,
          progress: 0.83,
        });
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('[avatar:cross-source] failed (non-fatal):', e);
      }
    }

    // Inject confidence matrix into the compile analyses text
    if (confidencePromptBlock) {
      analysesText['__signal_confidence'] = confidencePromptBlock;
    }

    // ================================================================
    // PHASE 4 — COMPILE CASCADE
    //   Layer A : full single-shot Opus (32k tokens) + stricter retry
    //   Layer B : chunked 2-pass (Opus skeletons + per-SA Sonnet angles)
    //   Layer C : deterministic minimal synthesis (never throws)
    // We always push through to a valid AvatarRunResult if ANY analyzer
    // succeeded — no more "Compile phase failed" hard-errors in the UI.
    // ================================================================
    const compileStart = Date.now();
    onProgress?.({
      phase: 'compiling',
      message: 'Marcus is clustering verbatims into sub-avatars and generating angles...',
      progress: 0.85,
    });

    const acc: CostAccumulator = {
      tokens: { input: 0, output: 0 },
      costUSD: 0,
    };

    let compileParsed: CompileOutput | null = null;
    let rawCompileText = '';
    let compileTier: 'full' | 'two-pass' | 'minimal' = 'full';

    // Layer A: full single-shot
    try {
      const fullResult = await tryFullCompile(core, analysesText, acc, systemPrefix, onProgress);
      compileParsed = fullResult.parsed;
      rawCompileText = fullResult.rawText;
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('[compile] Layer A (full) threw:', e);
      }
    }

    // Layer B: two-pass
    if (!compileParsed) {
      onProgress?.({
        phase: 'compiling',
        message: 'Layer A failed — switching to chunked 2-pass compile...',
      });
      compileTier = 'two-pass';
      try {
        const twoPassResult = await tryTwoPassCompile(core, analysesText, acc, systemPrefix, onProgress);
        compileParsed = twoPassResult.parsed;
        rawCompileText = twoPassResult.rawText;
      } catch (e) {
        if (typeof window !== 'undefined') {
          console.warn('[compile] Layer B (two-pass) threw:', e);
        }
      }
    }

    // Layer C: deterministic minimal synthesis (never throws, never null)
    if (!compileParsed) {
      onProgress?.({
        phase: 'compiling',
        message: 'Both compile layers failed — synthesizing minimal result from raw analyses...',
      });
      compileTier = 'minimal';
      compileParsed = synthesizeMinimalResult(core, analyzerResults);
    }

    phaseTimings.compile_ms = Date.now() - compileStart;
    totalTokens.input += acc.tokens.input;
    totalTokens.output += acc.tokens.output;
    totalCostUSD += acc.costUSD;

    if (typeof window !== 'undefined') {
      console.log(`[user:${userTag}] [compile] tier used: ${compileTier}`, {
        subAvatars: compileParsed.sub_avatars.length,
        cost: acc.costUSD.toFixed(4),
        tokens: acc.tokens,
        totalMs: Date.now() - runStart,
      });
    }

    // ================================================================
    // PHASE 4.5 — POST-COMPILE ENRICHMENT (all non-fatal)
    //   A: Adversarial validation (LLM challenge pass)
    //   B: Verbatim quality ranking (deterministic)
    //   C: Swipe vocabulary extraction (deterministic)
    // ================================================================

    // A: Adversarial validation — LLM challenges each sub-avatar
    let adversarialReport: AdversarialReport | undefined;
    try {
      if (compileParsed.sub_avatars.length >= 2) {
        onProgress?.({
          phase: 'compiling',
          message: 'Running adversarial validation — stress-testing each sub-avatar...',
          progress: 0.92,
        });

        const advPrompt = buildAdversarialPrompt(core, compileParsed.sub_avatars, confidenceMatrix);
        const advResp = await callLLM({
          model: ANALYZER_MODEL,
          systemPrompt: advPrompt.system,
          userMessage: advPrompt.user,
          temperature: 0.3,
          maxTokens: 4096,
        });
        totalTokens.input += advResp.tokensUsed.input;
        totalTokens.output += advResp.tokensUsed.output;
        totalCostUSD += estimateCostUSD(advResp.tokensUsed, ANALYZER_MODEL);

        adversarialReport = extractJSON<AdversarialReport>(advResp.content) ?? undefined;

        if (adversarialReport) {
          // Apply adversarial insights to sub-avatars
          compileParsed.sub_avatars = applyAdversarialReport(compileParsed.sub_avatars, adversarialReport);

          if (typeof window !== 'undefined') {
            console.log('[avatar:adversarial]', {
              quality: adversarialReport.overall_quality,
              strongest: adversarialReport.strongest_sub_avatar,
              weakest: adversarialReport.weakest_sub_avatar,
              merges: adversarialReport.merge_suggestions?.length ?? 0,
            });
          }

          onProgress?.({
            phase: 'compiling',
            message: `Validation: ${adversarialReport.overall_quality} quality. Strongest: ${adversarialReport.strongest_sub_avatar}`,
            progress: 0.94,
          });
        }
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('[avatar:adversarial] failed (non-fatal):', e);
      }
    }

    // B: Rank verbatims across all sub-avatars (deterministic)
    try {
      for (const sa of compileParsed.sub_avatars) {
        if (sa.verbatim_quotes && sa.verbatim_quotes.length > 0) {
          const ranked = rankVerbatims(sa.verbatim_quotes);
          // Re-order verbatims by quality score (best first)
          sa.verbatim_quotes = ranked;
        }
      }
      if (typeof window !== 'undefined') {
        console.log('[avatar:ranking] verbatims ranked by quality');
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('[avatar:ranking] failed (non-fatal):', e);
      }
    }

    // C: Build swipe vocabulary per sub-avatar (deterministic)
    const swipeVocabularies: SwipeVocabulary[] = [];
    try {
      const validAnalyses = analyzerResults
        .filter(r => r.analysis)
        .map(r => r.analysis!);

      for (const sa of compileParsed.sub_avatars) {
        const vocab = buildSwipeVocabulary(sa, validAnalyses);
        swipeVocabularies.push(vocab);
      }
      if (typeof window !== 'undefined') {
        console.log('[avatar:swipe] vocabularies built for', swipeVocabularies.length, 'sub-avatars');
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('[avatar:swipe] failed (non-fatal):', e);
      }
    }

    // Assemble final result
    const result: AvatarRunResult = {
      core_avatar: core,
      discovery_plan: plan,
      sub_avatars: compileParsed.sub_avatars ?? [],
      comparative_table: compileParsed.comparative_table ?? [],
      final_recommendation: compileParsed.final_recommendation ?? {
        first_to_test: compileParsed.sub_avatars?.[0]?.id ?? 'sa-1',
        reason: 'No explicit recommendation produced — defaulting to first sub-avatar.',
        strategy: '',
      },
      metadata: {
        sources_used: fetchedSources,
        total_verbatims: (compileParsed.sub_avatars ?? []).reduce(
          (sum, sa) => sum + (sa.verbatim_quotes?.length ?? 0),
          0,
        ),
        total_items_scraped: totalItems,
        run_duration_ms: Date.now() - runStart,
        cost_estimate_usd: Number(totalCostUSD.toFixed(4)),
        phase_timings: phaseTimings,
      },
      raw_signal: rawSignal,
      adversarial_summary: adversarialReport
        ? {
            overall_quality: adversarialReport.overall_quality,
            strongest_sub_avatar: adversarialReport.strongest_sub_avatar,
            weakest_sub_avatar: adversarialReport.weakest_sub_avatar,
            merge_suggestions: adversarialReport.merge_suggestions ?? [],
            missing_angles: adversarialReport.missing_angles ?? [],
          }
        : undefined,
    };

    const tierLabel =
      compileTier === 'full' ? '' :
      compileTier === 'two-pass' ? ' (chunked)' :
      ' (fallback)';
    onProgress?.({
      phase: 'done',
      message: `Done${tierLabel}: ${result.sub_avatars.length} sub-avatars, ${result.metadata.total_verbatims} verbatims, $${result.metadata.cost_estimate_usd.toFixed(2)}`,
      progress: 1,
    });

    return {
      result,
      rawText: rawCompileText,
      totalTokens,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    onProgress?.({
      phase: 'error',
      message,
    });
    return {
      result: null,
      rawText: '',
      totalTokens,
      error: message,
    };
  }
}
