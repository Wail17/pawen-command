// ============================================================
// ⚠️ DEPRECATED — replaced by Inngest avatarExcavationFn
// (src/lib/inngest/functions/avatarExcavation.ts).
//
// This worker used Vercel `after()` to run the entire pipeline in a
// single function call, which kept hitting the 800s function-duration
// cap on rich niches (Reddit posts+comments alone can run 540s, leaving
// no headroom for analyzers/compile). Migrated 2026-04-26 to Inngest's
// step-based execution: each step gets a fresh function-duration budget,
// total wall-clock unbounded.
//
// File kept for one release cycle as a rollback safety net. Nothing
// imports it. Safe to delete after ~1 week of stable Inngest runs.
//
// Original docstring follows below.
// ============================================================
//
// PAWEN — Avatar Excavation Job Worker
//
// Runs the full Gate 1 pipeline server-side. The HTTP response
// for /api/avatars/start fires this in the background via Next.js
// `after()`, so the user can close their tab and the run continues
// to completion. Status is checkpointed to pipeline_jobs after
// every phase, so the client can poll and resume rendering.
//
// Concurrency-safe by design:
//   - the base URL + session cookie live in an AsyncLocalStorage
//     context (`withInternalContext`), so two parallel jobs running
//     in the same Lambda instance can NEVER trample each other's auth
//   - the global `fetch` is patched ONCE at module load, and the
//     wrapper consults ALS — never closure variables
// ============================================================

import 'server-only';
import { runAvatarExcavation } from '@/lib/avatars/runAvatarExcavation';
import type {
  CoreAvatarInput,
  SourceConfig,
  AvatarProgressEvent,
} from '@/lib/avatars/types';
import type { RedditDepth } from '@/lib/sources/reddit';
import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';
import { withInternalContext, getInternalContext } from '@/lib/util/internalContext';
import { updateJob } from './db';
import {
  buildCacheKey,
  getCachedFetch,
  putCachedFetch,
} from '@/lib/avatars/excavationCache';

interface RunAvatarJobParams {
  jobId: string;
  baseUrl: string;             // absolute URL of this deployment (for internal /api calls)
  sessionCookie: string;       // cookie header value to pass through to internal calls
  core: CoreAvatarInput;
  config?: SourceConfig;
  redditDepth?: RedditDepth;
  reverseSeeds?: ReverseEngineeredFunnel | null;
  // Two-stage execution. Vercel caps a single function at ~600-800s, less
  // than the full pipeline (fetch ~540s + LLM ~250s ~ 790s+). We split:
  //   stage='fetch'   → Phase 0-2 only, write cache, fire-and-forget call
  //                     to /api/avatars/jobs/[id]/continue, return.
  //   stage='analyze' → load cache, run Phase 2.5+ (LLM phases), return.
  // Each stage gets its own fresh function-duration budget.
  stage?: 'fetch' | 'analyze';
}

// One-shot module-level fetch patch. The wrapper is invariant — it
// always reads from ALS, never from a closure. Multiple jobs nest
// safely because each has its own ALS context.
const ORIGINAL_FETCH = globalThis.fetch;
let fetchPatched = false;
function ensureFetchPatched(): void {
  if (fetchPatched) return;
  fetchPatched = true;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const ctx = getInternalContext();
    if (!ctx?.sessionCookie) return ORIGINAL_FETCH(input, init);

    let url: string;
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else url = input.url;

    let isInternal = false;
    try {
      const parsed = new URL(url, ctx.baseUrl);
      const baseHost = new URL(ctx.baseUrl).host;
      isInternal = parsed.host === baseHost;
    } catch {
      isInternal = true; // relative URL → internal
    }

    if (!isInternal) return ORIGINAL_FETCH(input, init);

    const headers = new Headers(init?.headers);
    const existing = headers.get('cookie');
    headers.set('cookie', existing ? `${existing}; ${ctx.sessionCookie}` : ctx.sessionCookie);
    return ORIGINAL_FETCH(input, { ...init, headers });
  }) as typeof fetch;
}

export async function runAvatarJob(params: RunAvatarJobParams): Promise<void> {
  const { jobId, baseUrl, sessionCookie, core, config, redditDepth, reverseSeeds } = params;
  const stage = params.stage ?? 'fetch';

  ensureFetchPatched();

  await withInternalContext({ baseUrl, sessionCookie }, async () => {
    // Heartbeat ticker — keeps `heartbeat_at` fresh every 30s independent
    // of progress events. Without this, a single long BD poll (Reddit
    // comments alone can run 4+ min silently) lets heartbeat go stale,
    // and the watchdog reaps the run as "Worker timed out — no heartbeat
    // for 721s" even though the worker is alive and progressing.
    const HEARTBEAT_INTERVAL_MS = 30_000;
    const heartbeatTicker = setInterval(() => {
      void updateJob(jobId, { bumpHeartbeat: true }).catch((err) => {
        console.warn(`[avatarWorker:${jobId}] heartbeat tick failed:`, err);
      });
    }, HEARTBEAT_INTERVAL_MS);
    // Don't keep the Vercel function alive just for the ticker.
    if (typeof heartbeatTicker.unref === 'function') heartbeatTicker.unref();

    try {
      await updateJob(jobId, {
        status: 'running',
        phase: 'starting',
        progress: { phase: 'starting', message: 'Worker started — initialising pipeline', percent: 0 },
      });

      let lastProgressWrite = 0;
      const onProgress = (event: AvatarProgressEvent) => {
        // Throttle DB writes — runAvatarExcavation can fire dozens per second
        // during the analyzer parallel wave. 750ms keeps polling responsive
        // without hammering Neon. heartbeat_at gets bumped on EVERY write,
        // which is what the stale-job watchdog checks for.
        const now = Date.now();
        if (now - lastProgressWrite < 750) return;
        lastProgressWrite = now;

        const phaseProgress: Record<string, number> = {
          idle: 0,
          discovery: 8,
          fetching: 22,
          analyzing: 55,
          compiling: 80,
          done: 100,
          error: 0,
        };
        const percent = phaseProgress[event.phase] ?? 50;

        void updateJob(jobId, {
          phase: event.phase,
          progress: {
            phase: event.phase,
            message: event.message,
            percent,
            itemCount: event.itemCount,
          },
          bumpTick: true,
        }).catch((err) => {
          console.warn(`[avatarWorker:${jobId}] progress update failed:`, err);
        });
      };

      // Try the fetch cache so retries after an LLM-phase failure don't
      // re-burn BD credits. Cache key = stable hash of inputs that affect
      // what gets scraped (product/niche/desire/lang/market/config).
      const cacheKey = await buildCacheKey({ core, config, redditDepth });
      const cached = await getCachedFetch(cacheKey);
      const prefetchedData = cached?.data;
      if (prefetchedData) {
        const itemCount = Object.values(prefetchedData)
          .reduce((sum, b) => sum + (b?.itemCount ?? b?.items?.length ?? 0), 0);
        console.log(`[avatarWorker:${jobId}] scrape cache HIT (${itemCount} items, hit=${cached?.hitCount}, expires ${cached?.expiresAt}) — skipping Phase 2`);
      } else {
        console.log(`[avatarWorker:${jobId}] scrape cache MISS for key ${cacheKey.slice(0, 12)}... — full fetch will run`);
      }

      const inputsSummary = `${core.product} | ${core.niche} | ${core.surface_desire ?? ''} | ${core.language}`.slice(0, 200);

      // STAGE 1 ('fetch'): scrape + cache write only, then trigger Stage 2.
      // STAGE 2 ('analyze'): cached data must already be in DB — load it
      //   via prefetchedData and run LLM phases only.
      // Each stage gets its own Vercel function-duration budget.
      if (stage === 'analyze' && !prefetchedData) {
        const errMsg = 'Stage 2 (analyze) called but no cached fetch data found. Stage 1 must have failed before writing cache.';
        console.error(`[avatarWorker:${jobId}] ${errMsg}`);
        await updateJob(jobId, {
          status: 'failed',
          phase: 'error',
          error: errMsg,
          progress: { phase: 'error', message: errMsg, percent: 0 },
        });
        return;
      }

      const result = await runAvatarExcavation({
        core,
        config,
        redditDepth,
        reverseSeeds: reverseSeeds ?? null,
        onProgress,
        prefetchedData,
        // Stage 1 only: stop after Phase 2, return early.
        stopAfterFetch: stage === 'fetch',
        // Fires the moment Phase 2 finishes — persist to cache before any
        // LLM phase (Stage 2) has a chance to time out and void the work.
        onFetchComplete: async (data) => {
          const totalItems = Object.values(data)
            .reduce((sum, b) => sum + (b?.itemCount ?? b?.items?.length ?? 0), 0);
          if (totalItems === 0) return;
          try {
            await putCachedFetch(cacheKey, data, inputsSummary);
            console.log(`[avatarWorker:${jobId}] scrape cache WRITE inline (${totalItems} items, key=${cacheKey.slice(0, 12)}...) — survives downstream crashes`);
          } catch (err) {
            console.warn(`[avatarWorker:${jobId}] inline cache write failed:`, err);
          }
        },
      });

      // STAGE 1 → trigger STAGE 2 in a separate function instance.
      if (stage === 'fetch') {
        // Phase 2 finished AND cache was written. Fire-and-forget POST to
        // /continue so Stage 2 starts in its own function (fresh duration
        // budget). The current function exits after this.
        if (result.fetchData) {
          const totalItems = Object.values(result.fetchData)
            .reduce((sum, b) => sum + (b?.itemCount ?? b?.items?.length ?? 0), 0);
          if (totalItems > 0) {
            try {
              const continueRes = await fetch(`${baseUrl}/api/avatars/jobs/${jobId}/continue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseUrl }),
              });
              if (!continueRes.ok) {
                const txt = await continueRes.text().catch(() => '');
                console.error(`[avatarWorker:${jobId}] Stage 2 trigger failed: HTTP ${continueRes.status} ${txt.slice(0, 200)}`);
                await updateJob(jobId, {
                  status: 'failed',
                  phase: 'error',
                  error: `Stage 2 trigger failed (HTTP ${continueRes.status}). Cached data preserved — retry to resume.`,
                  progress: { phase: 'error', message: 'Failed to trigger LLM stage', percent: 50 },
                });
              } else {
                console.log(`[avatarWorker:${jobId}] Stage 1 done (${totalItems} items cached). Stage 2 triggered.`);
                await updateJob(jobId, {
                  phase: 'analyzing',
                  progress: { phase: 'analyzing', message: `Stage 1 done (${totalItems} items cached). Stage 2 (LLM) starting...`, percent: 50 },
                });
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[avatarWorker:${jobId}] Stage 2 trigger crashed:`, msg);
              await updateJob(jobId, {
                status: 'failed',
                phase: 'error',
                error: `Stage 2 trigger crashed: ${msg}. Cached data preserved — retry to resume.`,
                progress: { phase: 'error', message: msg, percent: 50 },
              });
            }
          } else {
            await updateJob(jobId, {
              status: 'failed',
              phase: 'error',
              error: 'Phase 2 fetch returned 0 items. Check source provider health.',
              progress: { phase: 'error', message: 'Empty fetch — no scrape data', percent: 0 },
            });
          }
        } else {
          await updateJob(jobId, {
            status: 'failed',
            phase: 'error',
            error: 'Stage 1 finished but fetchData missing.',
            progress: { phase: 'error', message: 'No fetch data', percent: 0 },
          });
        }
        return;
      }

      // (Cache write already happened inline via onFetchComplete callback
      // during runAvatarExcavation — nothing more to persist here.)

      if (result.error || !result.result) {
        await updateJob(jobId, {
          status: 'failed',
          phase: 'error',
          error: result.error ?? 'Excavation returned no result',
          progress: { phase: 'error', message: result.error ?? 'No result', percent: 0 },
        });
        return;
      }

      await updateJob(jobId, {
        status: 'completed',
        phase: 'done',
        progress: {
          phase: 'done',
          message: `Done — ${result.result.sub_avatars.length} sub-avatars, ${result.result.metadata.total_verbatims} verbatims`,
          percent: 100,
        },
        result: {
          avatarRunResult: result.result,
          rawText: result.rawText,
          totalTokens: result.totalTokens,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[avatarWorker:${jobId}] crashed:`, err);
      await updateJob(jobId, {
        status: 'failed',
        phase: 'error',
        error: message,
        progress: { phase: 'error', message, percent: 0 },
      }).catch(() => {});
    } finally {
      clearInterval(heartbeatTicker);
    }
  });
}
