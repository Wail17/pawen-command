// ============================================================
// PAWEN — /api/hive/projects   (Phase W extension)
// Returns project metadata across all owners. Used by /hive to
// render each island's projects inline. Only metadata (name +
// niche + ownerId + gate progress) — no full project content.
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 15;

export async function GET(req: Request) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const sql = getSql();
    type Row = { id: string; owner: string; name: string; data: Record<string, unknown> };
    const rows = (await sql`
      SELECT id, owner, name, data
      FROM projects_mirror
      ORDER BY updated_at DESC
      LIMIT 500
    `) as Row[];

    return NextResponse.json({
      ok: true,
      projects: rows.map(r => {
        const data = (r.data ?? {}) as Record<string, unknown>;
        const statuses = (data.gateStatuses ?? {}) as Record<string, string>;
        const approved = Object.values(statuses).filter(s => s === 'approved').length;
        const total = Object.keys(statuses).length || 10;
        return {
          id: r.id,
          name: r.name ?? (typeof data.name === 'string' ? data.name : 'untitled'),
          ownerId: r.owner,
          niche: typeof data.niche === 'string' ? data.niche : '',
          language: typeof data.targetLanguage === 'string' ? data.targetLanguage : '',
          progress: { approved, total },
        };
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: msg, projects: [] }, { status: 500 });
  }
}
