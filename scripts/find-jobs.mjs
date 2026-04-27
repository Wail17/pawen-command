import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const id = '0226f20f-1eb0-4671-b74c-95b5aca5c4f6';
const rows = await sql`
  SELECT id, owner, status, phase, error, created_at, updated_at,
         (CASE WHEN payload IS NULL THEN 0 ELSE octet_length(payload::text) END) AS payload_bytes
  FROM pipeline_jobs
  WHERE project_id = ${id}
  ORDER BY created_at DESC
  LIMIT 10
`;
console.log(`jobs for project ${id.slice(0, 8)}…: ${rows.length}`);
for (const j of rows) {
  console.log(`  ${j.id} status=${j.status} phase=${j.phase} bytes=${j.payload_bytes}`);
  console.log(`     created=${j.created_at} updated=${j.updated_at}`);
  if (j.error) console.log(`     error=${j.error.slice(0, 200)}`);
}
