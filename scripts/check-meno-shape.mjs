import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT gate_id, project_id,
    data->>'gateId' as d_gate_id,
    data->>'projectId' as d_proj_id,
    data->>'status' as d_status,
    jsonb_typeof(data->'data') as data_field_type,
    length(data::text) as size
  FROM gate_outputs_mirror
  WHERE project_id = '12e0152b-740b-49ee-ae02-1fefba3a3d08'
  ORDER BY gate_id
`;
for (const r of rows) console.log(r);
