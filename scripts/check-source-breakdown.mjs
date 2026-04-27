import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const [r] = await sql`SELECT result FROM pipeline_jobs WHERE id = ${process.argv[2]}`;
const arr = r.result?.avatarRunResult ?? r.result;
const rs = arr?.raw_signal ?? {};
console.log('source_breakdown:', JSON.stringify(rs.source_breakdown, null, 2));
console.log('source_errors:', JSON.stringify(rs.source_errors, null, 2));
console.log('total_items:', rs.total_items);
console.log('total_char_count:', rs.total_char_count);
