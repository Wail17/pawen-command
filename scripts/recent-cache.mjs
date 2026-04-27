import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT cache_key, inputs_summary, cached_at, expires_at, data
  FROM excavation_fetch_cache
  ORDER BY cached_at DESC
  LIMIT 5
`;
for (const r of rows) {
  let total = 0;
  const breakdown = [];
  for (const [src, b] of Object.entries(r.data ?? {})) {
    const n = b?.itemCount ?? b?.items?.length ?? 0;
    total += n;
    breakdown.push(`${src}=${n}`);
  }
  console.log(`${r.cache_key.slice(0, 12)}… ${r.cached_at}  total=${total}  ${breakdown.join(' ')}`);
  console.log(`  ${r.inputs_summary?.slice(0, 130)}`);
}
