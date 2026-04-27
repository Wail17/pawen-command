import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='bd_snapshot_cache'`;
console.log('columns:', cols.map(c => c.column_name).join(', '));
const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
const total = await sql`SELECT COUNT(*) AS n, COUNT(CASE WHEN data IS NOT NULL THEN 1 END) AS delivered FROM bd_snapshot_cache WHERE triggered_at >= ${today.toISOString()}`;
console.log(`today total rows: ${total[0]?.n}, delivered: ${total[0]?.delivered}`);
const byDataset = await sql`SELECT dataset_id, label, COUNT(*) AS n, COUNT(CASE WHEN data IS NOT NULL THEN 1 END) AS delivered, SUM(record_count) AS records FROM bd_snapshot_cache WHERE triggered_at >= ${today.toISOString()} GROUP BY dataset_id, label ORDER BY n DESC`;
for (const r of byDataset) {
  console.log(`  ${(r.label ?? r.dataset_id ?? '?').padEnd(35)} snaps=${r.n} delivered=${r.delivered} records=${r.records ?? 0}`);
}
const sample = await sql`SELECT cache_key, dataset_id, label, snapshot_id, bd_status, record_count, triggered_at, recovered_at FROM bd_snapshot_cache ORDER BY triggered_at DESC LIMIT 3`;
console.log('\nrecent 3:');
for (const r of sample) {
  const small = {};
  for (const k of Object.keys(r)) {
    if (k === 'rows_jsonl' || k === 'payload') {
      small[k] = r[k] ? `${typeof r[k] === 'string' ? r[k].length : JSON.stringify(r[k]).length} chars` : null;
    } else small[k] = r[k];
  }
  console.log(small);
}
