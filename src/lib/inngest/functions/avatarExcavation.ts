// ============================================================
// PAWEN — Avatar Excavation as an Inngest function
//
// 4 step.run blocks, each its own Vercel function call (fresh 800s
// budget). Inside each step we still emit markPhase() updates for
// the 12 logical phases (KB, Discovery, Fetch, Raw Signal, Voyage
// Dedup, Voyage Rerank, Analyzers, Cross-source Validation,
// Gap-fill, Compile, Adversarial, Classifier) so the UI feed shows
// fine-grained progression even though Inngest sees coarser steps.
//
// Why 4 not 12: runAvatarExcavation is a 1750-line monolith with
// state shared between phases. Splitting into 12 standalone Inngest
// steps would require ~1-2h of risky extraction. The 4-step pattern
// uses the existing stopAfterFetch + prefetchedData flags (already
// tested) and gives 4 × 800s = 3200s wall-clock — far more than the
// pipeline ever needs. Future iteration to true 12-step will need
// a phases.ts refactor (out-of-scope here).
// ============================================================

import 'server-only';
import { inngest, EVENTS } from '../client';
import { runAvatarExcavation } from '@/lib/avatars/runAvatarExcavation';
import { withInternalContext } from '@/lib/util/internalContext';
import { ensureFetchPatched } from '@/lib/util/fetchPatch';
import { markPhase, markCompleted, markFailed } from '../jobUpdate';
import { wrapStepOutput, unwrapStepOutput, type StepOutputHandle } from '@/lib/blob/excavationBlob';
import type {
  CoreAvatarInput,
  SourceConfig,
  RawSourceData,
  SourceType,
  AvatarRunResult,
} from '@/lib/avatars/types';
import type { RedditDepth } from '@/lib/sources/reddit';
import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';

interface ExcavationEventData {
  jobId: string;
  baseUrl: string;
  sessionCookie: string;
  core: CoreAvatarInput;
  config?: SourceConfig;
  redditDepth?: RedditDepth;
  reverseSeeds?: ReverseEngineeredFunnel | null;
}

export const avatarExcavationFn = inngest.createFunction(
  {
    id: 'avatar-excavation',
    triggers: [{ event: EVENTS.AVATAR_EXCAVATION_START }],
    concurrency: { limit: 3 },
    retries: 2,
  },
  async ({ event, step, logger }) => {
    const data = event.data as ExcavationEventData;
    const { jobId, baseUrl, sessionCookie, core, config, redditDepth, reverseSeeds } = data;

    // ────────────────────────────────────────────────────────────────
    // STEP 1 — INIT-JOB: mark running, sanity-check inputs.
    // ────────────────────────────────────────────────────────────────
    await step.run('init-job', async () => {
      await markPhase(jobId, 'starting', 'Inngest pipeline launched — preparing phases');
      if (!core?.product || !core?.niche) {
        await markFailed(jobId, 'Missing core.product or core.niche');
        throw new Error('Missing core inputs');
      }
    });

    // ────────────────────────────────────────────────────────────────
    // STEP 2 — DISCOVER + FETCH (Phases 0+1+2 + 2.5 + 2.6 + 2.7)
    // KB injection → Discovery (Sonnet plan) → BD parallel fetch →
    // Raw Signal builder → Voyage Dedup → Voyage Rerank.
    // The slow piece is BD fetch (Reddit posts+comments up to 540s).
    // Heavy fetchData blob may push >1MB → Vercel Blob.
    // ────────────────────────────────────────────────────────────────
    const fetchHandle = await step.run('discover-and-fetch', async (): Promise<StepOutputHandle<Partial<Record<SourceType, RawSourceData>>>> => {
      ensureFetchPatched();
      return await withInternalContext({ baseUrl, sessionCookie }, async () => {
        await markPhase(jobId, 'discovery', 'Phase 1: Marcus is planning the hunt (KB + discovery LLM)');
        // runAvatarExcavation runs Phase 0 (KB) + Phase 1 (Discovery) +
        // Phase 2 (Fetch) + Phase 2.5 (Raw Signal) + Phase 2.6 (Dedup)
        // + Phase 2.7 (Rerank) inline, then exits via stopAfterFetch.
        const result = await runAvatarExcavation({
          core,
          config,
          redditDepth,
          reverseSeeds: reverseSeeds ?? null,
          stopAfterFetch: true,
          // onProgress writes markPhase already via the runAvatarExcavation
          // internal hooks; for steps that don't carry an onProgress we
          // emit explicit markPhase calls at step boundaries.
          onProgress: async (e) => {
            await markPhase(jobId, e.phase, e.message);
          },
        });

        if (!result.fetchData) {
          throw new Error('Phase 2 fetch returned no data');
        }
        const fetchData = result.fetchData as Partial<Record<SourceType, RawSourceData>>;
        const totalItems = Object.values(fetchData)
          .reduce((sum, b) => sum + (b?.itemCount ?? b?.items?.length ?? 0), 0);
        if (totalItems === 0) {
          throw new Error('Phase 2 fetch returned 0 items — every BD source empty/failed');
        }
        return await wrapStepOutput(jobId, 'discover-and-fetch', fetchData);
      });
    });

    logger.info(`[avatar-excavation:${jobId}] step 2 done — fetch handle:`, fetchHandle.kind);

    // ────────────────────────────────────────────────────────────────
    // STEP 3 — ANALYZE + COMPILE (Phases 3 + 3.5 + 3.75 + 4 + 4.5)
    // Re-enters runAvatarExcavation with prefetchedData → skips
    // Phase 2 (cache hit), runs all LLM phases: parallel Sonnet
    // analyzers, gap-fill (skipped via env), cross-source validation,
    // Opus compile, adversarial (skipped via env), classifier.
    // ~3-5 min typical; gets its own fresh 800s budget.
    // ────────────────────────────────────────────────────────────────
    const finalResult = await step.run('analyze-and-compile', async () => {
      ensureFetchPatched();
      return await withInternalContext({ baseUrl, sessionCookie }, async () => {
        await markPhase(jobId, 'analyzing', 'Phase 3: launching parallel source analyzers');
        const fetchData = await unwrapStepOutput(fetchHandle);
        const result = await runAvatarExcavation({
          core,
          config,
          redditDepth,
          reverseSeeds: reverseSeeds ?? null,
          prefetchedData: fetchData,
          onProgress: async (e) => {
            await markPhase(jobId, e.phase, e.message);
          },
        });
        if (result.error || !result.result) {
          throw new Error(result.error ?? 'Excavation analyze stage returned no result');
        }
        return {
          avatarRunResult: result.result as AvatarRunResult,
          rawText: result.rawText,
          totalTokens: result.totalTokens,
        };
      });
    });

    // ────────────────────────────────────────────────────────────────
    // STEP 4 — FINALIZE: persist final result on the job row.
    // ────────────────────────────────────────────────────────────────
    await step.run('finalize-job', async () => {
      const subAvatarCount = finalResult.avatarRunResult.sub_avatars.length;
      const verbatimCount = finalResult.avatarRunResult.metadata.total_verbatims;
      await markCompleted(
        jobId,
        finalResult,
        `Done — ${subAvatarCount} sub-avatars, ${verbatimCount} verbatims`,
      );
    });

    return {
      ok: true,
      jobId,
      subAvatars: finalResult.avatarRunResult.sub_avatars.length,
    };
  },
);
