// ============================================================
// AutoEcom Lab — /api/auth/login
// Body: { password: string, user: string }
//
// Flow:
//   1. Rate-limit by IP (5 failures / 15 min)
//   2. Verify password against APP_PASSWORD
//   3. Look up user in app_users (must exist, be enabled, not blocked)
//   4. Issue HMAC-signed session cookie
//
// The password check and the user lookup are both server-side.
// NEXT_PUBLIC_APP_PASSWORD is DEAD — no secret in the client bundle.
// ============================================================

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSql } from '@/lib/db/client';
import { lookupUserForAuth } from '@/lib/auth/userRegistry';
import {
  signSession,
  buildSessionCookie,
  getClientIp,
} from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';

export const maxDuration = 10;

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MINUTES = 15;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

async function recordAttempt(ip: string, success: boolean): Promise<void> {
  try {
    const sql = getSql();
    await sql`INSERT INTO login_attempts (ip, success) VALUES (${ip}, ${success})`;
  } catch (err) {
    console.error('[auth:login] attempt record failed:', err);
  }
}

async function isIpBlocked(ip: string): Promise<boolean> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT COUNT(*)::int AS failures
      FROM login_attempts
      WHERE ip = ${ip}
        AND success = FALSE
        AND created_at > NOW() - (${ATTEMPT_WINDOW_MINUTES} || ' minutes')::interval
    `) as Array<{ failures: number }>;
    return (rows[0]?.failures ?? 0) >= MAX_FAILED_ATTEMPTS;
  } catch (err) {
    console.error('[auth:login] rate check failed:', err);
    return false; // fail-open for DB errors (don't lock legit users out)
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // 0. Require APP_PASSWORD to be configured
  const expected = process.env.APP_PASSWORD;
  if (!expected || expected.length < 12) {
    return NextResponse.json(
      { ok: false, message: 'APP_PASSWORD not configured on the server' },
      { status: 500 },
    );
  }

  // 1. Rate limit by IP
  if (await isIpBlocked(ip)) {
    return NextResponse.json(
      {
        ok: false,
        message: `Too many failed attempts. Wait ${ATTEMPT_WINDOW_MINUTES} min.`,
      },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  const userName = typeof body?.user === 'string' ? body.user : '';

  if (!password || !userName) {
    await recordAttempt(ip, false);
    return NextResponse.json(
      { ok: false, message: 'Password and user are required' },
      { status: 400 },
    );
  }

  // 2. Password check (constant-time)
  if (!safeEqual(password, expected)) {
    await recordAttempt(ip, false);
    await writeAudit(req, userName, 'login.failure', { reason: 'bad_password' });
    return NextResponse.json({ ok: false, message: 'Wrong password' }, { status: 401 });
  }

  // 3. User must exist, be enabled, and not blocked
  const user = await lookupUserForAuth(userName, ip);
  if (!user) {
    await recordAttempt(ip, false);
    await writeAudit(req, userName, 'login.failure', {
      reason: 'user_not_found_or_disabled',
    });
    return NextResponse.json(
      { ok: false, message: 'Unknown or disabled user' },
      { status: 401 },
    );
  }

  // 4. Issue session
  await recordAttempt(ip, true);
  await writeAudit(req, user.name, 'login.success', { role: user.role });

  const token = signSession(user.name, user.role);
  const cookie = buildSessionCookie(token);

  const res = NextResponse.json({
    ok: true,
    user: { name: user.name, role: user.role },
  });
  res.headers.set('Set-Cookie', cookie);
  return res;
}
