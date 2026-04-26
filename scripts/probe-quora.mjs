// Probe Quora dataset directly
const BD_KEY = '04c5ddd1-14b9-4743-befb-a99a3ae140c5';
const DATASET = 'gd_lvz1rbj81afv3m6n5y';

const ATTEMPTS = [
  // Try different search URL patterns
  { type: 'discover_new', discoverBy: 'search_url', input: { url: 'https://www.quora.com/search?q=weight%20loss' } },
  { type: 'discover_new', discoverBy: 'search_url', input: { url: 'https://www.quora.com/search?q=weight+loss&type=question' } },
  // Try a real existing Quora question URL via url_collection
  { type: 'url_collection', input: { url: 'https://www.quora.com/What-is-the-best-way-to-lose-weight' } },
];

for (const a of ATTEMPTS) {
  console.log(`\n=== type=${a.type} discoverBy=${a.discoverBy ?? 'none'} ===`);
  const params = new URLSearchParams({ dataset_id: DATASET, include_errors: 'true', type: a.type });
  if (a.discoverBy) params.set('discover_by', a.discoverBy);
  const res = await fetch(`https://api.brightdata.com/datasets/v3/trigger?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BD_KEY}` },
    body: JSON.stringify([a.input]),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}:`, text.slice(0, 600));
  if (res.status >= 400) continue;
  const trig = JSON.parse(text);
  const snapId = trig.snapshot_id;
  if (!snapId) continue;
  console.log(`polling ${snapId}...`);
  const start = Date.now();
  while (Date.now() - start < 240_000) {
    await new Promise(r => setTimeout(r, 6000));
    const sres = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapId}?format=json`, {
      headers: { Authorization: `Bearer ${BD_KEY}` },
    });
    const t = await sres.text();
    let d;
    try { d = JSON.parse(t); } catch { process.stdout.write('.'); continue; }
    if (d?.status === 'running' || d?.status === 'building') { process.stdout.write(`[${d.status}]`); continue; }
    if (Array.isArray(d)) {
      console.log(`\n✓ ${d.length} rows`);
      if (d[0]) {
        console.log('keys:', Object.keys(d[0]).join(', '));
        console.log(JSON.stringify(d[0], null, 2).slice(0, 1500));
      }
      break;
    }
    console.log('\nunexpected:', JSON.stringify(d).slice(0, 400));
    break;
  }
}
