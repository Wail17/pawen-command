const token = (process.env.APIFY_TOKEN ?? '').trim();

// First: dump the keys of one free-tiktok-scraper video to see
// if comments field exists and what it's named
const input = {
  searchQueries: ["can't sleep"],
  resultsPerPage: 5,
  maxProfilesPerQuery: 5,
  commentsPerPost: 30,
  shouldScrapeComments: true,
  shouldDownloadVideos: false,
  shouldDownloadCovers: false,
  shouldDownloadSubtitles: false,
  shouldDownloadAvatars: false,
};

const t0 = Date.now();
const res = await fetch(
  `https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180&memory=1024`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
);
console.log(`HTTP ${res.status}, ${Date.now() - t0}ms`);
const items = await res.json();
console.log(`items: ${Array.isArray(items) ? items.length : 'not array'}`);
if (Array.isArray(items) && items.length > 0) {
  const first = items[0];
  console.log('\ntext:', first.text?.slice(0, 80));
  console.log('commentsDatasetUrl:', first.commentsDatasetUrl);

  // Fetch the linked comment dataset
  if (first.commentsDatasetUrl) {
    // Append token to authorize
    const url = first.commentsDatasetUrl + (first.commentsDatasetUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
    const cr = await fetch(url);
    console.log('\ncomments HTTP:', cr.status);
    if (cr.ok) {
      const comments = await cr.json();
      console.log('comment count:', Array.isArray(comments) ? comments.length : 'not array');
      if (Array.isArray(comments) && comments.length > 0) {
        console.log('first comment keys:', Object.keys(comments[0]).join(', '));
        comments.slice(0, 5).forEach((c, i) =>
          console.log(`  [${i + 1}] ${String(c.text ?? '').slice(0, 120).replace(/\s+/g, ' ')}`),
        );
      }
    }
  }
}
