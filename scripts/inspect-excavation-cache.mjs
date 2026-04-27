// One-off: list excavation_fetch_cache entries and link them to projects_mirror
// so we know which project was scraped and can resume from cache.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  SELECT cache_key, inputs_summary, cached_at, expires_at, hit_count,
         (expires_at > NOW()) AS fresh,
         jsonb_object_keys(data) AS source_type
  FROM excavation_fetch_cache
  ORDER BY cached_at DESC
`;

console.log(`excavation_fetch_cache rows (with source_type expansion): ${rows.length}`);
const grouped = new Map();
for (const r of rows) {
  const k = r.cache_key;
  if (!grouped.has(k)) {
    grouped.set(k, { ...r, sources: [] });
  }
  grouped.get(k).sources.push(r.source_type);
}

for (const [k, v] of grouped) {
  console.log('---');
  console.log(`cache_key:      ${k.slice(0, 16)}…`);
  console.log(`fresh:          ${v.fresh}`);
  console.log(`cached_at:      ${v.cached_at}`);
  console.log(`expires_at:     ${v.expires_at}`);
  console.log(`hit_count:      ${v.hit_count}`);
  console.log(`sources:        ${v.sources.join(', ')}`);
  console.log(`inputs_summary: ${v.inputs_summary}`);
}

console.log('\n=== Recent projects (last 10) ===');
const projs = await sql`
  SELECT id, owner, name, updated_at,
         data->'core'->>'product' AS product,
         data->'core'->>'niche' AS niche,
         data->'core'->>'language' AS language,
         data->'core'->>'market' AS market,
         data->'core'->>'surface_desire' AS surface_desire
  FROM projects_mirror
  ORDER BY updated_at DESC
  LIMIT 10
`;
for (const p of projs) {
  console.log(`- ${p.id.slice(0, 8)}… owner=${p.owner} name=${p.name}`);
  console.log(`    product=${p.product} | niche=${p.niche} | lang=${p.language} | market=${p.market}`);
  console.log(`    surface_desire=${(p.surface_desire ?? '').slice(0, 80)}`);
  console.log(`    updated_at=${p.updated_at}`);
}
