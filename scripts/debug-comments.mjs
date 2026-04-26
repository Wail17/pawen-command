// Hits /api/scraping/debug-comments with each comments dataset to
// inspect the raw Bright Data response and identify field names.

const PROD = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';
const APP_PW = process.env.APP_PASSWORD;
const ADMIN_PW = process.env.ADMIN_PASSWORD;

if (!APP_PW || !ADMIN_PW) { console.error('need creds'); process.exit(1); }

// Login
const loginRes = await fetch(`${PROD}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
  body: JSON.stringify({ password: APP_PW, user: 'Sykss' }),
});
const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
if (!cookie) { console.error('login failed'); process.exit(1); }
console.log(`✓ logged in\n`);

const headers = { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, Cookie: cookie };

const PROBES = [
  { id: 'gd_lvzdpsdlw09j6t702', url: 'https://www.reddit.com/r/dogs/comments/1svbvvu/cant_poop_on_pads/', type: 'url_collection', label: 'Reddit comments' },
  { id: 'gd_lkf2st302ap89utw5k', url: 'https://www.tiktok.com/@senior.wags/video/7617821883215432982', type: 'url_collection', label: 'TikTok comments' },
  { id: 'gd_lk9q0ew71spt1mxywf', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', type: 'url_collection', label: 'YouTube comments' },
  { id: 'gd_le8e811kzy4ggddlq', url: 'https://www.amazon.com/dp/B07Y2WBNQR', type: 'url_collection', label: 'Amazon reviews' },
  { id: 'gd_ltppn085pokosxh13', url: 'https://www.instagram.com/p/Cab1Cd2Aabc/', type: 'url_collection', label: 'Instagram comments' },
];

for (const p of PROBES) {
  console.log(`=== ${p.label} (type=${p.type}) ===`);
  const t0 = Date.now();
  try {
    const res = await fetch(`${PROD}/api/scraping/debug-comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ datasetId: p.id, url: p.url, type: p.type }),
    });
    const data = await res.json();
    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`HTTP ${res.status} · ${dur}s`);
    if (data.ok) {
      console.log(`✓ ${data.rowCount} rows`);
      console.log(`  keys: ${data.firstRowKeys.join(', ')}`);
      if (data.sample[0]) {
        const truncated = JSON.stringify(data.sample[0], null, 2).slice(0, 1200);
        console.log(`  first row:\n${truncated}`);
      }
    } else if (data.providerError) {
      console.log(`✗ ProviderError: ${data.message.slice(0, 1500)}`);
    } else {
      console.log(`✗ ${data.message?.slice(0, 1500) ?? 'fail'}`);
    }
  } catch (e) {
    console.log(`✗ network: ${e.message}`);
  }
  console.log('');
}
