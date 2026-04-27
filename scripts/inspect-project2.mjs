import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const id = '0226f20f-1eb0-4671-b74c-95b5aca5c4f6';
const [r] = await sql`SELECT data FROM projects_mirror WHERE id=${id}`;
console.log('--- coreAvatarInput ---');
console.log(JSON.stringify(r.data.coreAvatarInput, null, 2));
console.log('--- avatarSourceConfig ---');
console.log(JSON.stringify(r.data.avatarSourceConfig, null, 2));
console.log('--- activeAvatarJobId ---');
console.log(r.data.activeAvatarJobId);
console.log('--- avatarRunResult keys ---');
const arr = r.data.avatarRunResult;
console.log(arr ? Object.keys(arr).join(', ') : '(none)');
if (arr) {
  console.log('subAvatars:', (arr.sub_avatars ?? []).length);
  console.log('itemCounts:', JSON.stringify(arr.item_counts ?? arr.source_meta ?? {}));
}
console.log('--- currentGate / gateStatuses ---');
console.log('currentGate:', r.data.currentGate);
console.log('gateStatuses:', JSON.stringify(r.data.gateStatuses));

// Check inngest job table
const jobs = await sql`
  SELECT job_id, status, phase, error, created_at, updated_at
  FROM avatar_jobs
  WHERE project_id = ${id}
  ORDER BY created_at DESC
  LIMIT 5
`.catch((e) => { console.warn('no avatar_jobs table?', e.message); return []; });
console.log('\n--- recent jobs for this project ---');
for (const j of jobs) {
  console.log(`  ${j.job_id} status=${j.status} phase=${j.phase} updated=${j.updated_at} err=${j.error?.slice(0, 100) ?? ''}`);
}
