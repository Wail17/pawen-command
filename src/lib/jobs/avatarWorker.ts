// ============================================================
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

interface RunAvatarJobParams {
  jobId: string;
  baseUrl: string;             // absolute URL of this deployment (for internal /api calls)
  sessionCookie: string;       // cookie header value to pass through to internal calls
  core: CoreAvatarInput;
  config?: SourceConfig;
  redditDepth?: RedditDepth;
  reverseSeeds?: ReverseEngineeredFunnel | null;
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

  ensureFetchPatched();

  await withInternalContext({ baseUrl, sessionCookie }, async () => {
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

      const result = await runAvatarExcavation({
        core,
        config,
        redditDepth,
        reverseSeeds: reverseSeeds ?? null,
        onProgress,
      });

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
    }
  });
}
