import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const r = await sql`SELECT id, owner, project_id, status, phase, created_at FROM pipeline_jobs ORDER BY created_at DESC LIMIT 5`;
for (const x of r) console.log(x.id, '|', x.owner, '|', x.status, x.phase, '|', x.created_at);
