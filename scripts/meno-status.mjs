import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT data->'gateStatuses' as gs,
         data->>'selectedSubAvatarId' as sel_sub
  FROM projects_mirror WHERE id = '12e0152b-740b-49ee-ae02-1fefba3a3d08'
`;
console.log('gateStatuses:', rows[0].gs);
console.log('selectedSubAvatarId:', rows[0].sel_sub);

const g5 = await sql`
  SELECT status, data->>'status' as d_status, length(data::text) as size,
         data->'data' ? 'advertorial_it-IT' as has_advertorial
  FROM gate_outputs_mirror
  WHERE project_id = '12e0152b-740b-49ee-ae02-1fefba3a3d08' AND gate_id = 'gate5'
`;
console.log('\nG5 in mirror:', g5[0]);
