// ============================================================
// PAWEN — Inngest job-update helper
//
// Wraps a sql UPDATE on pipeline_jobs so each step.run() can stamp
// its current phase + progress without going through the throttled
// onProgress callback. Heartbeat refreshed on every call so the
// zombie reaper sees fresh activity.
// ============================================================

import 'server-only';
import { getSql } from '@/lib/db/client';

const PHASE_PERCENT: Record<string, number> = {
  starting: 0,
  discovery: 8,
  fetching: 22,
  analyzing: 55,
  compiling: 80,
  done: 100,
  error: 0,
};

export async function markPhase(
  jobId: string,
  phase: string,
  message: string,
  percentOverride?: number,
  itemCount?: number,
): Promise<void> {
  const percent = percentOverride ?? PHASE_PERCENT[phase] ?? 50;
  const progressJson = JSON.stringify({ phase, message, percent, itemCount });
  const sql = getSql();
  try {
    await sql`
      UPDATE pipeline_jobs
      SET phase = ${phase},
          progress = ${progressJson}::jsonb,
          heartbeat_at = NOW(),
          updated_at = NOW(),
          tick_count = tick_count + 1
      WHERE id = ${jobId}
    `;
  } catch (err) {
    console.warn(`[markPhase:${jobId}] update failed:`, err);
  }
}

export async function markCompleted(
  jobId: string,
  result: Record<string, unknown>,
  message: string,
): Promise<void> {
  const progressJson = JSON.stringify({ phase: 'done', message, percent: 100 });
  const resultJson = JSON.stringify(result);
  const sql = getSql();
  await sql`
    UPDATE pipeline_jobs
    SET status = 'completed',
        phase = 'done',
        progress = ${progressJson}::jsonb,
        result = ${resultJson}::jsonb,
        heartbeat_at = NOW(),
        updated_at = NOW()
    WHERE id = ${jobId}
  `;
}

export async function markFailed(
  jobId: string,
  errorMessage: string,
  phase: string = 'error',
): Promise<void> {
  const progressJson = JSON.stringify({ phase: 'error', message: errorMessage, percent: 0 });
  const sql = getSql();
  await sql`
    UPDATE pipeline_jobs
    SET status = 'failed',
        phase = ${phase},
        error = ${errorMessage},
        progress = ${progressJson}::jsonb,
        updated_at = NOW()
    WHERE id = ${jobId}
  `;
}
