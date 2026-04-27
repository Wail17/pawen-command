import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const id = process.argv[2];
const [r] = await sql`
  SELECT id, status, phase, result IS NOT NULL AS has_result,
         CASE WHEN result IS NOT NULL THEN octet_length(result::text) ELSE 0 END AS result_bytes,
         updated_at, error
  FROM pipeline_jobs WHERE id = ${id}
`;
console.log(r);
if (r?.has_result) {
  const [r2] = await sql`SELECT result FROM pipeline_jobs WHERE id = ${id}`;
  const arr = r2.result.avatarRunResult ?? r2.result;
  console.log('\navatarRunResult keys:', Object.keys(arr).join(', '));
  if (arr.sub_avatars) {
    console.log(`sub_avatars: ${arr.sub_avatars.length}`);
    for (const s of arr.sub_avatars) {
      console.log(`  - ${s.id ?? '?'}: ${s.name ?? s.nickname ?? '?'} (${s.verbatims?.length ?? 0} verbatims, ${s.angles?.length ?? 0} angles)`);
    }
  }
  if (arr.metadata) console.log('metadata:', JSON.stringify(arr.metadata).slice(0, 300));
}
