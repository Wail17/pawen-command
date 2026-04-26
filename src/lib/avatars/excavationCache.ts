// ============================================================
// PAWEN — Excavation fetch-result cache (Postgres)
//
// Caches the full Phase 2 fetch output (`Partial<Record<SourceType,
// RawSourceData>>`) keyed by SHA-256 of the stable input hash
// (product + niche + surface_desire + language + market + config).
//
// Why: avatar excavation can take 10+ minutes scraping. If the LLM
// analyzer phase crashes (Vercel function timeout, schema error,
// anthropic rate limit), each retry would re-scrape from scratch —
// wasting BD credit and re-hitting the same wall. With this cache,
// retries skip Phase 2 and go straight to the LLM phases.
//
// TTL: 6 hours by default. Long enough to retry the same product
// many times in a session; short enough that fresh runs the next
// day pull current data.
// ============================================================

import 'server-only';
import { getSql } from '../db/client';
import { sha256Hex } from '../sources/providers/common';
import type { CoreAvatarInput, SourceConfig, RawSourceData, SourceType } from './types';

interface CacheRow {
  cache_key: string;
  data: Partial<Record<SourceType, RawSourceData>>;
  inputs_summary: string;
  cached_at: string;
  expires_at: string;
  hit_count: number;
}

async function ensureSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS excavation_fetch_cache (
      cache_key       TEXT PRIMARY KEY,
      data            JSONB NOT NULL,
      inputs_summary  TEXT NOT NULL,
      cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at      TIMESTAMPTZ NOT NULL,
      hit_count       INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS excavation_fetch_cache_expires_idx ON excavation_fetch_cache (expires_at)`;
}

interface CacheKeyInputs {
  core: CoreAvatarInput;
  config?: SourceConfig;
  redditDepth?: string;
}

/**
 * Compose a stable hash key from the inputs that affect what gets fetched.
 * Two runs with identical product/niche/desire/lang/config get the same
 * key — different config or niche → different key, fresh fetch.
 */
export async function buildCacheKey(inputs: CacheKeyInputs): Promise<string> {
  // Pick only the input fields that meaningfully affect the fetch.
  // Sort keys for stability (Object.entries order isn't guaranteed across runtimes).
  const stable = JSON.stringify({
    product: inputs.core.product?.trim().toLowerCase() ?? '',
    niche: inputs.core.niche?.trim().toLowerCase() ?? '',
    surface_desire: inputs.core.surface_desire?.trim().toLowerCase() ?? '',
    language: inputs.core.language ?? '',
    market: inputs.core.market ?? '',
    config: inputs.config ?? null,
    redditDepth: inputs.redditDepth ?? '',
  });
  return await sha256Hex(stable);
}

export interface CachedExcavationFetch {
  data: Partial<Record<SourceType, RawSourceData>>;
  cachedAt: string;
  expiresAt: string;
  hitCount: number;
  inputsSummary: string;
}

export async function getCachedFetch(cacheKey: string): Promise<CachedExcavationFetch | null> {
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = (await sql`
      SELECT cache_key, data, inputs_summary, cached_at, expires_at, hit_count
      FROM excavation_fetch_cache
      WHERE cache_key = ${cacheKey} AND expires_at > NOW()
      LIMIT 1
    `) as CacheRow[];
    const r = rows[0];
    if (!r) return null;
    void sql`UPDATE excavation_fetch_cache SET hit_count = hit_count + 1 WHERE cache_key = ${cacheKey}`;
    return {
      data: r.data,
      cachedAt: r.cached_at,
      expiresAt: r.expires_at,
      hitCount: r.hit_count + 1,
      inputsSummary: r.inputs_summary,
    };
  } catch (err) {
    console.warn('[excavationCache:get] failed:', err);
    return null;
  }
}

export async function putCachedFetch(
  cacheKey: string,
  data: Partial<Record<SourceType, RawSourceData>>,
  inputsSummary: string,
  ttlSec: number = 6 * 3600,
): Promise<void> {
  try {
    await ensureSchema();
    const sql = getSql();
    const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
    await sql`
      INSERT INTO excavation_fetch_cache (cache_key, data, inputs_summary, expires_at)
      VALUES (${cacheKey}, ${JSON.stringify(data)}::jsonb, ${inputsSummary}, ${expiresAt})
      ON CONFLICT (cache_key) DO UPDATE SET
        data = EXCLUDED.data,
        inputs_summary = EXCLUDED.inputs_summary,
        cached_at = NOW(),
        expires_at = EXCLUDED.expires_at,
        hit_count = 0
    `;
  } catch (err) {
    console.warn('[excavationCache:put] failed:', err);
  }
}
