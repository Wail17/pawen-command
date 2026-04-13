// ============================================================
// AutoEcom Lab — Neon Postgres client (server-only)
// Lazy init so `next build` doesn't crash if DATABASE_URL is
// missing at build time (e.g. before Marketplace provisioning).
// ============================================================

import 'server-only';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set — provision Neon in Vercel Marketplace');
    }
    _sql = neon(url);
  }
  return _sql;
}
