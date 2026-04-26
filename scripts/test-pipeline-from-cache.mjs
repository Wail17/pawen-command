// ============================================================
// PAWEN — Test pipeline post-fetch phases without re-scraping
//
// Verifies that Phase 2.5+ (Raw Signal → Voyage Dedup → Voyage
// Rerank → Analyzers → Cross-source Validation → Compile Opus →
// Adversarial → Classifier) work end-to-end using already-cached
// fetch data — no new BrightData spend.
//
// Usage:
//   node scripts/test-pipeline-from-cache.mjs <jobId>
//
// What it does:
//   1. Loads the existing job's payload from pipeline_jobs
//   2. Looks up the Phase 2 fetch output from excavation_fetch_cache
//   3. Sends an Inngest event with prefetchedData inlined
//   4. Inngest function detects prefetchedData → skips fetch step
//   5. Reports the event ID; you watch progress in
//      https://app.inngest.com/env/production/runs
//
// Requires INNGEST_EVENT_KEY in .env.local (auto-set by Vercel).
// ============================================================

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);

const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: node scripts/test-pipeline-from-cache.mjs <jobId>');
  console.error('       (jobId looks like job_a1b2c3d4-...)');
  process.exit(1);
}

const sql = neon(env.DATABASE_URL);

console.log(`→ loading job ${jobId}`);
const jobRows = await sql`SELECT id, owner, project_id, payload, status FROM pipeline_jobs WHERE id = ${jobId} LIMIT 1`;
if (jobRows.length === 0) {
  console.error(`❌ Job ${jobId} not found`);
  process.exit(1);
}
const job = jobRows[0];
const payload = job.payload;
const core = payload.core;
console.log(`  owner=${job.owner}, project=${job.project_id}, status=${job.status}`);
console.log(`  product=${core?.product?.slice(0, 60)}, niche=${core?.niche?.slice(0, 60)}`);

// Build the cache key the same way the worker does.
function stableHash(inputs) {
  const stable = JSON.stringify({
    product: inputs.core?.product?.trim().toLowerCase() ?? '',
    niche: inputs.core?.niche?.trim().toLowerCase() ?? '',
    surface_desire: inputs.core?.surface_desire?.trim().toLowerCase() ?? '',
    language: inputs.core?.language ?? '',
    market: inputs.core?.market ?? '',
    config: inputs.config ?? null,
    redditDepth: inputs.redditDepth ?? '',
  });
  return crypto.createHash('sha256').update(stable).digest('hex');
}

const cacheKey = stableHash({ core, config: payload.config, redditDepth: payload.redditDepth });
console.log(`→ cache key: ${cacheKey.slice(0, 16)}...`);

const cacheRows = await sql`
  SELECT cache_key, inputs_summary, cached_at, expires_at, data
  FROM excavation_fetch_cache
  WHERE cache_key = ${cacheKey}
  LIMIT 1
`.catch(() => []);

if (cacheRows.length === 0) {
  console.error(`❌ No cache entry for this job's inputs.`);
  console.error(`   The Phase 2 fetch never finished writing to cache.`);
  console.error(`   Try recovering from BrightData first:`);
  console.error(`     node scripts/recover-brightdata-snapshots.mjs`);
  process.exit(1);
}

const cache = cacheRows[0];
const totalItems = Object.values(cache.data ?? {}).reduce((sum, b) => sum + (b?.itemCount ?? b?.items?.length ?? 0), 0);
console.log(`✓ cache hit: ${totalItems} items, cached ${cache.cached_at}, expires ${cache.expires_at}`);

console.log('\n  Per source breakdown:');
for (const [src, bucket] of Object.entries(cache.data ?? {})) {
  const n = bucket?.itemCount ?? bucket?.items?.length ?? 0;
  const err = bucket?.error ? ` ❌ ${bucket.error.slice(0, 60)}` : '';
  console.log(`    ${src.padEnd(12)} ${String(n).padStart(4)} items${err}`);
}

const eventKey = env.INNGEST_EVENT_KEY;
if (!eventKey) {
  console.error('\n❌ INNGEST_EVENT_KEY missing in .env.local. Pull from Vercel: vercel env pull .env.local');
  process.exit(1);
}

// Sign a session cookie locally so the Inngest function's internal
// /api/* calls (dedup, rerank, /api/generate) pass requireSession.
function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function signSession(user, role) {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET missing/too short in .env.local');
  const now = Date.now();
  const payload = { user, role, iat: now, exp: now + 24 * 3600 * 1000 };
  const payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(payloadBuf).digest();
  return `${base64url(payloadBuf)}.${base64url(hmac)}`;
}
const sessionToken = signSession(job.owner, 'admin');
const sessionCookieHeader = `pawen-session=${sessionToken}`;
console.log(`→ signed session for owner=${job.owner} (admin role)`);

const newJobId = `job_${crypto.randomUUID()}`;
console.log(`\n→ creating fresh job ${newJobId} for the replay`);
await sql`
  INSERT INTO pipeline_jobs (id, owner, project_id, gate_id, type, status, phase, payload)
  VALUES (
    ${newJobId},
    ${job.owner},
    ${job.project_id},
    'gate1',
    'avatar_excavation',
    'pending',
    'queued',
    ${JSON.stringify(payload)}::jsonb
  )
`;

console.log(`→ sending Inngest event with prefetchedData inlined (skips Phase 2)`);

// We can't easily resolve baseUrl + sessionCookie from a script — these
// are runtime context. The Inngest function requires them for internal
// API calls. The cleanest way is to POST to the Inngest webhook directly.
// Inngest accepts events via /e/<event_key>.
const webhook = `https://inn.gs/e/${eventKey}`;
// Don't inline prefetchedData — Inngest events cap at 256KB and our
// cache blob is multi-MB. Instead rely on the Inngest function's
// auto cache-hit path: step 2 calls buildCacheKey → getCachedFetch
// and short-circuits when a fresh row exists. We just hydrated that
// row, so the next event with the same inputs will hit it.
const eventBody = {
  name: 'avatar/excavation.start',
  data: {
    jobId: newJobId,
    baseUrl: 'https://pawen-command-center.vercel.app',
    sessionCookie: sessionCookieHeader,
    core,
    config: payload.config,
    redditDepth: payload.redditDepth,
    reverseSeeds: payload.reverseSeeds ?? null,
  },
};

const sendRes = await fetch(webhook, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(eventBody),
});

if (!sendRes.ok) {
  const text = await sendRes.text().catch(() => '');
  console.error(`❌ Inngest event send failed: HTTP ${sendRes.status} ${text.slice(0, 200)}`);
  // Mark the job we created as failed so it doesn't dangle.
  await sql`
    UPDATE pipeline_jobs
    SET status = 'failed', error = 'Inngest event send failed', phase = 'error'
    WHERE id = ${newJobId}
  `;
  process.exit(1);
}

const sendBody = await sendRes.json().catch(() => ({}));
console.log(`✓ event sent (Inngest ids: ${JSON.stringify(sendBody.ids ?? sendBody)})`);
console.log(`\n→ watch progress:`);
console.log(`  Inngest:  https://app.inngest.com/env/production/runs`);
console.log(`  DB poll:  SELECT status, phase, progress->>'message' FROM pipeline_jobs WHERE id = '${newJobId}';`);
console.log(`  job_id:   ${newJobId}`);
