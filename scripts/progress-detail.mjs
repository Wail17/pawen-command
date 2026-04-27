import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const id = process.argv[2];
const [r] = await sql`SELECT progress, payload FROM pipeline_jobs WHERE id = ${id}`;
console.log('progress full:');
console.log(JSON.stringify(r.progress, null, 2));
