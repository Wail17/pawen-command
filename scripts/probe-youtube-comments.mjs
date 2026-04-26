// Probe YouTube comments dataset directly to find field names.
// Use BD trigger+poll directly to avoid Vercel timeout limits.

const BD_KEY = process.env.BRIGHTDATA_API_KEY ?? '04c5ddd1-14b9-4743-befb-a99a3ae140c5';
const DATASET = 'gd_lk9q0ew71spt1mxywf';
const URL = 'https://www.youtube.com/watch?v=kJQP7kiw5Fk'; // Despacito, 8B+ views, lots of comments

console.log('Triggering BD YouTube comments...');
const params = new URLSearchParams({ dataset_id: DATASET, include_errors: 'true', type: 'url_collection' });
const trigRes = await fetch(`https://api.brightdata.com/datasets/v3/trigger?${params}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BD_KEY}` },
  body: JSON.stringify([{ url: URL }]),
});
const trig = await trigRes.json();
console.log('trigger:', trig);
const snapId = trig.snapshot_id;
if (!snapId) process.exit(1);

console.log(`\nPolling snapshot ${snapId}...`);
const start = Date.now();
let rows = null;
while (Date.now() - start < 600_000) {
  await new Promise(r => setTimeout(r, 8000));
  const sres = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapId}?format=json`, {
    headers: { Authorization: `Bearer ${BD_KEY}` },
  });
  const text = await sres.text();
  let data;
  try { data = JSON.parse(text); } catch {
    process.stdout.write('.');
    continue;
  }
  if (data?.status === 'running' || data?.status === 'building') {
    process.stdout.write(`[${data.status}]`);
    continue;
  }
  if (Array.isArray(data)) {
    rows = data;
    console.log(`\n✓ ${rows.length} rows after ${((Date.now() - start) / 1000).toFixed(1)}s`);
    break;
  }
  console.log('\nUnexpected:', data);
  break;
}

if (rows && rows[0]) {
  console.log('\nKeys:', Object.keys(rows[0]).join(', '));
  console.log('\nFirst row:', JSON.stringify(rows[0], null, 2).slice(0, 2500));
}
