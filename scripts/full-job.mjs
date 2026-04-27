import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const id = process.argv[2];
const [r] = await sql`
  SELECT id, owner, project_id, status, phase, error,
         payload, progress, heartbeat_at, created_at, updated_at
  FROM pipeline_jobs WHERE id = ${id}
`;
if (!r) { console.log('not found'); process.exit(1); }
const ageS = Math.round((Date.now() - new Date(r.updated_at).getTime()) / 1000);
const elapsedS = Math.round((Date.now() - new Date(r.created_at).getTime()) / 1000);
console.log(`id:        ${r.id}`);
console.log(`owner:     ${r.owner}`);
console.log(`project:   ${r.project_id}`);
console.log(`status:    ${r.status}  phase: ${r.phase}`);
console.log(`elapsed:   ${elapsedS}s (${(elapsedS/60).toFixed(1)} min)`);
console.log(`updated:   ${ageS}s ago`);
console.log(`progress:`, JSON.stringify(r.progress, null, 2));
console.log(`\npayload.core:`);
console.log(`  product: ${r.payload?.core?.product?.slice(0, 100)}`);
console.log(`  niche:   ${r.payload?.core?.niche?.slice(0, 100)}`);
console.log(`  lang:    ${r.payload?.core?.language}`);
console.log(`  market:  ${r.payload?.core?.market}`);
console.log(`payload.config:`, JSON.stringify(r.payload?.config));
if (r.error) console.log(`\nERROR: ${r.error}`);
