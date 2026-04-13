// ============================================================
// AutoEcom Lab — /api/admin/projects
// Lists every project across every user. Returns lightweight
// metadata only (no big data blobs) — the drill-down endpoint
// at /api/admin/projects/[id] returns the full JSON.
//
// Query params:
//   ?owner=<name>   filter to one user
//   ?q=<search>     case-insensitive search over name
//   ?limit=<N>      default 100, max 500
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';

export const maxDuration = 15;

export async function GET(req: Request) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const owner = url.searchParams.get('owner');
  const q = url.searchParams.get('q');
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '100', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);

  try {
    const sql = getSql();

    // Use JSONB path ops to surface a few fields the list view needs,
    // without shipping the entire data blob.
    // data->>'niche', data->>'targetMarket', etc.
    const rows = (await sql`
      SELECT
        id,
        owner,
        name,
        created_at,
        updated_at,
        data->>'niche'         AS niche,
        data->>'targetMarket'  AS target_market,
        data->>'targetLanguage' AS target_language,
        data->>'currentGate'   AS current_gate,
        data->>'selectedSubAvatarId' AS selected_sub_avatar_id,
        (data->>'productUrl')  AS product_url,
        (
          SELECT COUNT(*)::int
          FROM gate_outputs_mirror g
          WHERE g.project_id = projects_mirror.id
        ) AS gate_count
      FROM projects_mirror
      WHERE (${owner}::text IS NULL OR owner = ${owner})
        AND (${q}::text IS NULL OR name ILIKE '%' || ${q} || '%')
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;

    await writeAudit(req, session.user, 'admin.view', {
      view: 'projects',
      owner,
      q,
      count: rows.length,
    });

    return NextResponse.json({ ok: true, projects: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:projects] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
