// Push the new avatarRunResult from pipeline_jobs.result into projects_mirror.data
// so the UI bootstrap picks it up on next home-dashboard load.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const jobId = process.argv[2];
const projectId = process.argv[3];
if (!jobId || !projectId) {
  console.error('usage: push-result-to-mirror.mjs <jobId> <projectId>');
  process.exit(1);
}

const [job] = await sql`SELECT result, status, project_id FROM pipeline_jobs WHERE id = ${jobId}`;
if (!job || job.status !== 'completed' || !job.result?.avatarRunResult) {
  console.error('job not completed or missing avatarRunResult');
  process.exit(1);
}
if (job.project_id !== projectId) {
  console.error(`job's project_id (${job.project_id}) doesn't match arg (${projectId})`);
  process.exit(1);
}

const arr = job.result.avatarRunResult;
console.log(`avatarRunResult ready: ${arr.sub_avatars?.length ?? 0} sub_avatars`);

const [before] = await sql`
  SELECT data->'avatarRunResult'->'sub_avatars' AS old_subs,
         updated_at
  FROM projects_mirror WHERE id = ${projectId}
`;
console.log(`current mirror: ${before?.old_subs?.length ?? 0} sub_avatars (last update: ${before?.updated_at})`);

await sql`
  UPDATE projects_mirror
  SET data = jsonb_set(data, '{avatarRunResult}', ${JSON.stringify(arr)}::jsonb, true),
      updated_at = NOW()
  WHERE id = ${projectId}
`;

const [after] = await sql`
  SELECT data->'avatarRunResult'->'sub_avatars' AS new_subs, updated_at
  FROM projects_mirror WHERE id = ${projectId}
`;
console.log(`new mirror:     ${after?.new_subs?.length ?? 0} sub_avatars (updated: ${after?.updated_at})`);
console.log('\nnew sub-avatars:');
for (const s of arr.sub_avatars ?? []) {
  console.log(`  - ${s.id}: ${s.name ?? s.nickname ?? '?'}`);
}
console.log('\n→ open https://sykss-agency.vercel.app, log in as suley, hit home dashboard once');
console.log('  to trigger bootstrap restore, then open the Standing Professional project.');
