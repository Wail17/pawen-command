// ============================================================
// PAWEN — /api/rerun/pending
//
// Phase U.3b — return pending rerun rows for a given project.
// Client polls this when autonomous mode is on, then claims via
// /api/rerun/claim before executing the gate locally.
//
//   GET /api/rerun/pending?projectId=<id>
//     → { ok, rows: [{ id, projectId, gateId, reason, severity, source, status, createdAt }] }
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 10;

async function ensureTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS rerun_queue (
      id            BIGSERIAL PRIMARY KEY,
      project_id    TEXT NOT NULL,
      gate_id       TEXT NOT NULL,
      reason        TEXT NOT NULL,
      severity      TEXT NOT NULL,
      source        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      picked_at     TIMESTAMPTZ,
      claimed_by    TEXT
    )
  `;
}

export async function GET(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');

  try {
    await ensureTable();
    const sql = getSql();
    type Row = {
      id: number;
      project_id: string;
      gate_id: string;
      reason: string;
      severity: string;
      source: string;
      status: string;
      created_at: string;
    };

    const rows = projectId
      ? (await sql`
          SELECT id, project_id, gate_id, reason, severity, source, status, created_at
          FROM rerun_queue
          WHERE project_id = ${projectId}
            AND status IN ('pending', 'needs_human')
          ORDER BY created_at DESC
          LIMIT 50
        `) as Row[]
      : (await sql`
          SELECT id, project_id, gate_id, reason, severity, source, status, created_at
          FROM rerun_queue
          WHERE status IN ('pending', 'needs_human')
          ORDER BY created_at DESC
          LIMIT 100
        `) as Row[];

    return NextResponse.json({
      ok: true,
      rows: rows.map(r => ({
        id: r.id,
        projectId: r.project_id,
        gateId: r.gate_id,
        reason: r.reason,
        severity: r.severity,
        source: r.source,
        status: r.status,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
