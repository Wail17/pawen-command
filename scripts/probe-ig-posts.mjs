const token = (process.env.APIFY_TOKEN ?? '').trim();
const input = {
  search: 'insomnia',
  searchType: 'hashtag',
  searchLimit: 1,
  resultsType: 'posts',
  resultsLimit: 30,
};

const res = await fetch(
  `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180&memory=1024`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  },
);
const items = await res.json();
console.log('top-level item count:', items.length);

const hashtagObj = items[0];
console.log('\nhashtag name:', hashtagObj.name);
console.log('postsCount:', hashtagObj.postsCount);
console.log('nested posts field type:', Array.isArray(hashtagObj.posts) ? `array of ${hashtagObj.posts.length}` : typeof hashtagObj.posts);

if (Array.isArray(hashtagObj.posts) && hashtagObj.posts.length > 0) {
  console.log('\nsample post keys:', Object.keys(hashtagObj.posts[0]).join(', '));
  console.log('sample post.caption:', (hashtagObj.posts[0].caption ?? '').slice(0, 200));
  console.log('sample latestComments:', hashtagObj.posts[0].latestComments?.length ?? 0);
  console.log('\nall captions:');
  hashtagObj.posts.slice(0, 5).forEach((p, i) =>
    console.log(`  [${i + 1}] ${(p.caption ?? '').slice(0, 120).replace(/\s+/g, ' ')}`),
  );
}

// Also check `topPosts` and other aggregated fields
for (const k of Object.keys(hashtagObj)) {
  if (Array.isArray(hashtagObj[k])) {
    console.log(`\nfield "${k}": array of ${hashtagObj[k].length}`);
  }
}
