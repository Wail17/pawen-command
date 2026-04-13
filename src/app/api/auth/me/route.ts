// ============================================================
// AutoEcom Lab — /api/auth/me
// Returns the current session user (or 401). Used by the client
// to hydrate auth state on page load without shipping the
// password to the bundle.
// ============================================================

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';

export const maxDuration = 5;

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: { name: session.user, role: session.role },
    exp: session.exp,
  });
}
