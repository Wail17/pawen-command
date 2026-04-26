// ============================================================
// PAWEN — Pipeline Jobs DB helpers
// CRUD against pipeline_jobs. Server-only (Neon).
// ============================================================

import 'server-only';
import { getSql } from '@/lib/db/client';
import type {
  PipelineJobRow,
  PipelineJobStatus,
  PipelineJobType,
} from '@/lib/db/schema';

interface CreateJobInput {
  id: string;
  owner: string;
  projectId: string;
  gateId: string;
  type: PipelineJobType;
  payload: Record<string, unknown>;
}

export async function createJob(input: CreateJobInput): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO pipeline_jobs (id, owner, project_id, gate_id, type, status, phase, payload)
    VALUES (
      ${input.id},
      ${input.owner},
      ${input.projectId},
      ${input.gateId},
      ${input.type},
      'pending',
      'queued',
      ${JSON.stringify(input.payload)}::jsonb
    )
  `;
}

function mapRow(row: Record<string, unknown>): PipelineJobRow {
  return {
    id: String(row.id),
    owner: String(row.owner),
    project_id: String(row.project_id),
    gate_id: String(row.gate_id),
    type: row.type as PipelineJobType,
    status: row.status as PipelineJobStatus,
    phase: String(row.phase ?? ''),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    state: (row.state ?? {}) as Record<string, unknown>,
    progress: (row.progress ?? {}) as PipelineJobRow['progress'],
    result: (row.result ?? null) as Record<string, unknown> | null,
    error: row.error ? String(row.error) : null,
    tick_count: Number(row.tick_count ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    heartbeat_at: String(row.heartbeat_at),
  };
}

export async function getJob(id: string): Promise<PipelineJobRow | null> {
  const sql = getSql();
  const rows = (await sql`SELECT * FROM pipeline_jobs WHERE id = ${id} LIMIT 1`) as Record<
    string,
    unknown
  >[];
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function getJobForOwner(
  id: string,
  owner: string,
): Promise<PipelineJobRow | null> {
  const job = await getJob(id);
  if (!job) return null;
  if (job.owner !== owner) return null;
  return job;
}

// Stale-job watchdog. Vercel functions can be killed mid-run (timeout,
// OOM, instance recycle) — when that happens the worker stops bumping
// heartbeat_at but the row is still 'running'. Without this, the client
// would poll forever. We mark any 'running' job whose heartbeat hasn't
// advanced for STALE_AFTER_MS as failed, with a clear error message.
// 12 min — the Amazon BD scrape alone can take ~290s without writing a
// progress event (no heartbeat during BD poll loop). Plus YouTube/TikTok
// can stretch up to 270s. 5 min was too tight; 12 covers the worst case
// while still catching genuinely-dead workers within a reasonable window.
const STALE_AFTER_MS = 12 * 60 * 1000;

export async function reapStaleJob(job: PipelineJobRow): Promise<PipelineJobRow> {
  if (job.status !== 'running' && job.status !== 'pending') return job;
  const heartbeatMs = Date.parse(job.heartbeat_at);
  if (!Number.isFinite(heartbeatMs)) return job;
  const ageMs = Date.now() - heartbeatMs;
  if (ageMs <= STALE_AFTER_MS) return job;

  const message = `Worker timed out — no heartbeat for ${Math.floor(ageMs / 1000)}s. Vercel function likely hit its execution cap.`;
  await updateJob(job.id, {
    status: 'failed',
    phase: 'error',
    error: message,
    progress: { phase: 'error', message, percent: 0 },
  }).catch(() => {});

  return {
    ...job,
    status: 'failed',
    phase: 'error',
    error: message,
    progress: { phase: 'error', message, percent: 0 },
  };
}

// Convenience: wraps getJobForOwner with auto-reap so callers always
// see the corrected status.
export async function getJobForOwnerWithReap(
  id: string,
  owner: string,
): Promise<PipelineJobRow | null> {
  const job = await getJobForOwner(id, owner);
  if (!job) return null;
  return reapStaleJob(job);
}

export async function cancelJob(id: string, owner: string): Promise<boolean> {
  const job = await getJobForOwner(id, owner);
  if (!job) return false;
  if (job.status === 'completed' || job.status === 'failed') return true;
  await updateJob(id, {
    status: 'failed',
    phase: 'error',
    error: 'Canceled by user',
    progress: { phase: 'error', message: 'Canceled by user', percent: 0 },
  });
  return true;
}

interface UpdateJobInput {
  status?: PipelineJobStatus;
  phase?: string;
  progress?: PipelineJobRow['progress'];
  state?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  bumpTick?: boolean;
  bumpHeartbeat?: boolean;
}

export async function updateJob(id: string, patch: UpdateJobInput): Promise<void> {
  const sql = getSql();
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let i = 1;

  if (patch.status !== undefined) {
    sets.push(`status = $${i++}`);
    values.push(patch.status);
  }
  if (patch.phase !== undefined) {
    sets.push(`phase = $${i++}`);
    values.push(patch.phase);
  }
  if (patch.progress !== undefined) {
    sets.push(`progress = $${i++}::jsonb`);
    values.push(JSON.stringify(patch.progress));
  }
  if (patch.state !== undefined) {
    sets.push(`state = $${i++}::jsonb`);
    values.push(JSON.stringify(patch.state));
  }
  if (patch.result !== undefined) {
    sets.push(`result = $${i++}::jsonb`);
    values.push(patch.result === null ? null : JSON.stringify(patch.result));
  }
  if (patch.error !== undefined) {
    sets.push(`error = $${i++}`);
    values.push(patch.error);
  }
  if (patch.bumpTick) {
    sets.push(`tick_count = tick_count + 1`);
  }
  if (patch.bumpHeartbeat !== false) {
    // default: heartbeat on every update
    sets.push(`heartbeat_at = NOW()`);
  }

  const idParam = i;
  values.push(id);

  // Neon serverless driver supports parameterized template tag, but the
  // dynamic SET clause is cleaner via raw query. Use sql.unsafe-style by
  // constructing with the query helper.
  const query = `UPDATE pipeline_jobs SET ${sets.join(', ')} WHERE id = $${idParam}`;
  // Neon's `sql` tag has a `query` method for raw SQL with params.
  await (sql as unknown as { query: (q: string, p: unknown[]) => Promise<unknown> }).query(
    query,
    values,
  );
}

export async function listActiveJobsForOwner(owner: string): Promise<PipelineJobRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM pipeline_jobs
    WHERE owner = ${owner}
      AND status IN ('pending', 'running')
    ORDER BY updated_at DESC
    LIMIT 20
  `) as Record<string, unknown>[];
  return rows.map(mapRow);
}

export async function listJobsForProject(
  projectId: string,
  owner: string,
  limit = 10,
): Promise<PipelineJobRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM pipeline_jobs
    WHERE project_id = ${projectId}
      AND owner = ${owner}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `) as Record<string, unknown>[];
  return rows.map(mapRow);
}
