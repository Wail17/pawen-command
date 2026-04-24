// Reset empty G7/G8 for MenoItaly so the auto-pipeline re-runs them
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

const PROJECT_ID = '12e0152b-740b-49ee-ae02-1fefba3a3d08';

const before = await sql`
  SELECT gate_id, status FROM gate_outputs_mirror
  WHERE project_id = ${PROJECT_ID} AND gate_id IN ('gate6','gate7','gate8','gate9')
  ORDER BY gate_id
`;
console.log('Avant:', before);

const del = await sql`
  DELETE FROM gate_outputs_mirror
  WHERE project_id = ${PROJECT_ID} AND gate_id IN ('gate7','gate8')
  RETURNING gate_id
`;
console.log('Supprimé:', del);

console.log('\n✅ G7 + G8 supprimés. Lance l\'Auto-Pipeline dans l\'app → il va générer G6, G7, G8 propres.');
