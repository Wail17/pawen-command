// ============================================================
// AutoEcom Lab — Admin login
// POST /api/admin/login
// Body: { password: string }
// Returns: { ok: true, token: string } on success, 401 on fail
// ============================================================

import { NextResponse } from 'next/server';
import { getAdminPassword, validateAdminPassword } from '@/lib/auth/adminServer';

export const maxDuration = 10;

export async function POST(req: Request) {
  try {
    const expected = getAdminPassword();
    if (!expected) {
      return NextResponse.json(
        { ok: false, message: 'ADMIN_PASSWORD not configured on the server' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!validateAdminPassword(password)) {
      return NextResponse.json(
        { ok: false, message: 'Wrong admin password' },
        { status: 401 }
      );
    }

    console.log(`[admin:login] success at ${new Date().toISOString()}`);

    // The "token" is the password itself — see adminServer.ts for rationale.
    return NextResponse.json({ ok: true, token: expected });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:login] error:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
