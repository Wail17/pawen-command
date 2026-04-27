// Inspect a specific project_mirror row to understand data shape + gate state.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const projectId = process.argv[2];
if (!projectId) {
  console.error('usage: node inspect-project.mjs <project-id-prefix>');
  process.exit(1);
}

const rows = await sql`
  SELECT id, owner, name, created_at, updated_at, data
  FROM projects_mirror
  WHERE id::text LIKE ${projectId + '%'}
  LIMIT 1
`;
if (!rows.length) {
  console.error('no match');
  process.exit(1);
}
const p = rows[0];
console.log(`id=${p.id}`);
console.log(`owner=${p.owner}`);
console.log(`name=${p.name}`);
console.log(`updated_at=${p.updated_at}`);
console.log(`top-level keys: ${Object.keys(p.data).join(', ')}`);
const core = p.data.core ?? p.data.coreAvatar ?? p.data.input ?? null;
console.log(`\ncore present? ${!!core}`);
if (core) {
  console.log(JSON.stringify(core, null, 2));
}
console.log(`\nselectedSubAvatarId: ${p.data.selectedSubAvatarId ?? '(none)'}`);
console.log(`selectedFunnel:      ${p.data.selectedFunnel ?? '(none)'}`);
console.log(`shopifyData?         ${!!p.data.shopifyData}`);

const gates = await sql`
  SELECT gate_id, status, updated_at,
         (CASE WHEN data IS NULL THEN 0 ELSE octet_length(data::text) END) AS data_bytes
  FROM gate_outputs_mirror
  WHERE project_id = ${p.id}
  ORDER BY gate_id
`;
console.log(`\ngate outputs: ${gates.length}`);
for (const g of gates) {
  console.log(`  ${g.gate_id}: status=${g.status} bytes=${g.data_bytes} updated=${g.updated_at}`);
}
