import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const PROJECT_ID = '12e0152b-740b-49ee-ae02-1fefba3a3d08';

const proj = (await sql`SELECT data FROM projects_mirror WHERE id = ${PROJECT_ID}`)[0].data;
const gates = await sql`SELECT gate_id, status, data FROM gate_outputs_mirror WHERE project_id = ${PROJECT_ID} ORDER BY gate_id`;

const strip = s => typeof s === 'string' ? s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '') : s;

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║  PROJET: ' + strip(proj.name).padEnd(58) + '║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`  id:            ${proj.id}`);
console.log(`  owner:         ${proj.owner || 'Sykss'}`);
console.log(`  marché:        ${proj.targetMarket}`);
console.log(`  langue:        ${proj.targetLanguage}`);
console.log(`  niche:         ${strip(proj.niche || '')}`);
console.log(`  funnel:        ${proj.selectedFunnel || '⚠️  non sélectionné'}`);
console.log(`  sub-avatar:    ${proj.selectedSubAvatarId}`);

console.log('\n─── BRAND DNA (locked) ──────────────────────────────');
const bd = proj.brandDNA;
if (bd?.locked) {
  console.log(`  mechanism:     ${strip(bd.locked_terms?.mechanism_name || '')}`);
  console.log(`  positioning:   ${strip(String(bd.positioning || '').slice(0, 200))}`);
  console.log(`  tone:          ${strip(String(bd.brand_voice?.tone || '').slice(0, 200))}`);
  if (bd.never_use) console.log(`  never_use:     ${JSON.stringify(bd.never_use).slice(0, 200)}`);
}

console.log('\n─── SUB-AVATARS (4) ─────────────────────────────────');
const subs = proj.avatarRunResult?.sub_avatars || [];
for (const s of subs) {
  const mark = s.id === proj.selectedSubAvatarId ? '⭐ SELECTED' : '  ';
  console.log(`\n  ${mark}  ${strip(s.name)} ("${strip(s.nickname || '')}")`);
  console.log(`      ${strip(String(s.description || '').slice(0, 250))}`);
  if (s.dominant_category) console.log(`      catégorie: ${strip(s.dominant_category)}`);
  if (s.emotional_triggers?.length) console.log(`      triggers: ${s.emotional_triggers.slice(0,4).map(strip).join(' / ')}`);
  if (s.verbatim_quotes?.length) {
    console.log(`      verbatims top 2:`);
    for (const v of s.verbatim_quotes.slice(0, 2)) {
      console.log(`        "${strip(String(v.quote || '').slice(0, 150))}"`);
    }
  }
}

console.log('\n─── G2 VOICE / LANGUAGE DNA ─────────────────────────');
const g2 = gates.find(g => g.gate_id === 'gate2')?.data?.data;
if (g2) {
  const voice = g2.voice_profile || g2.voice || g2.dossier?.voice;
  console.log(`  ${strip(JSON.stringify(voice || g2).slice(0, 500))}...`);
}

console.log('\n─── G3 ROOT CAUSE + MECHANISM ───────────────────────');
const g3 = gates.find(g => g.gate_id === 'gate3')?.data?.data;
if (g3) {
  if (g3.root_cause) console.log(`  ROOT CAUSE: ${strip(String(g3.root_cause).slice(0, 400))}`);
  if (g3.mechanism) console.log(`  MECHANISM: ${strip(JSON.stringify(g3.mechanism).slice(0, 400))}`);
}

console.log('\n─── G4 TOP HOOKS ────────────────────────────────────');
const g4 = gates.find(g => g.gate_id === 'gate4')?.data?.data;
const hooks = g4?.top_hooks || g4?.hooks || [];
if (Array.isArray(hooks)) {
  for (const h of hooks.slice(0, 8)) {
    const txt = strip(h.hook || h.text || h.headline || '');
    const score = h.score ? ` (${h.score})` : '';
    console.log(`  • ${txt}${score}`);
  }
}

console.log('\n─── G5 ADVERTORIAL (ZAK 7-BLOCK) ────────────────────');
const g5 = gates.find(g => g.gate_id === 'gate5')?.data?.data;
if (g5) {
  console.log(`  Headlines:`);
  const hopts = g5.headline_options || [];
  for (const h of (Array.isArray(hopts) ? hopts : []).slice(0, 5)) {
    console.log(`    → ${strip(String(h.headline || h.text || h).slice(0, 200))}`);
  }
  if (g5.subheadline) console.log(`\n  Subheadline: ${strip(String(g5.subheadline).slice(0, 300))}`);
  if (g5['advertorial_it-IT']) {
    const ad = g5['advertorial_it-IT'];
    const full = typeof ad === 'string' ? ad : JSON.stringify(ad);
    console.log(`\n  Advertorial IT-IT (${full.length} chars, extrait 800):\n${strip(full).slice(0, 800)}...`);
  }
}

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║  TOUT EST EN SERVEUR ET RÉCUPÉRABLE                             ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`\n  Lien direct: https://sykss-agency.vercel.app/project/${PROJECT_ID}`);
console.log(`  Gate 5:      https://sykss-agency.vercel.app/project/${PROJECT_ID}/gate/gate5\n`);
