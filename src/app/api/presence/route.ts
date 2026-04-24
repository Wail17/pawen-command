// ============================================================
// PAWEN — /api/presence — Real-time user presence tracking
// POST = heartbeat (every 30s), GET = list online users
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getSql } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const sql = getSql();

  // Upsert presence row — update last_seen on conflict
  await sql`
    INSERT INTO user_presence (user_name, last_seen)
    VALUES (${session.user}, NOW())
    ON CONFLICT (user_name)
    DO UPDATE SET last_seen = NOW()
  `;

  // Clean up stale entries (> 3 minutes old)
  await sql`DELETE FROM user_presence WHERE last_seen < NOW() - INTERVAL '3 minutes'`;

  // Return current online count + list
  const rows = await sql`
    SELECT user_name FROM user_presence
    WHERE last_seen > NOW() - INTERVAL '2 minutes'
    ORDER BY user_name
  `;

  return NextResponse.json({
    ok: true,
    online: rows.length,
    users: rows.map((r) => (r as Record<string, string>).user_name),
  });
}

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const sql = getSql();

  const rows = await sql`
    SELECT user_name FROM user_presence
    WHERE last_seen > NOW() - INTERVAL '2 minutes'
    ORDER BY user_name
  `;

  return NextResponse.json({
    ok: true,
    online: rows.length,
    users: rows.map((r) => (r as Record<string, string>).user_name),
  });
}
