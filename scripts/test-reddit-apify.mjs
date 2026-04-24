// Sanity test: hit Apify Reddit scraper directly with the same input shape
// as /api/reddit uses in apifyFallback(). Confirms quality (posts + comments)
// before we trust the prod path.

const token = process.env.APIFY_TOKEN?.trim();
if (!token) {
  console.error('APIFY_TOKEN missing');
  process.exit(1);
}

const queries = ['menopause weight gain', 'perimenopause symptoms'];
const limit = 5;
const maxComments = 50;
const maxItems = 1 + limit + limit * maxComments;

const input = {
  searches: queries,
  skipComments: false,
  maxItems,
  maxPostCount: limit,
  maxComments,
  maxCommunitiesAndUsers: 1,
  type: 'posts',
  sort: 'relevance',
  time: 'year',
  includeNSFW: false,
  proxy: { useApifyProxy: true },
  startUrls: queries.map(q => ({
    url: `https://www.reddit.com/search/?q=${encodeURIComponent(q)}&sort=relevance&t=year`,
  })),
};

console.log('Calling Apify with maxComments=%d, maxItems=%d...', maxComments, maxItems);
const started = Date.now();

const res = await fetch(
  `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(200_000),
  },
);

console.log('HTTP %d (%ds)', res.status, Math.round((Date.now() - started) / 1000));
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}

const items = await res.json();
const posts = items.filter(it => it.dataType === 'post');
const comments = items.filter(it => it.dataType === 'comment');

console.log('\n=== RESULTS ===');
console.log('Total items:', items.length);
console.log('Posts:', posts.length);
console.log('Comments:', comments.length);
console.log('Avg comments/post:', (comments.length / Math.max(posts.length, 1)).toFixed(1));

if (posts.length > 0) {
  const sample = posts[0];
  console.log('\n=== SAMPLE POST ===');
  console.log('Title:', sample.title);
  console.log('Subreddit:', sample.communityName);
  console.log('Upvotes:', sample.upVotes, '| Comments total:', sample.numberOfComments);
  console.log('Body len:', (sample.body ?? '').length);
  const myComments = comments.filter(c => c.postId === sample.id);
  console.log('Extracted comments for this post:', myComments.length);
  if (myComments.length > 0) {
    console.log('Sample comment:', myComments[0].body?.slice(0, 200));
  }
}
