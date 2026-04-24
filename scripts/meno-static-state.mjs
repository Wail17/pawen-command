import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

const PROJECT_ID = '12e0152b-740b-49ee-ae02-1fefba3a3d08';

const rows = await sql`
  SELECT gate_id, status, updated_at, data
  FROM gate_outputs_mirror
  WHERE project_id = ${PROJECT_ID}
  ORDER BY gate_id
`;

console.log('\n=== MenoItaly — état complet pipeline ===\n');
for (const r of rows) {
  const d = r.data?.data ?? r.data;
  console.log(`${r.gate_id.padEnd(12)} ${r.status.padEnd(20)} ${r.updated_at.toISOString?.() ?? r.updated_at}`);

  if (r.gate_id === 'gate7') {
    const briefs = d?.preset_briefs || d?.briefs || [];
    console.log(`   → ${briefs.length} briefs créatifs`);
    if (Array.isArray(briefs)) {
      const byPreset = {};
      for (const b of briefs) {
        const p = b.preset || b.preset_type || 'unknown';
        byPreset[p] = (byPreset[p] || 0) + 1;
      }
      for (const [p, n] of Object.entries(byPreset)) console.log(`      • ${p}: ${n}`);

      console.log('\n   === APERÇU 3 premiers briefs ===');
      for (const b of briefs.slice(0, 3)) {
        console.log(`\n   [${b.preset || '?'}] ${b.id || ''}`);
        if (b.headline_options) console.log(`     Headlines: ${JSON.stringify(b.headline_options).slice(0, 250)}`);
        if (b.visual_direction) console.log(`     Visual: ${JSON.stringify(b.visual_direction).slice(0, 250)}`);
        if (b.scene) console.log(`     Scene: ${String(b.scene).slice(0, 200)}`);
      }
    }
  }

  if (r.gate_id === 'gate8') {
    const imgs = d?.generated_images || d?.image_configs || [];
    console.log(`   → ${Array.isArray(imgs) ? imgs.length : '?'} configs images`);
    if (Array.isArray(imgs) && imgs[0]) {
      console.log(`   sample: ${JSON.stringify(imgs[0]).slice(0, 300)}`);
    }
  }

  if (r.gate_id === 'gate5') {
    const keys = d ? Object.keys(d).slice(0, 15) : [];
    console.log(`   → advertorial keys: ${keys.join(', ')}`);
  }
}

const proj = await sql`SELECT data FROM projects_mirror WHERE id = ${PROJECT_ID}`;
const pd = proj[0]?.data;
console.log('\n=== Project meta ===');
console.log(`  name: ${pd?.name}`);
console.log(`  targetLanguage: ${pd?.targetLanguage}`);
console.log(`  targetMarket: ${pd?.targetMarket}`);
console.log(`  selectedFunnel: ${pd?.selectedFunnel}`);
console.log(`  selectedSubAvatarId: ${pd?.selectedSubAvatarId}`);
console.log(`  humanDecisions picked?: ${pd?.humanDecisions?.picked ? Object.keys(pd.humanDecisions.picked).length : 0} items`);
if (pd?.brandDNA?.locked_terms?.mechanism_name) {
  console.log(`  Brand DNA mechanism: ${pd.brandDNA.locked_terms.mechanism_name}`);
}
console.log(`  shopifyData?: ${!!pd?.shopifyData} (${pd?.shopifyData?.productTitle || ''})`);
