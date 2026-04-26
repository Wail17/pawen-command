// ============================================================
// PAWEN — Zombie job reaper (Inngest cron)
//
// pipeline_jobs rows can drift into a perpetual `running` state when
// a Vercel function is killed mid-execution and never gets a chance
// to write `failed`. The original watchdog (reapStaleJob in db.ts)
// only fires when the job is read — if no client polls, it stays
// alive forever in the DB.
//
// This cron runs every 15 min and marks any `running` job whose
// heartbeat hasn't advanced in >30 min as failed. Inngest guarantees
// the schedule even when no human is online.
// ============================================================

import 'server-only';
import { inngest } from '../client';
import { getSql } from '@/lib/db/client';

export const zombieReaperFn = inngest.createFunction(
  {
    id: 'pipeline-zombie-reaper',
    triggers: [{ cron: '*/15 * * * *' }],
    // Idempotent — running it twice in the same window is harmless.
    retries: 0,
  },
  async ({ step, logger }) => {
    const reaped = await step.run('reap-stale-running-jobs', async () => {
      const sql = getSql();
      const errMsg = 'Worker timed out (zombie reaper) — no heartbeat for >30 min. Vercel function likely hit its execution cap.';
      const progressJson = JSON.stringify({
        phase: 'error',
        message: errMsg,
        percent: 0,
      });
      const rows = await sql`
        UPDATE pipeline_jobs
        SET status = 'failed',
            phase = 'error',
            error = ${errMsg},
            progress = ${progressJson}::jsonb,
            updated_at = NOW()
        WHERE status = 'running'
          AND heartbeat_at < NOW() - INTERVAL '30 minutes'
        RETURNING id, type, created_at
      `;
      return rows as Array<{ id: string; type: string; created_at: string }>;
    });

    if (reaped.length > 0) {
      logger.warn(`[zombie-reaper] reaped ${reaped.length} stale jobs:`, reaped.map(r => r.id));
    } else {
      logger.info('[zombie-reaper] no stale jobs');
    }
    return { reaped: reaped.length, ids: reaped.map(r => r.id) };
  },
);
