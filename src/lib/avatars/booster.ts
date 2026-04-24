// ============================================================
// PAWEN — Booster: iterative feedback-loop deep dive
//
// Runs N sequential deep-dive cycles for ONE sub-avatar. Each
// cycle sees the prior dives and is instructed to go deeper,
// finding angles/fears/verbatims the previous cycles missed.
//
// Bypasses the useDeepDiveJob hook on purpose — hook is single-shot,
// and we need tight sequential control + accumulated priorDives
// across cycles.
//
// Each cycle:
//   1. POST /api/avatars/deep-dive/start with accumulated priorDives
//   2. Poll /api/avatars/jobs/{jobId} every 2.5s
//   3. On completed: append dive to accumulator, call onCycleComplete
//
// Errors in a single cycle abort the whole booster (partial results
// returned to caller via the accumulator).
// ============================================================

import type {
  CoreAvatarInput,
  DeepDiveResult,
  SubAvatarV2,
} from './types';

const POLL_MS = 2500;

export interface BoosterProgress {
  cycle: number;           // 1-indexed
  totalCycles: number;
  phase: string;           // from job.progress.phase
  message: string;         // from job.progress.message
  percent: number;         // 0-100 within current cycle
}

export interface BoosterCallbacks {
  onCycleStart?: (cycle: number, total: number) => void;
  onProgress?: (p: BoosterProgress) => void;
  onCycleComplete?: (cycle: number, dive: DeepDiveResult, allDives: DeepDiveResult[]) => void | Promise<void>;
  onError?: (cycle: number, message: string) => void;
}

interface RunBoosterParams {
  projectId: string;
  core: CoreAvatarInput;
  subAvatar: SubAvatarV2;
  depth: number;                    // 1..10
  callbacks?: BoosterCallbacks;
  signal?: AbortSignal;
}

interface JobSnapshot {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  phase?: string;
  progress?: { phase: string; message: string; percent: number } | null;
  result?: { dive: DeepDiveResult; subAvatarId: string } | null;
  error?: string | null;
}

function buildFocus(cycle: number, priorDiveCount: number): string {
  return (
    `Booster cycle ${cycle}. Prior dives: ${priorDiveCount}. ` +
    `Find angles, hidden fears, verbatims, contradictions, identity markers, and buying objections ` +
    `that are COMPLETELY ABSENT from the prior dives. Go deeper. ` +
    `If the prior dives surfaced surface-level pain, surface the shame layer underneath. ` +
    `If they surfaced the shame, surface the secret fantasy. ` +
    `Every cycle must yield materially new signal — no restating, no rewording.`
  );
}

async function pollUntilDone(
  jobId: string,
  cycle: number,
  totalCycles: number,
  callbacks: BoosterCallbacks | undefined,
  signal: AbortSignal | undefined,
): Promise<DeepDiveResult> {
  let lastPhase: string | null = null;

  while (true) {
    if (signal?.aborted) throw new Error('Booster aborted');

    await new Promise((r) => setTimeout(r, POLL_MS));

    let snap: JobSnapshot | null = null;
    try {
      const res = await fetch(`/api/avatars/jobs/${jobId}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) throw new Error('Job not found (expired).');
        continue;
      }
      const data = await res.json();
      if (!data?.ok || !data.job) continue;
      snap = data.job as JobSnapshot;
    } catch (err) {
      if (err instanceof Error && err.message.includes('expired')) throw err;
      continue;
    }

    if (snap.progress && snap.progress.phase !== lastPhase) {
      lastPhase = snap.progress.phase;
      callbacks?.onProgress?.({
        cycle,
        totalCycles,
        phase: snap.progress.phase,
        message: snap.progress.message,
        percent: snap.progress.percent,
      });
    }

    if (snap.status === 'completed' && snap.result?.dive) {
      return snap.result.dive;
    }
    if (snap.status === 'failed' || snap.status === 'canceled') {
      throw new Error(snap.error ?? `Deep-dive cycle ${cycle} ${snap.status}`);
    }
  }
}

export async function runBooster(params: RunBoosterParams): Promise<DeepDiveResult[]> {
  const { projectId, core, subAvatar, depth, callbacks, signal } = params;
  const clampedDepth = Math.min(10, Math.max(1, Math.floor(depth)));

  // Start from whatever dives already exist on the sub-avatar so the
  // model can compound instead of repeating history it never saw.
  const accumulated: DeepDiveResult[] = [...(subAvatar.deep_dives ?? [])];
  const boosterProduced: DeepDiveResult[] = [];

  for (let cycle = 1; cycle <= clampedDepth; cycle++) {
    if (signal?.aborted) break;
    callbacks?.onCycleStart?.(cycle, clampedDepth);

    let jobId: string;
    try {
      const res = await fetch('/api/avatars/deep-dive/start', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          core,
          subAvatar,
          focus: buildFocus(cycle, accumulated.length),
          priorDives: accumulated,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data.jobId) {
        const msg = data?.message ?? `Failed to start booster cycle ${cycle} (HTTP ${res.status})`;
        console.error('[runBooster] start failed:', { cycle, status: res.status, data });
        callbacks?.onError?.(cycle, msg);
        throw new Error(msg);
      }
      jobId = String(data.jobId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks?.onError?.(cycle, msg);
      throw err;
    }

    try {
      const dive = await pollUntilDone(jobId, cycle, clampedDepth, callbacks, signal);
      accumulated.push(dive);
      boosterProduced.push(dive);
      await callbacks?.onCycleComplete?.(cycle, dive, [...accumulated]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks?.onError?.(cycle, msg);
      throw err;
    }
  }

  return boosterProduced;
}
