import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const id = process.argv[2];
const rows = await sql`
  SELECT id, status, phase, progress->>'message' AS msg, heartbeat_at, created_at, updated_at
  FROM pipeline_jobs
  WHERE project_id = ${id}
  ORDER BY created_at DESC
  LIMIT 10
`;
for (const r of rows) {
  const beat = r.heartbeat_at ? Math.round((Date.now() - new Date(r.heartbeat_at).getTime()) / 1000) + 's' : 'never';
  console.log(`${r.id} status=${r.status} phase=${r.phase} beat=${beat}`);
  console.log(`  created=${r.created_at} updated=${r.updated_at}`);
  console.log(`  msg: ${r.msg?.slice(0, 100) ?? ''}`);
}
