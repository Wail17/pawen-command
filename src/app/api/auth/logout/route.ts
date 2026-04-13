// ============================================================
// AutoEcom Lab — /api/auth/logout
// Clears the session cookie. Always returns 200.
// ============================================================

import { NextResponse } from 'next/server';
import {
  buildClearSessionCookie,
  getSessionFromRequest,
} from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';

export const maxDuration = 5;

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (session) {
    await writeAudit(req, session.user, 'logout', {});
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', buildClearSessionCookie());
  return res;
}
