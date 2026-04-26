// Try multiple URL formats for Amazon Reviews dataset.
// Use a definitely-real bestseller ASIN.

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

// Echo Dot 5 — definitely real, millions of reviews
const URLS = [
  'https://www.amazon.com/dp/B09B8V1LZ3',
  'https://www.amazon.com/Echo-Dot-5th-Gen-Charcoal/dp/B09B8V1LZ3',
  'https://www.amazon.com/product-reviews/B09B8V1LZ3',
  'https://www.amazon.com/product-reviews/B09B8V1LZ3/',
  'https://www.amazon.com/Echo-Dot-5th-Gen-Charcoal/product-reviews/B09B8V1LZ3',
];

for (const url of URLS) {
  console.log(`\n=== ${url} ===`);
  const t0 = Date.now();
  const res = await fetch(`${PROD}/api/scraping/debug-comments`, {
    method: 'POST', headers,
    body: JSON.stringify({ datasetId: 'gd_le8e811kzy4ggddlq', url, type: 'url_collection' }),
  });
  const data = await res.json();
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  if (data.ok) {
    const sample = data.sample[0] ?? {};
    if (sample.error_code) {
      console.log(`✗ ${dur}s · ${sample.error_code}: ${sample.error}`);
    } else {
      console.log(`✓ ${dur}s · ${data.rowCount} rows · keys: ${data.firstRowKeys.slice(0, 12).join(', ')}`);
      console.log(JSON.stringify(sample, null, 2).slice(0, 1500));
      break;
    }
  } else {
    console.log(`✗ ${dur}s · ${data.message}`);
  }
}
