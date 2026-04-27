import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const id = process.argv[2];
if (!id) { console.error('usage: poll-job.mjs <jobId>'); process.exit(1); }
const [r] = await sql`
  SELECT id, status, phase, error,
         progress->>'message' AS msg,
         progress->>'percent' AS pct,
         heartbeat_at, updated_at, created_at
  FROM pipeline_jobs WHERE id = ${id}
`;
if (!r) { console.error('not found'); process.exit(1); }
const ageS = Math.round((Date.now() - new Date(r.updated_at).getTime()) / 1000);
const beatS = r.heartbeat_at ? Math.round((Date.now() - new Date(r.heartbeat_at).getTime()) / 1000) : null;
console.log(`status=${r.status} phase=${r.phase} pct=${r.pct ?? '-'}`);
console.log(`msg: ${r.msg ?? '(none)'}`);
console.log(`updated ${ageS}s ago, heartbeat ${beatS == null ? 'never' : beatS + 's ago'}`);
if (r.error) console.log(`ERROR: ${r.error.slice(0, 300)}`);
