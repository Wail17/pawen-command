import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

const sql = neon(process.env.DATABASE_URL);

const [job] = await sql`SELECT payload FROM pipeline_jobs WHERE id = ${process.argv[2]}`;
const core = job.payload.core;
const config = job.payload.config;
const redditDepth = job.payload.redditDepth;

const stable = JSON.stringify({
  product: core?.product?.trim().toLowerCase() ?? '',
  niche: core?.niche?.trim().toLowerCase() ?? '',
  surface_desire: core?.surface_desire?.trim().toLowerCase() ?? '',
  language: core?.language ?? '',
  market: core?.market ?? '',
  config: config ?? null,
  redditDepth: redditDepth ?? '',
});
const key = crypto.createHash('sha256').update(stable).digest('hex');
console.log(`cache key: ${key.slice(0, 16)}…`);

const [c] = await sql`SELECT cache_key, cached_at, expires_at, data FROM excavation_fetch_cache WHERE cache_key = ${key}`;
if (!c) { console.log('NO CACHE ROW for this run'); process.exit(0); }
console.log(`cached_at: ${c.cached_at}`);
console.log(`expires_at: ${c.expires_at}`);
console.log(`\nper-source breakdown:`);
let total = 0;
for (const [src, b] of Object.entries(c.data ?? {})) {
  const n = b?.itemCount ?? b?.items?.length ?? 0;
  total += n;
  const err = b?.error ? ` ❌ ${String(b.error).slice(0, 80)}` : '';
  const dur = b?.fetchDurationMs ? ` (${Math.round(b.fetchDurationMs/1000)}s)` : '';
  console.log(`  ${src.padEnd(12)} ${String(n).padStart(4)} items${dur}${err}`);
}
console.log(`  ${'TOTAL'.padEnd(12)} ${String(total).padStart(4)}`);
