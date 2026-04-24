import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const r = await sql`SELECT gate_id, status, updated_at, length(data::text) as size FROM gate_outputs_mirror WHERE project_id='12e0152b-740b-49ee-ae02-1fefba3a3d08' ORDER BY gate_id`;
for (const row of r) console.log(`${row.gate_id}  ${row.status.padEnd(18)}  size=${String(row.size).padStart(6)}  updated=${row.updated_at}`);
