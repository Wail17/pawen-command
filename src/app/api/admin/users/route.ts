// ============================================================
// AutoEcom Lab — /api/admin/users
//
//   GET  /api/admin/users           list all users (including blocked)
//   POST /api/admin/users           create or update a user
//     body: { name, role?, enabled?, quota_monthly_usd?, notes? }
//   DELETE /api/admin/users?name=X  delete a user
//
// Admin-only. Self-sabotage guard: an admin cannot delete themself
// or downgrade themself below admin — prevents accidental lockout.
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/session';
import { listAllUsers } from '@/lib/auth/userRegistry';
import { writeAudit } from '@/lib/auth/audit';
import type { AppUserRole } from '@/lib/db/schema';

export const maxDuration = 15;

const VALID_ROLES: AppUserRole[] = ['admin', 'user', 'blocked'];

type UpsertBody = {
  name?: unknown;
  role?: unknown;
  enabled?: unknown;
  quota_monthly_usd?: unknown;
  notes?: unknown;
};

export async function GET(req: Request) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  try {
    const users = await listAllUsers();
    return NextResponse.json({ ok: true, users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:users:GET] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Invalid JSON' },
      { status: 400 },
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json(
      { ok: false, message: 'name is required' },
      { status: 400 },
    );
  }

  const role =
    typeof body.role === 'string' && (VALID_ROLES as string[]).includes(body.role)
      ? (body.role as AppUserRole)
      : null;
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : null;
  const quota =
    typeof body.quota_monthly_usd === 'number' && body.quota_monthly_usd >= 0
      ? body.quota_monthly_usd
      : null;
  const notes = typeof body.notes === 'string' ? body.notes : null;

  // Self-sabotage guard
  if (name === session.user) {
    if (role && role !== 'admin') {
      return NextResponse.json(
        { ok: false, message: 'Refusing to downgrade yourself' },
        { status: 400 },
      );
    }
    if (enabled === false) {
      return NextResponse.json(
        { ok: false, message: 'Refusing to disable yourself' },
        { status: 400 },
      );
    }
  }

  try {
    const sql = getSql();
    // Upsert — existing row is updated, non-existing is created with
    // sane defaults. Only fields that were explicitly provided in the
    // body are overwritten.
    await sql`
      INSERT INTO app_users (name, role, enabled, quota_monthly_usd, notes)
      VALUES (
        ${name},
        ${role ?? 'user'},
        ${enabled ?? true},
        ${quota ?? 100},
        ${notes}
      )
      ON CONFLICT (name) DO UPDATE SET
        role              = COALESCE(${role}, app_users.role),
        enabled           = COALESCE(${enabled}, app_users.enabled),
        quota_monthly_usd = COALESCE(${quota}, app_users.quota_monthly_usd),
        notes             = COALESCE(${notes}, app_users.notes)
    `;

    await writeAudit(req, session.user, 'user.update', { target: name, role, enabled, quota, notes });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:users:POST] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const name = url.searchParams.get('name');
  if (!name) {
    return NextResponse.json(
      { ok: false, message: 'name query param required' },
      { status: 400 },
    );
  }

  if (name === session.user) {
    return NextResponse.json(
      { ok: false, message: 'Refusing to delete yourself' },
      { status: 400 },
    );
  }

  try {
    const sql = getSql();
    await sql`DELETE FROM app_users WHERE name = ${name}`;
    await writeAudit(req, session.user, 'user.delete', { target: name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:users:DELETE] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
