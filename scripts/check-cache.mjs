// Check if the excavation_fetch_cache table exists and has rows.
// Helps diagnose whether Phase 2 has finished on any recent run.

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);

const sql = neon(env.DATABASE_URL);

const tableExists = await sql`
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'excavation_fetch_cache') AS ok
`;
console.log('table excavation_fetch_cache exists:', tableExists[0].ok);

if (tableExists[0].ok) {
  const rows = await sql`
    SELECT cache_key, inputs_summary, cached_at, expires_at, hit_count,
           jsonb_object_keys(data) AS source_key
    FROM excavation_fetch_cache
    ORDER BY cached_at DESC
    LIMIT 20
  `;
  console.log(`\n${rows.length} rows (showing per-source):`);
  for (const r of rows) {
    console.log(`  ${r.cached_at} | ${r.cache_key.slice(0, 12)}... | ${r.inputs_summary} | source=${r.source_key}`);
  }

  // Total unique cache keys
  const keys = await sql`SELECT COUNT(DISTINCT cache_key)::int AS n FROM excavation_fetch_cache`;
  console.log(`\nUnique cache keys: ${keys[0].n}`);
}

// Also check pipeline_jobs for recent runs
const jobs = await sql`
  SELECT id, status, phase, created_at, heartbeat_at,
         EXTRACT(EPOCH FROM (NOW() - heartbeat_at))::int AS heartbeat_age_s,
         (progress->>'message') AS last_progress
  FROM pipeline_jobs
  WHERE type = 'avatar_excavation'
  ORDER BY created_at DESC
  LIMIT 3
`;
console.log(`\nRecent avatar_excavation jobs:`);
for (const j of jobs) {
  const ageSec = Number(j.heartbeat_age_s ?? 0);
  const ageStr = ageSec < 60 ? `${ageSec}s` : `${Math.floor(ageSec/60)}m${ageSec%60}s`;
  console.log(`  ${j.created_at.toISOString?.() ?? j.created_at} | ${j.status.padEnd(10)} | hb_age=${ageStr.padStart(8)} | phase=${j.phase ?? '?'} | ${j.last_progress?.slice(0, 80) ?? ''}`);
}

// Inspect source breakdown of the latest run from cache (table may not exist)
const latestCache = await sql`
  SELECT cache_key, inputs_summary, cached_at, expires_at, data
  FROM excavation_fetch_cache
  ORDER BY cached_at DESC
  LIMIT 1
`.catch(() => []);
if (latestCache.length > 0) {
  const c = latestCache[0];
  console.log(`\nLatest cache entry: ${c.cached_at}`);
  console.log(`  inputs: ${c.inputs_summary}`);
  console.log(`  source breakdown:`);
  for (const [src, bucket] of Object.entries(c.data ?? {})) {
    const count = bucket?.itemCount ?? bucket?.items?.length ?? 0;
    const errStr = bucket?.error ? ` ❌ "${bucket.error.slice(0, 80)}"` : '';
    console.log(`    ${src.padEnd(12)} ${String(count).padStart(4)} items${errStr}`);
  }
}
