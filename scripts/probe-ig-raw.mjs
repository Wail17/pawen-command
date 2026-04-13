const token = (process.env.APIFY_TOKEN ?? '').trim();
if (!token) { console.error('APIFY_TOKEN missing'); process.exit(1); }

// Try THREE different input shapes in sequence
const variants = [
  {
    name: 'A: hashtags array',
    input: {
      hashtags: ['insomnia'],
      resultsType: 'posts',
      resultsLimit: 25,
    },
  },
  {
    name: 'B: search+searchType',
    input: {
      search: 'insomnia',
      searchType: 'hashtag',
      searchLimit: 1,
      resultsType: 'posts',
      resultsLimit: 25,
    },
  },
  {
    name: 'C: directUrls hashtag explore',
    input: {
      directUrls: ['https://www.instagram.com/explore/tags/insomnia/'],
      resultsType: 'posts',
      resultsLimit: 25,
    },
  },
];

for (const { name, input } of variants) {
  console.log(`\n=== ${name} ===`);
  console.log('input:', JSON.stringify(input));
  const t0 = Date.now();
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180&format=json&memory=1024`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(200_000),
    },
  );
  const ms = Date.now() - t0;
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.log(`  ${res.status} (${ms}ms):`, t.slice(0, 500));
    continue;
  }
  const items = await res.json();
  console.log(`  count=${Array.isArray(items) ? items.length : 'NOT ARRAY'} (${ms}ms)`);
  if (Array.isArray(items) && items.length > 0) {
    const first = items[0];
    console.log('  first item keys:', Object.keys(first).join(', '));
    console.log('  first.type:', first.type);
    console.log('  first.caption:', (first.caption ?? '').slice(0, 100));
    console.log('  first.latestComments length:', Array.isArray(first.latestComments) ? first.latestComments.length : 'none');
    console.log('  first.topPosts length:', Array.isArray(first.topPosts) ? first.topPosts.length : 'none');
  }
}
