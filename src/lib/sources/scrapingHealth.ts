// ============================================================
// PAWEN — Phase U.4.8 + U.4.9 — Scraping health tracking
// Neon-backed rolling stats per source + per provider. Feed for
// the /admin/scraping-health dashboard.
// ============================================================

import 'server-only';
import { getSql } from '../db/client';

async function ensureSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS scrape_health (
      id             BIGSERIAL PRIMARY KEY,
      source         TEXT NOT NULL,
      provider       TEXT,
      success        BOOLEAN NOT NULL,
      latency_ms     INTEGER NOT NULL,
      items          INTEGER NOT NULL DEFAULT 0,
      avg_quality    NUMERIC,
      chunks_injected INTEGER,
      chunks_used    INTEGER,
      utilization    NUMERIC,
      error_message  TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS scrape_health_source_idx ON scrape_health (source, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS scrape_health_provider_idx ON scrape_health (provider, created_at DESC)`;
}

export interface HealthRecord {
  source: string;
  provider?: string;
  success: boolean;
  latencyMs: number;
  items?: number;
  avgQuality?: number | null;
  errorMessage?: string | null;
}

export async function recordHealth(rec: HealthRecord): Promise<void> {
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`
      INSERT INTO scrape_health (source, provider, success, latency_ms, items, avg_quality, error_message)
      VALUES (${rec.source}, ${rec.provider ?? null}, ${rec.success}, ${rec.latencyMs},
              ${rec.items ?? 0}, ${rec.avgQuality ?? null}, ${rec.errorMessage ?? null})
    `;
  } catch { /* best-effort */ }
}

export async function recordUtilization(source: string, chunksInjected: number, chunksUsed: number): Promise<void> {
  try {
    await ensureSchema();
    const sql = getSql();
    const util = chunksInjected > 0 ? chunksUsed / chunksInjected : 0;
    await sql`
      INSERT INTO scrape_health (source, success, latency_ms, chunks_injected, chunks_used, utilization)
      VALUES (${source}, ${true}, ${0}, ${chunksInjected}, ${chunksUsed}, ${util})
    `;
  } catch { /* best-effort */ }
}

export interface SourceStats {
  source: string;
  calls24h: number;
  successRate: number;          // 0-1
  p50Latency: number;
  p95Latency: number;
  avgQuality: number | null;
  avgUtilization: number | null;
  lastErrors: string[];
  lowUtilityFlag: boolean;       // <5% over last 10 runs
}

export async function getSourceStats(hours = 24): Promise<SourceStats[]> {
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = (await sql`
      SELECT
        source,
        COUNT(*)::int AS calls,
        AVG(CASE WHEN success THEN 1 ELSE 0 END)::float AS success_rate,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)::int AS p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95,
        AVG(avg_quality)::float AS avg_quality,
        AVG(utilization)::float AS avg_util
      FROM scrape_health
      WHERE created_at > NOW() - (${hours} || ' hours')::interval
      GROUP BY source
      ORDER BY source
    `) as Array<{ source: string; calls: number; success_rate: number; p50: number; p95: number; avg_quality: number | null; avg_util: number | null }>;

    const out: SourceStats[] = [];
    for (const r of rows) {
      const errRows = (await sql`
        SELECT error_message FROM scrape_health
        WHERE source = ${r.source} AND NOT success AND error_message IS NOT NULL
        ORDER BY created_at DESC LIMIT 5
      `) as Array<{ error_message: string }>;
      // Low-utility flag: last 10 records' avg utilization < 0.05
      const lastTen = (await sql`
        SELECT utilization FROM scrape_health
        WHERE source = ${r.source} AND utilization IS NOT NULL
        ORDER BY created_at DESC LIMIT 10
      `) as Array<{ utilization: number | null }>;
      const utils = lastTen.map(x => x.utilization ?? 0);
      const avg10 = utils.length > 0 ? utils.reduce((a, b) => a + b, 0) / utils.length : 0;
      out.push({
        source: r.source,
        calls24h: r.calls,
        successRate: r.success_rate ?? 0,
        p50Latency: r.p50 ?? 0,
        p95Latency: r.p95 ?? 0,
        avgQuality: r.avg_quality,
        avgUtilization: r.avg_util,
        lastErrors: errRows.map(x => x.error_message).filter(Boolean),
        lowUtilityFlag: lastTen.length >= 10 && avg10 < 0.05,
      });
    }
    return out;
  } catch {
    return [];
  }
}
