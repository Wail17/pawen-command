// ============================================================
// PAWEN — Phase U.4.5 — Firecrawl scrape cache
//
// Neon-backed key/value cache for scraped pages. Key = SHA-256 of
// the normalized URL. TTL enforced via `expires_at`. No dependency
// on Vercel KV (which requires a separate integration).
// ============================================================

import 'server-only';
import { getSql } from '../db/client';
import { sha256Hex, normalizeUrl } from './providers/common';

interface CacheRow {
  url_hash: string;
  url: string;
  markdown: string;
  metadata: Record<string, unknown>;
  fetched_at: string;
  expires_at: string;
  hit_count: number;
}

async function ensureSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS scrape_cache (
      url_hash     TEXT PRIMARY KEY,
      url          TEXT NOT NULL,
      markdown     TEXT NOT NULL,
      metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
      fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL,
      hit_count    INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS scrape_cache_expires_idx ON scrape_cache (expires_at)`;
}

export interface CachedScrape {
  url: string;
  markdown: string;
  metadata: Record<string, unknown>;
  fetchedAt: string;
  expiresAt: string;
  hitCount: number;
}

export async function getCachedScrape(url: string): Promise<CachedScrape | null> {
  try {
    await ensureSchema();
    const sql = getSql();
    const hash = await sha256Hex(normalizeUrl(url));
    const rows = (await sql`
      SELECT url_hash, url, markdown, metadata, fetched_at, expires_at, hit_count
      FROM scrape_cache
      WHERE url_hash = ${hash} AND expires_at > NOW()
      LIMIT 1
    `) as CacheRow[];
    const r = rows[0];
    if (!r) return null;
    // Increment hit count async (best-effort)
    void sql`UPDATE scrape_cache SET hit_count = hit_count + 1 WHERE url_hash = ${hash}`;
    return {
      url: r.url,
      markdown: r.markdown,
      metadata: r.metadata,
      fetchedAt: r.fetched_at,
      expiresAt: r.expires_at,
      hitCount: r.hit_count + 1,
    };
  } catch {
    return null;
  }
}

export async function putCachedScrape(
  url: string,
  markdown: string,
  metadata: Record<string, unknown>,
  ttlSec: number,
): Promise<void> {
  try {
    await ensureSchema();
    const sql = getSql();
    const normalized = normalizeUrl(url);
    const hash = await sha256Hex(normalized);
    const expiresAtMs = Date.now() + ttlSec * 1000;
    const expiresAt = new Date(expiresAtMs).toISOString();
    await sql`
      INSERT INTO scrape_cache (url_hash, url, markdown, metadata, expires_at)
      VALUES (${hash}, ${normalized}, ${markdown}, ${JSON.stringify(metadata)}::jsonb, ${expiresAt})
      ON CONFLICT (url_hash) DO UPDATE SET
        markdown = EXCLUDED.markdown,
        metadata = EXCLUDED.metadata,
        fetched_at = NOW(),
        expires_at = EXCLUDED.expires_at,
        hit_count = 0
    `;
  } catch {
    /* cache failure is never fatal */
  }
}

export async function getCacheStats(): Promise<{ entries: number; hits: number; avgSize: number; oldest: string | null }> {
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = (await sql`
      SELECT
        COUNT(*)::int AS entries,
        COALESCE(SUM(hit_count), 0)::int AS hits,
        COALESCE(AVG(LENGTH(markdown)), 0)::int AS avg_size,
        MIN(fetched_at) AS oldest
      FROM scrape_cache
      WHERE expires_at > NOW()
    `) as Array<{ entries: number; hits: number; avg_size: number; oldest: string | null }>;
    const r = rows[0];
    return { entries: r.entries, hits: r.hits, avgSize: r.avg_size, oldest: r.oldest };
  } catch {
    return { entries: 0, hits: 0, avgSize: 0, oldest: null };
  }
}

export async function purgeExpired(): Promise<number> {
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = (await sql`
      DELETE FROM scrape_cache WHERE expires_at <= NOW() RETURNING url_hash
    `) as Array<{ url_hash: string }>;
    return rows.length;
  } catch {
    return 0;
  }
}
