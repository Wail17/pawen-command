import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l && !l.startsWith('#') && l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i), l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const sql = neon(env.DATABASE_URL);
const r = await sql`SELECT phase, status, progress->>'message' as msg, EXTRACT(EPOCH FROM (NOW() - heartbeat_at))::int as hb_ago, EXTRACT(EPOCH FROM (NOW() - created_at))::int as age FROM pipeline_jobs WHERE id = 'job_7fa1076a-4228-4e39-bb93-b12206f4da71'`;
console.log(JSON.stringify(r[0], null, 2));
