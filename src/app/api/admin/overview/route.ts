// ============================================================
// AutoEcom Lab — /api/admin/overview
// God-panel homepage data: high-level counts + recent activity.
// Admin only. Defense-in-depth via requireAdmin().
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/session';

export const maxDuration = 15;

export async function GET(req: Request) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  try {
    const sql = getSql();

    const [
      userCounts,
      projectCounts,
      gateCounts,
      recentLogins,
      recentWrites,
      failedLogins,
    ] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
          COUNT(*) FILTER (WHERE role = 'blocked')::int AS blocked,
          COUNT(*) FILTER (WHERE enabled = FALSE)::int AS disabled
        FROM app_users
      `,
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(DISTINCT owner)::int AS owners
        FROM projects_mirror
      `,
      sql`SELECT COUNT(*)::int AS total FROM gate_outputs_mirror`,
      sql`
        SELECT user_name, ip, created_at
        FROM audit_log
        WHERE action = 'login.success'
        ORDER BY created_at DESC
        LIMIT 10
      `,
      sql`
        SELECT user_name, action, details, created_at
        FROM audit_log
        WHERE action IN ('project.upsert', 'gate.upsert', 'project.delete', 'gate.delete')
        ORDER BY created_at DESC
        LIMIT 15
      `,
      sql`
        SELECT COUNT(*)::int AS c
        FROM login_attempts
        WHERE success = FALSE AND created_at > NOW() - INTERVAL '24 hours'
      `,
    ]);

    return NextResponse.json({
      ok: true,
      users: (userCounts as unknown[])[0] ?? { total: 0, admins: 0, blocked: 0, disabled: 0 },
      projects: (projectCounts as unknown[])[0] ?? { total: 0, owners: 0 },
      gateOutputs: (gateCounts as unknown[])[0] ?? { total: 0 },
      recentLogins,
      recentWrites,
      failedLoginsLast24h: ((failedLogins as Array<{ c: number }>)[0]?.c) ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:overview] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
