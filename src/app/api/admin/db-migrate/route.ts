// ============================================================
// AutoEcom Lab — Admin DB migration endpoint
// POST /api/admin/db-migrate
// Requires: x-admin-token header matching ADMIN_PASSWORD env var
// Idempotent: safe to run multiple times.
// ============================================================

import { NextResponse } from 'next/server';
import { runMigrations } from '@/lib/db/migrate';
import { requireAdmin } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { isAdminRequest } from '@/lib/auth/adminServer';

export const maxDuration = 60;

export async function POST(req: Request) {
  // Accept both paths:
  //   1. Cookie-session admin (new)
  //   2. Legacy x-admin-token header (kept until every tool migrates)
  const session = requireAdmin(req);
  const legacyAdmin = isAdminRequest(req);
  if (session instanceof Response && !legacyAdmin) return session;

  const who = session instanceof Response ? 'legacy-admin-token' : session.user;

  try {
    const result = await runMigrations();
    console.log(`[admin:db-migrate] applied: ${result.applied.join(', ')} by ${who}`);
    await writeAudit(req, who, 'migrate.run', {
      applied: result.applied,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:db-migrate] error:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
