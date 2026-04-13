// ============================================================
// AutoEcom Lab — /api/admin/audit
// Paginated audit log. Admin only.
//
// Query params:
//   ?user=<name>    filter to one user
//   ?action=<name>  filter to one action
//   ?since=<iso>    only entries after this timestamp
//   ?limit=<N>      default 200, max 1000
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/session';
import type { AuditLogRow } from '@/lib/db/schema';

export const maxDuration = 15;

export async function GET(req: Request) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const userName = url.searchParams.get('user');
  const action = url.searchParams.get('action');
  const since = url.searchParams.get('since');
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '200', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 200, 1), 1000);

  try {
    const sql = getSql();

    // Neon tagged-template bindings don't support partial WHERE
    // composition, so we thread nulls through COALESCE-style
    // guards. All filters are optional.
    const rows = (await sql`
      SELECT id, user_name, action, details, ip, user_agent, created_at
      FROM audit_log
      WHERE (${userName}::text IS NULL OR user_name = ${userName})
        AND (${action}::text IS NULL OR action = ${action})
        AND (${since}::timestamptz IS NULL OR created_at >= ${since}::timestamptz)
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as AuditLogRow[];

    return NextResponse.json({ ok: true, entries: rows, filters: { userName, action, since, limit } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:audit] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
