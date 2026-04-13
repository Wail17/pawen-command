const token = (process.env.APIFY_TOKEN ?? '').trim();

async function run(actor, input, label) {
  console.log(`\n=== ${label} (${actor}) ===`);
  console.log('input:', JSON.stringify(input));
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180&memory=1024`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(220_000) },
    );
  } catch (e) {
    console.log(`  THREW (${Date.now() - t0}ms):`, e.message);
    return;
  }
  const ms = Date.now() - t0;
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.log(`  FAIL ${res.status} (${ms}ms):`, t.slice(0, 300));
    return;
  }
  const items = await res.json();
  console.log(`  count=${items.length} (${ms}ms)`);
  if (items.length > 0) {
    console.log('  first keys:', Object.keys(items[0]).slice(0, 15).join(', '));
    if (items[0].caption) console.log('  first caption:', String(items[0].caption).slice(0, 150));
    // show more samples
    for (let i = 0; i < Math.min(5, items.length); i++) {
      const p = items[i];
      const cap = (p.caption ?? p.text ?? '').slice(0, 100).replace(/\s+/g, ' ');
      const comments = Array.isArray(p.latestComments) ? p.latestComments.length : 0;
      console.log(`  [${i + 1}] ${cap} | ${comments} comments`);
    }
    if (items.length === 1 && (items[0].error || items[0].errorDescription)) {
      console.log('  error body:', JSON.stringify(items[0]).slice(0, 400));
    }
  }
}

// Try 3 different hashtag scrapers to find one that works
await run('easyapi~instagram-hashtag-scraper', { hashtags: ['insomnia'], resultsLimit: 25 }, 'easyapi');
await run('scrapesmith~instagram-hashtag-scraper', { hashtags: ['insomnia'], resultsLimit: 25 }, 'scrapesmith');
await run('burbn~instagram-hashtag-posts-scraper', { hashtags: ['insomnia'], resultsLimit: 25 }, 'burbn');

// Also try the base apify/instagram-scraper with different input
await run(
  'apify~instagram-scraper',
  { directUrls: ['https://www.instagram.com/explore/tags/insomnia/'], resultsType: 'posts', resultsLimit: 25, addParentData: false, proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] } },
  'apify base with RESIDENTIAL proxy',
);

