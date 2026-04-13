// ============================================================
// AutoEcom Lab — Server-side user registry helpers
// Wraps the app_users table. This is the authoritative source
// for who exists, who's an admin, who's blocked, quotas, etc.
// The client-side APP_USERS list in ./users.ts is now ONLY a
// UI default for bootstrap display and no longer grants access.
// ============================================================

import 'server-only';
import { getSql } from '@/lib/db/client';
import type { AppUserRole, AppUserRow } from '@/lib/db/schema';

type UserLookup = {
  name: string;
  role: AppUserRole;
  enabled: boolean;
};

/**
 * Look up a user for auth. Returns null if the row does not exist or
 * the user is disabled / blocked. Also bumps last_seen_at on success.
 */
export async function lookupUserForAuth(
  name: string,
  ip: string,
): Promise<UserLookup | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT name, role, enabled
    FROM app_users
    WHERE name = ${name}
    LIMIT 1
  `) as UserLookup[];

  const row = rows[0];
  if (!row) return null;
  if (!row.enabled) return null;
  if (row.role === 'blocked') return null;

  // Best-effort bump — don't fail auth if this throws
  try {
    await sql`
      UPDATE app_users
      SET last_seen_at = NOW(), last_seen_ip = ${ip}
      WHERE name = ${name}
    `;
  } catch (err) {
    console.error('[userRegistry] last_seen bump failed:', err);
  }

  return row;
}

/**
 * Return all currently-enabled users (for the post-login picker).
 * Blocked users are excluded; admins appear in the list normally.
 */
export async function listEnabledUsers(): Promise<
  Array<{ name: string; role: AppUserRole }>
> {
  const sql = getSql();
  const rows = (await sql`
    SELECT name, role
    FROM app_users
    WHERE enabled = TRUE AND role <> 'blocked'
    ORDER BY
      CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
      name ASC
  `) as Array<{ name: string; role: AppUserRole }>;
  return rows;
}

/** Return every row (including disabled/blocked). Admin-only use. */
export async function listAllUsers(): Promise<AppUserRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT name, role, enabled, quota_monthly_usd, quota_used_usd,
           quota_reset_at, notes, created_at, last_seen_at, last_seen_ip
    FROM app_users
    ORDER BY
      CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
      name ASC
  `) as AppUserRow[];
  return rows;
}
