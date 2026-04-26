// Probe YouTube + Amazon + Quora comments datasets with REAL popular URLs.

const PROD = 'https://pawen-command-center.vercel.app';
const APP_PW = process.env.APP_PASSWORD;
const ADMIN_PW = process.env.ADMIN_PASSWORD;

const loginRes = await fetch(`${PROD}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
  body: JSON.stringify({ password: APP_PW, user: 'Sykss' }),
});
const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
const headers = { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, Cookie: cookie };

const PROBES = [
  // Try Amazon reviews dataset with the /product-reviews/ URL form
  { id: 'gd_le8e811kzy4ggddlq', url: 'https://www.amazon.com/product-reviews/B07MTPK1F4/', type: 'url_collection', label: 'Amazon reviews (reviews-page)' },
];

for (const p of PROBES) {
  console.log(`\n=== ${p.label} ===`);
  const t0 = Date.now();
  const res = await fetch(`${PROD}/api/scraping/debug-comments`, {
    method: 'POST', headers,
    body: JSON.stringify({ datasetId: p.id, url: p.url, type: p.type }),
  });
  const data = await res.json();
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`HTTP ${res.status} · ${dur}s`);
  if (data.ok) {
    console.log(`✓ ${data.rowCount} rows`);
    console.log(`  keys: ${data.firstRowKeys.join(', ')}`);
    if (data.sample[0]) {
      const truncated = JSON.stringify(data.sample[0], null, 2).slice(0, 1800);
      console.log(`  first row:\n${truncated}`);
    }
  } else {
    console.log(`✗ ${data.message?.slice(0, 1500) ?? 'fail'}`);
  }
}
