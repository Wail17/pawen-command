// ============================================================
// PAWEN — /api/admin/scraping-health   (Phase U.4.8)
// Aggregates per-provider health + per-source stats + cache stats.
// Admin-only (session OR x-admin-token).
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { isAdminRequest } from '@/lib/auth/adminServer';
import { snapshotAllHealth } from '@/lib/sources/providers/registry';
import { getSourceStats } from '@/lib/sources/scrapingHealth';
import { getCacheStats } from '@/lib/sources/scrapeCache';

export const maxDuration = 15;

export async function GET(req: Request) {
  const session = requireAdmin(req);
  const legacy = isAdminRequest(req);
  if (session instanceof Response && !legacy) return session;

  const [providers, sourceStats, cache] = await Promise.all([
    snapshotAllHealth(),
    getSourceStats(24),
    getCacheStats(),
  ]);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    providers,
    sources: sourceStats,
    cache,
  });
}
