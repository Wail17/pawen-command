// ============================================================
// AutoEcom Lab — /api/sync/bootstrap
//
// Client hydration endpoint. Called on first load after login so
// a user on a fresh device / cleared browser can pull back all of
// their projects + gate outputs from the Neon mirror.
//
// Returns ONLY the caller's own data. Admins do NOT pull everybody
// here — that's what /admin/* read endpoints are for. This is the
// per-user restore path.
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/session';
import type { ProjectsMirrorRow, GateOutputsMirrorRow } from '@/lib/db/schema';

export const maxDuration = 15;

export async function GET(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const sql = getSql();

    const projects = (await sql`
      SELECT id, owner, name, data, created_at, updated_at
      FROM projects_mirror
      WHERE owner = ${session.user}
      ORDER BY updated_at DESC
    `) as ProjectsMirrorRow[];

    const gateOutputs = (await sql`
      SELECT id, project_id, gate_id, owner, status, data, created_at, updated_at
      FROM gate_outputs_mirror
      WHERE owner = ${session.user}
      ORDER BY updated_at DESC
    `) as GateOutputsMirrorRow[];

    // We ship the JSONB `data` columns verbatim — the client knows
    // how to re-hydrate them into its IndexedDB stores.
    return NextResponse.json({
      ok: true,
      user: session.user,
      projects: projects.map((p) => p.data),
      gateOutputs: gateOutputs.map((g) => g.data),
      counts: {
        projects: projects.length,
        gateOutputs: gateOutputs.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sync:bootstrap] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
