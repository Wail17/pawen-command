// ============================================================
// PAWEN — /api/admin/watermark-check
//
// Admin-only endpoint. Given a piece of leaked text, extracts the
// invisible watermark and checks which user generated it.
//
//   POST { text: "leaked content..." }
//   → { found: true, tag: "a1b2c3d4", matchedUser: "John" | null }
//
// To match a user, the admin provides a list of usernames to check
// against. The endpoint hashes each with HMAC and compares to the
// extracted tag.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { extractWatermark, isWatermarkedBy } from '@/lib/auth/watermark';
import { getSql } from '@/lib/db/client';

export const maxDuration = 10;

export async function POST(req: Request) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.text !== 'string') {
    return NextResponse.json({ error: 'text field required' }, { status: 400 });
  }

  const wm = extractWatermark(body.text);
  if (!wm) {
    return NextResponse.json({ found: false, message: 'No watermark detected in text' });
  }

  // Try to match the watermark against all known users
  let matchedUser: string | null = null;
  try {
    const sql = getSql();
    const users = (await sql`SELECT name FROM app_users`) as Array<{ name: string }>;
    for (const u of users) {
      if (isWatermarkedBy(body.text, u.name)) {
        matchedUser = u.name;
        break;
      }
    }
  } catch {
    // DB check failed — still return the raw tag
  }

  return NextResponse.json({
    found: true,
    tag: wm.tag,
    timestamp: wm.timestamp,
    matchedUser,
  });
}
