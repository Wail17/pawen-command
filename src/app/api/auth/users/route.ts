// ============================================================
// AutoEcom Lab — /api/auth/users
// Public-ish (behind the main password screen, but does NOT
// require a session — it's called during the user-picker step,
// between password entry and session issuance).
//
// Returns the list of enabled users so the UI can show the picker.
// Blocked users are hidden. Roles are leaked (needed by UI) but
// that's already visible to any authenticated user.
// ============================================================

import { NextResponse } from 'next/server';
import { listEnabledUsers } from '@/lib/auth/userRegistry';

export const maxDuration = 10;

export async function GET() {
  try {
    const users = await listEnabledUsers();
    return NextResponse.json({ ok: true, users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[auth:users] list failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
