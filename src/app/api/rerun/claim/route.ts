// ============================================================
// PAWEN — /api/rerun/claim
//
// Phase U.3b — claim a pending rerun row. Returns the row if
// successfully claimed (atomic UPDATE … WHERE status='pending').
// If another client claimed first, returns { ok: true, claimed: null }.
//
//   POST  { id }
//     → { ok, claimed: { id, projectId, gateId, reason, severity } | null }
//
//   POST  { id, status: 'done' | 'cancelled' }
//     → { ok }   (mark a claimed row done/cancelled)
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';

export const maxDuration = 10;

export async function POST(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body: { id?: number | string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: 'Invalid id' }, { status: 400 });
  }

  const sql = getSql();

  // If caller marks a row done/cancelled, handle that branch.
  if (body.status === 'done' || body.status === 'cancelled') {
    const status = body.status;
    const updated = (await sql`
      UPDATE rerun_queue
      SET status = ${status}
      WHERE id = ${id} AND status = 'claimed' AND claimed_by = ${session.user}
      RETURNING id
    `) as Array<{ id: number }>;
    if (updated.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'Row not in claimed state or not owned by caller' },
        { status: 409 },
      );
    }
    await writeAudit(req, session.user, 'phase_u.rerun.claim', { id, status });
    return NextResponse.json({ ok: true, id, status });
  }

  // Default: atomic claim
  type ClaimedRow = {
    id: number;
    project_id: string;
    gate_id: string;
    reason: string;
    severity: string;
    source: string;
  };
  const rows = (await sql`
    UPDATE rerun_queue
    SET status = 'claimed', picked_at = NOW(), claimed_by = ${session.user}
    WHERE id = ${id} AND status = 'pending'
    RETURNING id, project_id, gate_id, reason, severity, source
  `) as ClaimedRow[];

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, claimed: null });
  }

  const r = rows[0];
  await writeAudit(req, session.user, 'phase_u.rerun.claim', {
    id: r.id,
    projectId: r.project_id,
    gateId: r.gate_id,
    severity: r.severity,
  });

  return NextResponse.json({
    ok: true,
    claimed: {
      id: r.id,
      projectId: r.project_id,
      gateId: r.gate_id,
      reason: r.reason,
      severity: r.severity,
      source: r.source,
    },
  });
}
