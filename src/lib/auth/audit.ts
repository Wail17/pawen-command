// ============================================================
// AutoEcom Lab — Audit log writer (server only)
// Append-only writes to the audit_log Neon table. Never throws
// from the caller's perspective — a logging failure must not
// break the underlying action.
// ============================================================

import 'server-only';
import { getSql } from '@/lib/db/client';
import { getClientIp } from './session';

export type AuditAction =
  | 'login.success'
  | 'login.failure'
  | 'logout'
  | 'admin.login.success'
  | 'admin.login.failure'
  | 'project.upsert'
  | 'project.delete'
  | 'gate.upsert'
  | 'gate.upsert_rejected'
  | 'gate.delete'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'admin.view'
  | 'migrate.run'
  | 'contribute.create'
  | 'contribute.delete'
  | 'curate.run'
  | 'avatar.awareness.generate'
  | 'avatar.classify.generate'
  | 'avatar.deepdive.generate'
  | 'avatar.localize.generate'
  | 'avatar.enrich_reverse.generate'
  | 'avatar.job.start'
  | 'context.import'
  | 'rate_limit.hit'
  | 'suspicious.bulk_export'
  | 'suspicious.rapid_fire'
  // Phase U — Autonomous mode
  | 'phase_u.distill'
  | 'phase_u.constitution.update'
  | 'phase_u.meta.perf_pull'
  | 'phase_u.rerun.enqueue'
  | 'phase_u.rerun.claim'
  | 'phase_u.scout.run';

export async function writeAudit(
  req: Request,
  userName: string,
  action: AuditAction,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    const sql = getSql();
    const ip = getClientIp(req);
    const ua = req.headers.get('user-agent') ?? null;
    await sql`
      INSERT INTO audit_log (user_name, action, details, ip, user_agent)
      VALUES (${userName}, ${action}, ${JSON.stringify(details)}::jsonb, ${ip}, ${ua})
    `;
  } catch (err) {
    // Logging must never crash the caller. Just log to server console.
    console.error('[audit] write failed:', err, { userName, action });
  }
}
