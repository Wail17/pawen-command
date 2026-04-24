import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  SELECT id, name, updated_at,
         data->'gateStatuses' as gate_statuses,
         data->>'selectedSubAvatarId' as sel_sub,
         data->'avatarRunResult'->'sub_avatars' as sub_avatars_raw,
         jsonb_array_length(COALESCE(data->'avatarRunResult'->'sub_avatars', '[]'::jsonb)) as sub_count
  FROM projects_mirror
  WHERE name = 'MenoItaly'
  ORDER BY updated_at DESC
`;

for (const r of rows) {
  console.log('\n=====================================');
  console.log(`id: ${r.id}`);
  console.log(`updated: ${r.updated_at}`);
  console.log(`sub_count: ${r.sub_count}`);
  console.log(`selectedSubAvatarId: ${r.sel_sub}`);
  console.log(`gateStatuses:`, r.gate_statuses);
}

console.log('\n=== gate outputs per project ===');
const g = await sql`
  SELECT project_id, gate_id, status, updated_at
  FROM gate_outputs_mirror
  WHERE project_id IN (SELECT id FROM projects_mirror WHERE name = 'MenoItaly')
  ORDER BY project_id, gate_id
`;
for (const x of g) console.log(`  ${x.project_id.slice(0,8)}  ${x.gate_id.padEnd(10)} ${x.status}`);
