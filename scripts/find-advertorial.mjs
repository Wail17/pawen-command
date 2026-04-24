// One-off recovery script: find the user's gate5 (advertorial) work
// from the last 48h, across ALL projects in the mirror.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

console.log('\n=== RECENT PROJECTS (48h) ===\n');
const projects = await sql`
  SELECT id, owner, name, updated_at,
         data->>'niche' as niche,
         data->>'targetMarket' as market,
         data->>'targetLanguage' as lang,
         data->'avatarRunResult'->'sub_avatars' as sub_avatars,
         data->>'selectedSubAvatarId' as selected_sub
  FROM projects_mirror
  WHERE updated_at > NOW() - INTERVAL '48 hours'
  ORDER BY updated_at DESC
  LIMIT 20
`;

for (const p of projects) {
  const subs = p.sub_avatars || [];
  console.log(`📁 ${p.name}`);
  console.log(`   id: ${p.id}  owner: ${p.owner}`);
  console.log(`   niche: ${p.niche}  market: ${p.market}  lang: ${p.lang}`);
  console.log(`   updated: ${p.updated_at}`);
  if (Array.isArray(subs) && subs.length) {
    console.log(`   sub-avatars (${subs.length}):`);
    for (const s of subs) {
      const marker = s.id === p.selected_sub ? ' ⭐ SELECTED' : '';
      console.log(`     - ${s.name || '?'} ("${s.nickname || '?'}")${marker}`);
    }
  }
  console.log('');
}

console.log('\n=== GATE 5 (ADVERTORIAL) OUTPUTS (48h) ===\n');
const gate5s = await sql`
  SELECT g.id, g.project_id, g.owner, g.status, g.updated_at,
         p.name as project_name,
         p.data->>'niche' as niche,
         g.data->>'background_story' as bg_story,
         g.data->>'advertorial' as advertorial,
         g.data as full_data
  FROM gate_outputs_mirror g
  LEFT JOIN projects_mirror p ON p.id = g.project_id
  WHERE g.gate_id = 'gate5'
    AND g.updated_at > NOW() - INTERVAL '48 hours'
  ORDER BY g.updated_at DESC
  LIMIT 10
`;

if (gate5s.length === 0) {
  console.log('⚠️  Aucun gate5 dans les dernières 48h.\n');
} else {
  for (const g of gate5s) {
    console.log(`📝 PROJET: ${g.project_name} (${g.niche})`);
    console.log(`   project_id: ${g.project_id}`);
    console.log(`   status: ${g.status}  updated: ${g.updated_at}`);
    const keys = Object.keys(g.full_data || {});
    console.log(`   data keys: ${keys.slice(0, 10).join(', ')}`);
    if (g.bg_story) {
      console.log(`   background_story (extrait):\n     ${String(g.bg_story).slice(0, 400)}...`);
    }
    if (g.advertorial) {
      console.log(`   advertorial (extrait):\n     ${String(g.advertorial).slice(0, 400)}...`);
    }
    console.log('');
  }
}

console.log('\n=== TOUS GATES RECENTS (24h) — pour voir où tu bossais ===\n');
const recent = await sql`
  SELECT g.gate_id, g.project_id, g.status, g.updated_at,
         p.name as project_name
  FROM gate_outputs_mirror g
  LEFT JOIN projects_mirror p ON p.id = g.project_id
  WHERE g.updated_at > NOW() - INTERVAL '24 hours'
  ORDER BY g.updated_at DESC
  LIMIT 30
`;
for (const r of recent) {
  console.log(`  ${r.updated_at.toISOString()}  ${r.gate_id.padEnd(10)} ${r.status.padEnd(20)} ${r.project_name || r.project_id}`);
}
