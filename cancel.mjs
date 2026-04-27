import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l && !l.startsWith('#') && l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i), l.slice(i+1).replace(/^["']|["']$/g,'')];}));
const sql = neon(env.DATABASE_URL);
await sql`UPDATE pipeline_jobs SET status='failed', phase='cancelled', error='manual stop - retry loop confirmed' WHERE id = 'job_7fa1076a-4228-4e39-bb93-b12206f4da71'`;
console.log('cancelled');
