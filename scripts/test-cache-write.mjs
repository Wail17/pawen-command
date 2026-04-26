// Direct test of cache write to surface any silent failure.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const sql = neon(env.DATABASE_URL);

console.log('1. Trying CREATE TABLE...');
try {
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
  console.log('   ✓ CREATE TABLE ok');
} catch (e) { console.log('   ✗ CREATE TABLE FAILED:', e.message); }

console.log('2. Trying INDEX...');
try {
  await sql`CREATE INDEX IF NOT EXISTS excavation_fetch_cache_expires_idx ON excavation_fetch_cache (expires_at)`;
  console.log('   ✓ CREATE INDEX ok');
} catch (e) { console.log('   ✗ CREATE INDEX FAILED:', e.message); }

console.log('3. Trying INSERT (test row)...');
try {
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  await sql`
    INSERT INTO excavation_fetch_cache (cache_key, data, inputs_summary, expires_at)
    VALUES ('test_key', ${JSON.stringify({reddit: {items: []}})}::jsonb, 'manual test', ${expiresAt})
    ON CONFLICT (cache_key) DO UPDATE SET cached_at = NOW()
  `;
  console.log('   ✓ INSERT ok');
} catch (e) { console.log('   ✗ INSERT FAILED:', e.message); }

console.log('4. Verifying read...');
try {
  const rows = await sql`SELECT cache_key, inputs_summary FROM excavation_fetch_cache WHERE cache_key = 'test_key'`;
  console.log(`   ✓ Read ok, ${rows.length} row(s)`);
  for (const r of rows) console.log(`     ${r.cache_key} | ${r.inputs_summary}`);
} catch (e) { console.log('   ✗ Read FAILED:', e.message); }

console.log('5. Cleanup...');
try {
  await sql`DELETE FROM excavation_fetch_cache WHERE cache_key = 'test_key'`;
  console.log('   ✓ Cleanup ok');
} catch (e) { console.log('   ✗ Cleanup FAILED:', e.message); }
