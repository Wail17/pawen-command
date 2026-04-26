import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const sql = neon(env.DATABASE_URL);

const tables = await sql`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name`;
console.log(`Tables in DB:`);
for (const t of tables) console.log(`  ${t.table_schema}.${t.table_name}`);

const job = (await sql`SELECT id, status, phase, payload, state, progress FROM pipeline_jobs WHERE type = 'avatar_excavation' ORDER BY created_at DESC LIMIT 1`)[0];
if (job) {
  console.log(`\nLatest job ${job.id}:`);
  console.log(`  status: ${job.status}, phase: ${job.phase}`);
  console.log(`  progress: ${JSON.stringify(job.progress).slice(0, 200)}`);
  console.log(`  payload keys: ${Object.keys(job.payload ?? {}).join(', ')}`);
  console.log(`  payload.core: ${JSON.stringify(job.payload?.core).slice(0, 200)}`);
  console.log(`  state keys: ${Object.keys(job.state ?? {}).join(', ')}`);
}
