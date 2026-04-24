// Phase audit: hit every source-fronting API on prod with a single canonical
// query (Spanish-language senior dog probiotics) and report latency + success
// + item count + duplicates. Read-only; never modifies anything.

const PROD = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';
const ADMIN_PW = process.env.ADMIN_PASSWORD;
const APP_PW = process.env.APP_PASSWORD;

if (!ADMIN_PW || !APP_PW) {
  console.error('Pull prod env: vercel env pull .env.local --environment=production --yes');
  process.exit(1);
}

const NICHE_EN = 'senior dog probiotic';
const NICHE_ES = 'probiótico perro senior';
const SPANISH_SUBREDDITS = ['dogs', 'DogAdvice', 'puppy101']; // seniors en es is narrow; use EN subs as proxy
const KNOWN_SHOPIFY_STORE = 'https://www.petplate.com/products/senior-dog-food'; // a known dog food shopify

// --- login ---
async function login() {
  const usersRes = await fetch(`${PROD}/api/auth/users`, { headers: { 'x-admin-token': ADMIN_PW } });
  const users = (await usersRes.json()).users ?? [];
  const admin = users.find(u => u.role === 'admin') ?? users[0];
  if (!admin) throw new Error('no user');
  const loginRes = await fetch(`${PROD}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
    body: JSON.stringify({ password: APP_PW, user: admin.name }),
  });
  const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
  if (!cookie) throw new Error('login failed');
  return { cookie, userName: admin.name };
}

const { cookie } = await login();
const headers = { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, 'Cookie': cookie };

async function time(label, payload, urlPath, extractItemCount) {
  const started = Date.now();
  let status = 0, body = '';
  try {
    const res = await fetch(`${PROD}${urlPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    status = res.status;
    body = await res.text();
  } catch (e) {
    return { label, urlPath, status: 0, latencyMs: Date.now() - started, error: String(e), items: 0 };
  }
  const latencyMs = Date.now() - started;
  let json;
  try { json = JSON.parse(body); } catch { json = null; }
  const items = json ? extractItemCount(json) : 0;
  return {
    label,
    urlPath,
    status,
    latencyMs,
    items,
    errorOrNote: status >= 400 ? (json?.message ?? body.slice(0, 150)) : (json?.error ?? json?.note ?? null),
    bodyBytes: body.length,
    sample: json ? extractSample(json) : null,
  };
}

function extractSample(json) {
  // Return a tiny preview of typical fields
  const pick = (arr, n = 1) => Array.isArray(arr) ? arr.slice(0, n) : [];
  if (Array.isArray(json.results)) return { kind: 'search', first: (json.results[0]?.title ?? '').slice(0, 80), count: json.results.length };
  if (Array.isArray(json.posts)) return { kind: 'reddit', first: (json.posts[0]?.title ?? '').slice(0, 80), count: json.posts.length, totalComments: json.totalComments };
  if (Array.isArray(json.subreddits)) return { kind: 'reddit-discover', first: json.subreddits[0]?.name, count: json.subreddits.length };
  if (Array.isArray(json.videos)) return { kind: 'video', first: (json.videos[0]?.title ?? json.videos[0]?.caption ?? '').slice(0, 80), count: json.videos.length, totalComments: json.totalComments };
  if (Array.isArray(json.comments)) return { kind: 'comments', first: (json.comments[0]?.text ?? '').slice(0, 80), count: json.comments.length };
  if (Array.isArray(json.reviews)) return { kind: 'reviews', first: (json.reviews[0]?.text ?? '').slice(0, 80), count: json.reviews.length };
  if (Array.isArray(json.products)) return { kind: 'products', first: json.products[0]?.title, count: json.products.length };
  if (json.product) return { kind: 'product-single', title: json.product.title, reviews: Array.isArray(json.reviews) ? json.reviews.length : 0 };
  if (Array.isArray(json.ads)) return { kind: 'ads', first: json.ads[0]?.headline ?? json.ads[0]?.advertiser, count: json.ads.length };
  if (typeof json.markdown === 'string') return { kind: 'markdown', len: json.markdown.length };
  if (typeof json.isShopify === 'boolean') return { kind: 'shopify-detect', isShopify: json.isShopify };
  return { kind: 'unknown-shape', keys: Object.keys(json).slice(0, 8) };
}

// --- Runs ---
const results = [];

// 1. Tavily search (general)
results.push(await time(
  'tavily:search',
  { query: `${NICHE_ES} reviews opiniones`, maxResults: 10, searchDepth: 'advanced' },
  '/api/search',
  j => (j.results?.length ?? 0),
));

// 2. Firecrawl scrape — hit a known-reachable page
results.push(await time(
  'firecrawl:scrape',
  { url: 'https://www.akc.org/expert-advice/health/probiotics-for-dogs/' },
  '/api/scrape',
  j => (typeof j.markdown === 'string' ? (j.markdown.length > 200 ? 1 : 0) : 0),
));

// 3. Reddit discover
results.push(await time(
  'reddit:discover',
  { mode: 'discover', query: NICHE_EN, limit: 10 },
  '/api/reddit',
  j => (j.subreddits?.length ?? 0),
));

// 4. Reddit subreddit mode (uses subreddit + queries)
results.push(await time(
  'reddit:subreddit',
  { mode: 'subreddit', subreddit: 'dogs', queries: [NICHE_EN], limit: 8, deep_comments: true },
  '/api/reddit',
  j => (j.posts?.length ?? 0),
));

// 5. Reddit global search
results.push(await time(
  'reddit:search',
  { mode: 'search', query: NICHE_EN, limit: 20, fetch_comments: true, max_threads: 5 },
  '/api/reddit',
  j => (j.posts?.length ?? 0),
));

// 6. YouTube search
results.push(await time(
  'youtube:search',
  { mode: 'search', query: NICHE_ES, maxResults: 5, language: 'es-ES' },
  '/api/youtube',
  j => (j.videos?.length ?? 0),
));

// 7. TikTok search
results.push(await time(
  'tiktok:search',
  { mode: 'search', queries: [NICHE_ES, 'perro mayor salud'], maxVideos: 8, maxComments: 20, language: 'es-ES' },
  '/api/tiktok',
  j => (j.videos?.length ?? 0),
));

// 8. Amazon search
results.push(await time(
  'amazon:search',
  { mode: 'search', query: NICHE_ES, marketplace: 'amazon.es', maxProducts: 5 },
  '/api/amazon-reviews',
  j => (j.products?.length ?? 0),
));

// 9. Shopify detect
results.push(await time(
  'shopify:detect',
  { mode: 'detect', url: KNOWN_SHOPIFY_STORE },
  '/api/shopify',
  j => (j.isShopify === true ? 1 : 0),
));

// 10. Shopify product (might 404 if URL wrong)
results.push(await time(
  'shopify:product',
  { mode: 'product', url: KNOWN_SHOPIFY_STORE },
  '/api/shopify',
  j => (j.product ? 1 : 0),
));

// 11. Meta Ads Library (via Tavily)
results.push(await time(
  'meta-ads',
  { query: NICHE_EN, niche: 'pet supplements', country: 'US', limit: 5 },
  '/api/meta-ads',
  j => (j.ads?.length ?? 0),
));

// 12. BrandSearch
results.push(await time(
  'brandsearch',
  { query: NICHE_EN },
  '/api/brandsearch',
  j => (Array.isArray(j.results) ? j.results.length : (Array.isArray(j.brands) ? j.brands.length : 0)),
));

console.log('\n=== SCRAPING AUDIT RESULTS ===\n');
for (const r of results) {
  const tag = r.status >= 200 && r.status < 300 ? '✓' : r.status === 0 ? '⚠' : '✗';
  console.log(`${tag} ${r.label.padEnd(20)} ${String(r.status).padStart(3)} · ${String(r.latencyMs).padStart(6)}ms · items=${String(r.items).padStart(3)} · ${r.sample ? JSON.stringify(r.sample).slice(0, 120) : ''}`);
  if (r.errorOrNote) console.log(`    note: ${String(r.errorOrNote).slice(0, 180)}`);
}

console.log('\n=== JSON DUMP ===\n');
console.log(JSON.stringify(results, null, 2));
