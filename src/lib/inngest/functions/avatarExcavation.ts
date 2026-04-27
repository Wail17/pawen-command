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
import { getSql } from '@/lib/db/client';

/**
 * Wraps a long-running step.run body with a 30s-interval heartbeat
 * ticker that bumps pipeline_jobs.heartbeat_at independently of the
 * runAvatarExcavation onProgress events. Without this, a single
 * 6-min Sonnet compile call leaves the job looking stale to the
 * zombie reaper and the polling UI even though it's making progress.
 */
async function withHeartbeat<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
  const sql = getSql();
  const ticker = setInterval(() => {
    void sql`UPDATE pipeline_jobs SET heartbeat_at = NOW() WHERE id = ${jobId}`.catch(() => {});
  }, 30_000);
  if (typeof ticker.unref === 'function') ticker.unref();
  try {
    return await fn();
  } finally {
    clearInterval(ticker);
  }
}
import { wrapStepOutput, unwrapStepOutput, type StepOutputHandle } from '@/lib/blob/excavationBlob';
import { getCachedFetch, buildCacheKey } from '@/lib/avatars/excavationCache';
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
  // Replay path: if set, step 2 'discover-and-fetch' is skipped entirely
  // and this data is used as fetchHandle directly. Used by the
  // test-pipeline-from-cache.mjs script to validate Phase 2.5+ without
  // re-burning BD credit.
  __replayPrefetchedData?: Partial<Record<SourceType, RawSourceData>>;
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
    //
    // SHORT-CIRCUIT PATHS (no BD spend):
    //   1. Replay (event.data.__replayPrefetchedData set) — used by
    //      test-pipeline-from-cache.mjs.
    //   2. excavation_fetch_cache hit — auto when same inputs run
    //      twice within the 6h TTL.
    // ────────────────────────────────────────────────────────────────
    const fetchHandle = await step.run('discover-and-fetch', async (): Promise<StepOutputHandle<Partial<Record<SourceType, RawSourceData>>>> => withHeartbeat(jobId, async () => {
      // Short-circuit 1: explicit replay payload from a debug script.
      if (data.__replayPrefetchedData) {
        const totalItems = Object.values(data.__replayPrefetchedData)
          .reduce((sum, b) => sum + (b?.itemCount ?? b?.items?.length ?? 0), 0);
        await markPhase(jobId, 'fetching', `Replay path: reusing ${totalItems} pre-fetched items (no BD calls)`);
        return await wrapStepOutput(jobId, 'discover-and-fetch', data.__replayPrefetchedData);
      }

      // Short-circuit 2: auto cache hit on same inputs within TTL.
      const cacheKey = await buildCacheKey({ core, config, redditDepth });
      const cached = await getCachedFetch(cacheKey);
      if (cached?.data) {
        const totalItems = Object.values(cached.data)
          .reduce((sum, b) => sum + (b?.itemCount ?? b?.items?.length ?? 0), 0);
        await markPhase(jobId, 'fetching', `Cache hit: ${totalItems} items from previous run (skipping BD scrape)`);
        logger.info(`[avatar-excavation:${jobId}] cache hit (${totalItems} items)`);
        return await wrapStepOutput(jobId, 'discover-and-fetch', cached.data);
      }

      // Cache miss → real fetch.
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
    }));

    logger.info(`[avatar-excavation:${jobId}] step 2 done — fetch handle:`, fetchHandle.kind);

    // ────────────────────────────────────────────────────────────────
    // STEP 3 — ANALYZE + COMPILE (Phases 3 + 3.5 + 3.75 + 4 + 4.5)
    // Re-enters runAvatarExcavation with prefetchedData → skips
    // Phase 2 (cache hit), runs all LLM phases: parallel Sonnet
    // analyzers, gap-fill (skipped via env), cross-source validation,
    // Opus compile, adversarial (skipped via env), classifier.
    // ~3-5 min typical; gets its own fresh 800s budget.
    // ────────────────────────────────────────────────────────────────
    // Step 3 result is intentionally a small handle, not the whole
    // avatarRunResult. Reason: avatarRunResult + rawText can run 0.5-2MB
    // depending on niche richness. Returning that as a step.run output
    // has bitten us repeatedly — Inngest's step result wire format
    // throws (or silently truncates → retry from scratch) on big
    // payloads, which threw away successful $0.50 compiles three runs
    // in a row today. The persistent fix: save the full result to the
    // pipeline_jobs row INSIDE step 3 the moment runAvatarExcavation
    // returns, BEFORE handing anything back to Inngest. Whatever
    // happens after that point — Inngest crash, network drop, retry
    // explosion — the DB already has the answer.
    const finalSummary = await step.run('analyze-and-compile', async () => withHeartbeat(jobId, async () => {
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

        const avatarRunResult = result.result as AvatarRunResult;
        const subAvatarCount = avatarRunResult.sub_avatars.length;
        const verbatimCount = avatarRunResult.metadata.total_verbatims;

        // PERSIST FIRST — this writes status=completed + the full result
        // payload to pipeline_jobs synchronously. If markCompleted itself
        // throws (DB outage, schema mismatch), we WANT Inngest to retry
        // — but the retry would overwrite a half-written row, which is
        // safe because markCompleted is a single atomic UPDATE.
        try {
          await markCompleted(
            jobId,
            {
              avatarRunResult,
              rawText: result.rawText,
              totalTokens: result.totalTokens,
            },
            `Done — ${subAvatarCount} sub-avatars, ${verbatimCount} verbatims`,
          );
          logger.info(`[avatar-excavation:${jobId}] persisted result inline (${subAvatarCount} sub-avatars, ${verbatimCount} verbatims)`);
        } catch (err) {
          logger.error(`[avatar-excavation:${jobId}] markCompleted threw (will retry):`, err);
          throw err; // surface to Inngest so the step retries
        }

        // Tiny return — Inngest's step output wire format won't choke
        // on this. Step 4 below double-checks the DB row is in fact
        // completed (idempotent no-op if so).
        return { ok: true as const, subAvatarCount, verbatimCount };
      });
    }));

    // ────────────────────────────────────────────────────────────────
    // STEP 4 — FINALIZE (idempotent safety net).
    // Step 3 already wrote status='completed' + result. This step is
    // a guard rail: if for any reason that didn't stick (it should, but
    // belt-and-suspenders), re-stamp the message so the UI shows fresh
    // "done" state. No-op when the job is already completed.
    // ────────────────────────────────────────────────────────────────
    await step.run('finalize-job', async () => {
      const sql = getSql();
      const rows = await sql`SELECT status FROM pipeline_jobs WHERE id = ${jobId}` as Array<{ status: string }>;
      if (rows[0]?.status === 'completed') {
        // Already finalized in step 3 — nothing to do.
        return;
      }
      // Step 3 didn't persist (shouldn't happen, but recover gracefully).
      logger.warn(`[avatar-excavation:${jobId}] finalize-job: status=${rows[0]?.status ?? 'unknown'} — step 3 didn't mark completed`);
      await markPhase(
        jobId,
        'done',
        `Done — ${finalSummary.subAvatarCount} sub-avatars, ${finalSummary.verbatimCount} verbatims`,
      );
    });

    return {
      ok: true,
      jobId,
      subAvatars: finalSummary.subAvatarCount,
    };
  },
);
