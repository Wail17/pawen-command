// ============================================================
// AutoEcom Lab — /api/admin/env
// Shows which environment variables are set (masked). NEVER returns
// the actual secret values — only "configured / missing" flags and
// the first/last few chars for sanity-checking rotations.
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';

export const maxDuration = 5;

// The list of env vars the god panel checks. Anything not in here
// is ignored — we don't leak arbitrary env state.
const ENV_KEYS = [
  // --- secrets ---
  'APP_PASSWORD',
  'ADMIN_PASSWORD',
  'SESSION_SECRET',
  'ANTHROPIC_API_KEY',
  'FIRECRAWL_API_KEY',
  'TAVILY_API_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'DATABASE_URL',
  'APIFY_TOKEN',
  // --- deployment metadata (non-secret) ---
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_ENV',
  'VERCEL_GIT_COMMIT_SHA',
  'ALLOWED_ORIGINS',
  'NODE_ENV',
];

function mask(v: string | undefined): string | null {
  if (!v) return null;
  if (v.length <= 6) return '•'.repeat(v.length);
  return `${v.slice(0, 3)}…${v.slice(-3)}`;
}

export async function GET(req: Request) {
  const session = requireAdmin(req);
  if (session instanceof Response) return session;

  try {
    const entries = ENV_KEYS.map((key) => {
      const value = process.env[key];
      return {
        key,
        configured: typeof value === 'string' && value.length > 0,
        length: value?.length ?? 0,
        preview: mask(value),
      };
    });

    await writeAudit(req, session.user, 'admin.view', {
      view: 'env',
      configured: entries.filter((e) => e.configured).length,
    });

    return NextResponse.json({ ok: true, entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin:env] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
