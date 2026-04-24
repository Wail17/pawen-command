// Smoke-test all Apify scrapers with minimum items to preserve CU budget.
// Expects APIFY_TOKEN in env.

const token = process.env.APIFY_TOKEN?.trim();
if (!token) { console.error('APIFY_TOKEN missing'); process.exit(1); }

async function call(actor, input, label, memMb = 512) {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=120&memory=${memMb}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(150_000),
    });
    const txt = await res.text();
    const secs = Math.round((Date.now() - t0) / 1000);
    if (!res.ok) {
      console.log(`[${label}] FAIL HTTP ${res.status} (${secs}s): ${txt.slice(0, 200)}`);
      return;
    }
    const data = JSON.parse(txt);
    const count = Array.isArray(data) ? data.length : 0;
    console.log(`[${label}] OK ${count} items (${secs}s) sample keys: ${Array.isArray(data) && data[0] ? Object.keys(data[0]).slice(0, 6).join(', ') : 'none'}`);
  } catch (e) {
    console.log(`[${label}] ERR ${e.message}`);
  }
}

console.log('Testing 4 Apify scrapers with minimum payloads...\n');

await call('clockworks~free-tiktok-scraper', {
  hashtags: ['skincare'],
  resultsPerPage: 3,
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  proxyConfiguration: { useApifyProxy: true },
}, 'TikTok', 1024);

await call('apify~facebook-posts-scraper', {
  startUrls: [{ url: 'https://www.facebook.com/nike/' }],
  resultsLimit: 2,
  maxComments: 3,
}, 'Facebook posts', 1024);

await call('apify~instagram-scraper', {
  directUrls: ['https://www.instagram.com/nike/'],
  resultsType: 'posts',
  resultsLimit: 2,
  addParentData: false,
}, 'Instagram', 1024);

await call('apify~facebook-ads-scraper', {
  startUrls: [{ url: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=nike&search_type=keyword_unordered' }],
  count: 2,
}, 'FB Ad Library', 1024);

console.log('\nDone.');
