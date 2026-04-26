// ============================================================
// PAWEN — Recover paid-for BrightData snapshots
//
// BrightData keeps "Ready" snapshots queryable for ~7 days. If a
// pipeline run timed out before pulling them, the data is still
// sitting on BD's servers — already paid for. This script finds
// them, downloads, and stashes in a new bd_snapshot_cache table
// so future runs (or manual analysis) can reuse them.
//
// Usage: node scripts/recover-brightdata-snapshots.mjs
//
// Idempotent: ON CONFLICT DO NOTHING on snapshot_id.
// ============================================================

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);

const BD_KEY = env.BRIGHTDATA_API_KEY;
const DB_URL = env.DATABASE_URL;
if (!BD_KEY) { console.error('❌ BRIGHTDATA_API_KEY missing in .env.local'); process.exit(1); }
if (!DB_URL) { console.error('❌ DATABASE_URL missing in .env.local'); process.exit(1); }

const sql = neon(DB_URL);

// Map dataset_id → human label so the summary log is readable
const DATASET_LABELS = {
  gd_lvz8ah06191smkebj4: 'reddit_posts',
  gd_lvzdpsdlw09j6t702: 'reddit_comments',
  gd_lvz1rbj81afv3m6n5y: 'quora',
  gd_lu702nij2f790tmv9h: 'tiktok_posts',
  gd_lkf2st302ap89utw5k: 'tiktok_comments',
  gd_l1villgoiiidt09ci:  'tiktok_profiles',
  gd_l1vikfch901nx3by4:  'instagram_profiles',
  gd_lk5ns7kz21pck8jpis: 'instagram_posts',
  gd_lyclm20il4r5helnj:  'instagram_reels',
  gd_ltppn085pokosxh13:  'instagram_comments',
  gd_lk56epmy2i5g7lzu0k: 'youtube_videos',
  gd_lk538t2k2p1k3oos71: 'youtube_channels',
  gd_lk9q0ew71spt1mxywf: 'youtube_comments',
  gd_l7q7dkf244hwjntr0:  'amazon_products',
  gd_le8e811kzy4ggddlq:  'amazon_reviews',
  gd_lwdb4vjm1ehb499uxs: 'amazon_search',
};

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS bd_snapshot_cache (
      snapshot_id   TEXT PRIMARY KEY,
      dataset_id    TEXT NOT NULL,
      label         TEXT,
      record_count  INTEGER NOT NULL DEFAULT 0,
      data          JSONB NOT NULL,
      bd_status     TEXT,
      bd_created_at TIMESTAMPTZ,
      recovered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bd_snapshot_cache_dataset_idx ON bd_snapshot_cache (dataset_id, recovered_at DESC)`;
}

async function bdFetch(path) {
  const res = await fetch(`https://api.brightdata.com/datasets/v3${path}`, {
    headers: { Authorization: `Bearer ${BD_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BD ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function listReadySnapshots() {
  // BD endpoint: GET /snapshots?status=ready&from_date=...&to_date=...
  // Returns up to ~1000 snapshots per call. We page if needed.
  const all = [];
  let page = 1;
  for (;;) {
    const url = `/snapshots?status=ready&page=${page}&size=1000`;
    let batch;
    try {
      batch = await bdFetch(url);
    } catch (e) {
      console.warn(`  page ${page}: ${e.message}`);
      break;
    }
    const list = Array.isArray(batch) ? batch : (batch?.snapshots ?? []);
    if (list.length === 0) break;
    all.push(...list);
    if (list.length < 1000) break;
    page++;
  }
  return all;
}

async function downloadSnapshot(snapshotId) {
  const res = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`, {
    headers: { Authorization: `Bearer ${BD_KEY}` },
  });
  if (!res.ok) {
    return null;
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function alreadyRecovered(snapshotId) {
  const rows = await sql`SELECT 1 FROM bd_snapshot_cache WHERE snapshot_id = ${snapshotId} LIMIT 1`;
  return rows.length > 0;
}

async function persist(snapshotId, datasetId, data, snapshotMeta) {
  const rows = Array.isArray(data) ? data : [];
  const label = DATASET_LABELS[datasetId] ?? datasetId;
  await sql`
    INSERT INTO bd_snapshot_cache (snapshot_id, dataset_id, label, record_count, data, bd_status, bd_created_at)
    VALUES (
      ${snapshotId},
      ${datasetId},
      ${label},
      ${rows.length},
      ${JSON.stringify(rows)}::jsonb,
      ${snapshotMeta?.status ?? 'ready'},
      ${snapshotMeta?.created ?? null}
    )
    ON CONFLICT (snapshot_id) DO NOTHING
  `;
  return rows.length;
}

console.log('→ ensure bd_snapshot_cache schema');
await ensureSchema();

console.log('→ listing all "ready" snapshots from BrightData');
const snapshots = await listReadySnapshots();
console.log(`  found ${snapshots.length} ready snapshots`);

const stats = {};
let totalRecords = 0;
let recovered = 0;
let skipped = 0;
let errors = 0;

for (let i = 0; i < snapshots.length; i++) {
  const snap = snapshots[i];
  const id = snap.id ?? snap.snapshot_id;
  const datasetId = snap.dataset_id ?? snap.datasetId ?? 'unknown';
  const label = DATASET_LABELS[datasetId] ?? datasetId;

  if (!id) { errors++; continue; }
  if (await alreadyRecovered(id)) {
    skipped++;
    continue;
  }

  process.stdout.write(`  [${i + 1}/${snapshots.length}] ${id} (${label})... `);
  const data = await downloadSnapshot(id);
  if (data === null) {
    process.stdout.write('✗ download failed\n');
    errors++;
    continue;
  }
  const count = await persist(id, datasetId, data, snap);
  totalRecords += count;
  recovered++;
  stats[label] = (stats[label] ?? 0) + count;
  process.stdout.write(`✓ ${count} records\n`);
}

console.log('\n=== SUMMARY ===');
console.log(`Recovered:  ${recovered}`);
console.log(`Already in DB (skipped):  ${skipped}`);
console.log(`Errors:  ${errors}`);
console.log(`Total records:  ${totalRecords}`);
console.log('\nPer dataset:');
for (const [label, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${label.padEnd(24)} ${count.toLocaleString()} records`);
}
console.log(`\nApprox cost saved: $${((totalRecords / 1000) * 1.5).toFixed(2)} (BD list price $1.50/1k records)`);
