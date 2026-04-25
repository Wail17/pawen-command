// Live Bright Data smoke test against prod via /api/scraping/fetch.
// Hits ONE source (reddit) with a small query, dumps the first 2 raw items
// so we can verify the field names match what the adapter parsers expect.
//
// Usage: npx -y dotenv-cli -e .env.local -- node scripts/smoke-bright-data.mjs

const PROD = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';
const APP_PW = process.env.APP_PASSWORD;
const ADMIN_PW = process.env.ADMIN_PASSWORD;

if (!APP_PW || !ADMIN_PW) { console.error('Need APP_PASSWORD + ADMIN_PASSWORD'); process.exit(1); }

// Login
const loginRes = await fetch(`${PROD}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
  body: JSON.stringify({ password: APP_PW, user: 'Sykss' }),
});
const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
if (!cookie) { console.error('login failed', await loginRes.text()); process.exit(1); }
console.log(`✓ logged in (cookie len=${cookie.length})\n`);

const headers = { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, Cookie: cookie };

// Force the new stack ON for this call by setting NEXT_PUBLIC_USE_NEW_SCRAPING_STACK
// is read on the client; the server route /api/scraping/fetch runs the new
// stack unconditionally. So we just call it directly.

async function probe(source, plan, language = 'en-US') {
  console.log(`=== ${source.toUpperCase()} ===`);
  const t0 = Date.now();
  const res = await fetch(`${PROD}/api/scraping/fetch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source, plan, language }),
  });
  const dur = Date.now() - t0;
  const body = await res.text();
  let data;
  try { data = JSON.parse(body); } catch { console.log(`✗ HTTP ${res.status} non-JSON: ${body.slice(0, 300)}`); return; }
  console.log(`status=${res.status} duration=${(dur/1000).toFixed(1)}s ok=${data.ok}`);
  if (!data.ok) {
    console.log(`  message: ${data.message ?? '?'}`);
    return;
  }
  const d = data.data;
  console.log(`  items=${d.itemCount}  queries=${d.queries?.slice(0,2).join(' | ') ?? '?'}`);
  if (d.error) console.log(`  error: ${d.error}`);
  if (d.error?.includes('validation_error')) {
    // Dump full so we can read the truncated payload
    console.log(`  FULL ERROR:\n${d.error}`);
  }
  if (d.items && d.items[0]) {
    console.log(`\n  First item raw shape:\n${JSON.stringify(d.items[0], null, 2).slice(0, 1500)}`);
  } else {
    console.log(`  (no items returned)`);
  }
  console.log('');
}

// Pick which to probe via SOURCES env: e.g. SOURCES=tiktok,amazon
const SOURCES = (process.env.SOURCES ?? 'reddit,quora,youtube,tiktok,amazon').split(',').map(s => s.trim());
const all = {
  reddit:  () => probe('reddit',  { subreddits: ['dogs'], queries: ['senior dog probiotic'] }, 'en-US'),
  quora:   () => probe('quora',   { queries: ['senior dog probiotic supplement'] }, 'en-US'),
  youtube: () => probe('youtube', { video_queries: ['senior dog probiotic'] }, 'en-US'),
  tiktok:  () => probe('tiktok',  { search_queries: ['senior dog probiotic'], hashtags: [] }, 'en-US'),
  amazon:  () => probe('amazon',  { product_queries: ['probiótico perro senior'], marketplace: 'amazon.es' }, 'es-ES'),
};
for (const s of SOURCES) if (all[s]) await all[s]();
