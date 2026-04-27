// ============================================================
// PAWEN — Bright Data snapshot cache + idempotency layer
//
// Backs the webhook-driven flow. Two responsibilities:
//   1. Idempotency: dedupe identical BD requests inside a 30min
//      window so retried Inngest steps don't re-burn budget.
//   2. Webhook integration: BD POSTs JSON rows to our webhook
//      route, which UPSERTs into bd_snapshot_cache by snapshot_id.
//      The triggering caller polls the row for `data IS NOT NULL`.
//
// Schema (idempotent ALTER, see ensureBdSchema):
//   bd_snapshot_cache (
//     snapshot_id   TEXT PRIMARY KEY,
//     dataset_id    TEXT NOT NULL,
//     cache_key     TEXT,        -- sha256 of trigger inputs (for idempotency)
//     label         TEXT,
//     record_count  INTEGER NOT NULL DEFAULT 0,
//     data          JSONB,       -- nullable until webhook fills it
//     bd_status     TEXT,
//     bd_created_at TIMESTAMPTZ,
//     triggered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//     recovered_at  TIMESTAMPTZ -- NULL until webhook delivery (or fallback poll)
//   )
//   INDEX (cache_key, triggered_at DESC)
//   INDEX (dataset_id, triggered_at DESC)
// ============================================================

import 'server-only';
import { getSql } from '@/lib/db/client';
import { sha256Hex } from './common';

let _schemaReady: Promise<void> | null = null;

/**
 * One-shot, idempotent schema migration. Adds the columns we need for
 * the webhook flow on top of the existing bd_snapshot_cache table
 * (created originally by scripts/recover-brightdata-snapshots.mjs).
 */
export function ensureBdSchema(): Promise<void> {
  if (_schemaReady) return _schemaReady;
  _schemaReady = (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS bd_snapshot_cache (
        snapshot_id   TEXT PRIMARY KEY,
        dataset_id    TEXT NOT NULL,
        label         TEXT,
        record_count  INTEGER NOT NULL DEFAULT 0,
        data          JSONB,
        bd_status     TEXT,
        bd_created_at TIMESTAMPTZ,
        recovered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    // The original script set `data` NOT NULL + `recovered_at` NOT NULL.
    // Our flow inserts pending rows where both are NULL until the
    // webhook arrives, so loosen the constraints if present.
    await sql`ALTER TABLE bd_snapshot_cache ALTER COLUMN data DROP NOT NULL`.catch(() => {});
    await sql`ALTER TABLE bd_snapshot_cache ALTER COLUMN recovered_at DROP NOT NULL`.catch(() => {});
    await sql`ALTER TABLE bd_snapshot_cache ALTER COLUMN recovered_at DROP DEFAULT`.catch(() => {});
    await sql`ALTER TABLE bd_snapshot_cache ADD COLUMN IF NOT EXISTS cache_key TEXT`;
    await sql`ALTER TABLE bd_snapshot_cache ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
    await sql`CREATE INDEX IF NOT EXISTS bd_snapshot_cache_key_idx ON bd_snapshot_cache (cache_key, triggered_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS bd_snapshot_cache_dataset_idx ON bd_snapshot_cache (dataset_id, triggered_at DESC)`;
  })();
  return _schemaReady;
}

/**
 * Stable hash of the trigger inputs. Two identical BD requests within
 * the cache window resolve to the same cache_key and skip the trigger.
 */
export async function computeCacheKey(opts: {
  datasetId: string;
  type?: string;
  discoverBy?: string;
  inputs: unknown;
}): Promise<string> {
  const stable = JSON.stringify({
    d: opts.datasetId,
    t: opts.type ?? 'discover_new',
    db: opts.discoverBy ?? '',
    i: opts.inputs,
  });
  return sha256Hex(stable);
}

/**
 * Look up the most recent completed snapshot for this cache key. Used
 * as the idempotency check before triggering BD. Returns null if
 * nothing fresh enough is on file.
 */
export async function lookupCachedSnapshot<T>(opts: {
  cacheKey: string;
  maxAgeMinutes?: number;
}): Promise<{ snapshotId: string; rows: T[] } | null> {
  await ensureBdSchema();
  const sql = getSql();
  const maxAge = opts.maxAgeMinutes ?? 30;
  const rows = await sql`
    SELECT snapshot_id, data
    FROM bd_snapshot_cache
    WHERE cache_key = ${opts.cacheKey}
      AND data IS NOT NULL
      AND triggered_at > NOW() - (${maxAge} || ' minutes')::interval
    ORDER BY triggered_at DESC
    LIMIT 1
  ` as Array<{ snapshot_id: string; data: unknown }>;
  if (rows.length === 0) return null;
  const r = rows[0];
  const arr = Array.isArray(r.data) ? (r.data as T[]) : [];
  return { snapshotId: r.snapshot_id, rows: arr };
}

/**
 * Inserted at trigger time. The webhook handler updates `data` +
 * `recovered_at` when BD POSTs. The caller polls this row.
 */
export async function insertPendingSnapshot(opts: {
  snapshotId: string;
  datasetId: string;
  cacheKey: string;
}): Promise<void> {
  await ensureBdSchema();
  const sql = getSql();
  // ON CONFLICT DO NOTHING — handles the rare race where the webhook
  // arrived before we got to INSERT (because the BD trigger response
  // was slow). Webhook does INSERT-with-data via UPSERT, so the row is
  // already there with data; we just want to backfill cache_key.
  await sql`
    INSERT INTO bd_snapshot_cache (snapshot_id, dataset_id, cache_key, triggered_at)
    VALUES (${opts.snapshotId}, ${opts.datasetId}, ${opts.cacheKey}, NOW())
    ON CONFLICT (snapshot_id) DO UPDATE SET cache_key = COALESCE(bd_snapshot_cache.cache_key, EXCLUDED.cache_key)
  `;
}

/**
 * Polled by brightDataCollect. Returns the rows once the webhook has
 * filled them in (or NULL while still pending).
 */
export async function readSnapshotData<T>(snapshotId: string): Promise<T[] | null> {
  await ensureBdSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT data, record_count
    FROM bd_snapshot_cache
    WHERE snapshot_id = ${snapshotId}
      AND data IS NOT NULL
    LIMIT 1
  ` as Array<{ data: unknown; record_count: number }>;
  if (rows.length === 0) return null;
  return Array.isArray(rows[0].data) ? (rows[0].data as T[]) : [];
}

/**
 * Called by the webhook route + the reconciler fallback. Idempotent
 * UPSERT — first delivery wins, subsequent deliveries become no-ops.
 *
 * Identification: BD's webhook callback may or may not preserve our
 * cache_key query param and may or may not append its own snapshot_id.
 * Try both — match the most recent pending row, otherwise insert fresh.
 */
export async function recordSnapshotDelivery(opts: {
  snapshotId?: string;       // BD's snapshot_id if known (URL or header)
  cacheKey?: string;         // our cache_key from webhook URL ?ck=
  datasetId?: string;
  data: unknown[];
  source?: 'webhook' | 'fallback-poll';
}): Promise<{ matched: boolean; snapshotId: string }> {
  await ensureBdSchema();
  const sql = getSql();
  const recordCount = opts.data.length;
  const status = opts.source ?? 'webhook';
  const dataJson = JSON.stringify(opts.data);

  // Path A — snapshot_id known: simple UPSERT by primary key.
  if (opts.snapshotId) {
    await sql`
      INSERT INTO bd_snapshot_cache (snapshot_id, dataset_id, data, record_count, recovered_at, triggered_at, bd_status)
      VALUES (
        ${opts.snapshotId},
        ${opts.datasetId ?? 'unknown'},
        ${dataJson}::jsonb,
        ${recordCount},
        NOW(),
        NOW(),
        ${status}
      )
      ON CONFLICT (snapshot_id) DO UPDATE SET
        data = COALESCE(bd_snapshot_cache.data, EXCLUDED.data),
        record_count = GREATEST(bd_snapshot_cache.record_count, EXCLUDED.record_count),
        recovered_at = COALESCE(bd_snapshot_cache.recovered_at, NOW()),
        bd_status = EXCLUDED.bd_status,
        dataset_id = CASE
          WHEN bd_snapshot_cache.dataset_id = 'unknown' THEN EXCLUDED.dataset_id
          ELSE bd_snapshot_cache.dataset_id
        END
    `;
    return { matched: true, snapshotId: opts.snapshotId };
  }

  // Path B — only cache_key known: match the most recent pending row
  // for that cache_key. Webhook URL must always carry ?ck= so this is
  // the normal path.
  if (opts.cacheKey) {
    const matched = await sql`
      WITH target AS (
        SELECT snapshot_id FROM bd_snapshot_cache
        WHERE cache_key = ${opts.cacheKey}
          AND data IS NULL
          AND triggered_at > NOW() - INTERVAL '4 hours'
        ORDER BY triggered_at DESC
        LIMIT 1
      )
      UPDATE bd_snapshot_cache
      SET data = ${dataJson}::jsonb,
          record_count = ${recordCount},
          recovered_at = NOW(),
          bd_status = ${status}
      FROM target
      WHERE bd_snapshot_cache.snapshot_id = target.snapshot_id
      RETURNING bd_snapshot_cache.snapshot_id
    ` as Array<{ snapshot_id: string }>;
    if (matched.length > 0) return { matched: true, snapshotId: matched[0].snapshot_id };

    // No pending row to update — insert a parking row keyed on cache_key
    // so the data isn't lost. The trigger path looks up by cache_key so
    // the caller will still find it.
    const phantomId = `phantom-${opts.cacheKey.slice(0, 16)}-${Date.now()}`;
    await sql`
      INSERT INTO bd_snapshot_cache (snapshot_id, dataset_id, cache_key, data, record_count, recovered_at, triggered_at, bd_status)
      VALUES (
        ${phantomId},
        ${opts.datasetId ?? 'unknown'},
        ${opts.cacheKey},
        ${dataJson}::jsonb,
        ${recordCount},
        NOW(),
        NOW(),
        'webhook-orphan'
      )
      ON CONFLICT (snapshot_id) DO NOTHING
    `;
    return { matched: false, snapshotId: phantomId };
  }

  throw new Error('recordSnapshotDelivery: need at least one of snapshotId or cacheKey');
}

/**
 * Used by the reconciler cron to find pending snapshots whose webhook
 * never arrived. Caller resolves them via the BD `monitor` + `download`
 * APIs and calls recordSnapshotDelivery().
 */
export async function listOrphanSnapshots(opts: {
  staleAfterMinutes?: number;
  limit?: number;
}): Promise<Array<{ snapshot_id: string; dataset_id: string; triggered_at: string }>> {
  await ensureBdSchema();
  const sql = getSql();
  const stale = opts.staleAfterMinutes ?? 5;
  const limit = opts.limit ?? 50;
  return await sql`
    SELECT snapshot_id, dataset_id, triggered_at::text AS triggered_at
    FROM bd_snapshot_cache
    WHERE data IS NULL
      AND triggered_at < NOW() - (${stale} || ' minutes')::interval
      AND triggered_at > NOW() - INTERVAL '24 hours'
    ORDER BY triggered_at ASC
    LIMIT ${limit}
  ` as Array<{ snapshot_id: string; dataset_id: string; triggered_at: string }>;
}
