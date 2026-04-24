// ============================================================
// PAWEN — /api/avatars/jobs/[id]
// GET — poll status / phase / progress / result for a background
// avatar excavation. The client uses this to render the live
// progress bar and to hydrate the final AvatarRunResult into
// IndexedDB once status === 'completed'.
//
// Ownership is enforced: a session can only read its own jobs.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import { getJobForOwnerWithReap } from '@/lib/jobs/db';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ ok: false, message: 'job id required' }, { status: 400 });

  const job = await getJobForOwnerWithReap(id, session.user);
  if (!job) {
    return NextResponse.json({ ok: false, message: 'job not found' }, { status: 404 });
  }

  // Surface only fields the client cares about. Skip the raw `state` blob —
  // it's the intermediate phase data and the client doesn't need it. The
  // final `result` is included only when the job is complete (avoid
  // streaming partial results to the UI).
  return NextResponse.json({
    ok: true,
    job: {
      id: job.id,
      projectId: job.project_id,
      gateId: job.gate_id,
      type: job.type,
      status: job.status,
      phase: job.phase,
      progress: job.progress,
      result: job.status === 'completed' ? job.result : null,
      error: job.error,
      tickCount: job.tick_count,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      heartbeatAt: job.heartbeat_at,
    },
  });
}
