import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const id = process.argv[2];

console.log(`searching for ${id}`);

let r = await sql`SELECT id, status, phase, project_id, owner FROM pipeline_jobs WHERE id = ${'job_' + id} OR id = ${id} LIMIT 5`;
console.log(`\npipeline_jobs match: ${r.length}`);
for (const x of r) console.log(' ', x);

r = await sql`SELECT id, owner, name, updated_at FROM projects_mirror WHERE id::text = ${id} LIMIT 5`;
console.log(`\nprojects_mirror match: ${r.length}`);
for (const x of r) console.log(' ', x);

r = await sql`SELECT project_id, gate_id, status, updated_at FROM gate_outputs_mirror WHERE id::text = ${id} LIMIT 5`;
console.log(`\ngate_outputs_mirror match: ${r.length}`);
for (const x of r) console.log(' ', x);

r = await sql`SELECT id, owner, project_id, status, phase, created_at FROM pipeline_jobs WHERE id LIKE ${'%' + id + '%'} LIMIT 5`;
console.log(`\nLIKE search pipeline_jobs: ${r.length}`);
for (const x of r) console.log(' ', x);
