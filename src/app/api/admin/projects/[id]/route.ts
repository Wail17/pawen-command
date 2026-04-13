// ============================================================
// AutoEcom Lab — /api/admin/projects/[id]
//
// Full drill-down for ONE project. Returns:
//   - project row (the entire data JSONB — core avatar input,
//     avatar run result with sub-avatars, selected sub-avatar, etc.)
//   - every gate output row for this project (entire data JSONB)
//
// This is the endpoint the god panel hits when an admin clicks
// on a project and wants to see EVERYTHING the user entered,
// generated, picked. Nothing is filtered.
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import type { ProjectsMirrorRow, GateOutputsMirrorRow } from '@/lib/db/schema';

export const maxDuration = 15;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json(
      { ok: false, message: 'Missing project id' },
      { status: 400 },
    );
  }

  try {
    const sql = getSql();

    const projectRows = (await sql`
      SELECT id, owner, name, data, created_at, updated_at
      FROM projects_mirror
      WHERE id = ${id}
      LIMIT 1
    `) as ProjectsMirrorRow[];

    if (!projectRows[0]) {
      return NextResponse.json(
        { ok: false, message: 'Project not found' },
        { status: 404 },
      );
    }

    const gateRows = (await sql`
      SELECT id, project_id, gate_id, owner, status, data, created_at, updated_at
      FROM gate_outputs_mirror
      WHERE project_id = ${id}
      ORDER BY
        CASE gate_id
          WHEN 'gate1' THEN 1
          WHEN 'gate2' THEN 2
          WHEN 'gate3' THEN 3
          WHEN 'brand-dna' THEN 4
          WHEN 'gate4' THEN 5
          WHEN 'gate5' THEN 6
          WHEN 'gate6' THEN 7
          WHEN 'gate7' THEN 8
          WHEN 'gate8' THEN 9
          WHEN 'gate9' THEN 10
          ELSE 99
        END
    `) as GateOutputsMirrorRow[];

    await writeAudit(req, session.user, 'admin.view', {
      view: 'project',
      projectId: id,
      gateCount: gateRows.length,
    });

    return NextResponse.json({
      ok: true,
      project: projectRows[0],
      gateOutputs: gateRows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:projects:id] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
