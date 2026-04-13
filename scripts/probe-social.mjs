// ============================================================
// Probe all 4 social scrapers end-to-end against Apify prod.
// Loops a single scenario (niche=insomnia) across reddit/tiktok/
// instagram/facebook, prints counts + sample verbatims.
// Usage: npx -y dotenv-cli -e .env.local -- node scripts/probe-social.mjs
// ============================================================

const token = (process.env.APIFY_TOKEN ?? '').trim();
if (!token) {
  console.error('APIFY_TOKEN missing from env');
  process.exit(1);
}

const SYNC = (actor, memoryMb) => {
  const memParam = memoryMb ? `&memory=${memoryMb}` : '';
  return `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=240&format=json${memParam}`;
};

async function call(actor, input, label, memoryMb) {
  const start = Date.now();
  try {
    const res = await fetch(SYNC(actor, memoryMb), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(260_000),
    });
    const ms = Date.now() - start;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { label, ok: false, ms, status: res.status, error: text.slice(0, 300) };
    }
    const items = await res.json();
    if (!Array.isArray(items)) return { label, ok: false, ms, error: 'non-array' };
    return { label, ok: true, ms, items };
  } catch (e) {
    return { label, ok: false, ms: Date.now() - start, error: e.message };
  }
}

function summarize(label, items, extract) {
  if (!items || items.length === 0) {
    console.log(`  ${label}: 0 items`);
    return { count: 0, verbatims: 0 };
  }
  const verbatims = items.flatMap(extract).filter(Boolean);
  console.log(`  ${label}: ${items.length} items, ${verbatims.length} verbatims`);
  verbatims.slice(0, 3).forEach((v, i) =>
    console.log(`    [${i + 1}] ${String(v).slice(0, 120).replace(/\s+/g, ' ')}`),
  );
  return { count: items.length, verbatims: verbatims.length };
}

// ==============================
// REDDIT — trudax/reddit-scraper-lite
// ==============================
async function probeReddit() {
  console.log('\n=== REDDIT ===');
  const input = {
    startUrls: [{ url: 'https://www.reddit.com/r/insomnia/' }],
    searches: ["can't sleep"],
    skipComments: false,
    maxItems: 1 + 10 + 10 * 12,
    maxPostCount: 10,
    maxComments: 12,
    maxCommunitiesAndUsers: 1,
    type: 'posts',
    sort: 'relevance',
    time: 'year',
    includeNSFW: false,
    proxy: { useApifyProxy: true },
    debugMode: false,
  };
  const r = await call('trudax~reddit-scraper-lite', input, 'reddit');
  if (!r.ok) {
    console.log(`  FAILED (${r.ms}ms):`, r.status ?? '', r.error);
    return { source: 'reddit', ok: false, error: r.error };
  }
  const posts = r.items.filter((x) => x.dataType === 'post');
  const comments = r.items.filter((x) => x.dataType === 'comment');
  console.log(`  Posts: ${posts.length}, Comments: ${comments.length}, ${r.ms}ms`);
  summarize('post titles', posts, (p) => [p.title]);
  summarize('comment bodies', comments, (c) => [c.body]);
  return { source: 'reddit', ok: posts.length > 0, posts: posts.length, comments: comments.length };
}

// ==============================
// TIKTOK — clockworks/free-tiktok-scraper
// ==============================
async function probeTikTok() {
  console.log('\n=== TIKTOK ===');
  const input = {
    searchQueries: ["can't sleep insomnia"],
    searchSection: '',
    resultsPerPage: 15,
    maxProfilesPerQuery: 10,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
    profileScrapeSections: ['videos'],
    excludePinnedPosts: false,
    commentsPerPost: 30,
    shouldScrapeComments: true,
  };
  const r = await call('clockworks~free-tiktok-scraper', input, 'tiktok', 1024);
  if (!r.ok) {
    console.log(`  FAILED (${r.ms}ms):`, r.status ?? '', r.error);
    return { source: 'tiktok', ok: false, error: r.error };
  }

  // Fetch the linked comment datasets for each video
  const videosWithComments = [];
  for (const v of r.items) {
    let comments = [];
    if (v.commentsDatasetUrl) {
      try {
        const sep = v.commentsDatasetUrl.includes('?') ? '&' : '?';
        const cUrl = `${v.commentsDatasetUrl}${sep}token=${encodeURIComponent(token)}&limit=30&clean=true`;
        const cr = await fetch(cUrl, { signal: AbortSignal.timeout(20_000) });
        if (cr.ok) {
          const cItems = await cr.json();
          if (Array.isArray(cItems)) comments = cItems.map((c) => c.text).filter((t) => typeof t === 'string' && t.length > 5);
        }
      } catch {}
    }
    videosWithComments.push({ ...v, _comments: comments });
  }

  console.log(`  Videos: ${r.items.length}, ${r.ms}ms`);
  const totalComments = videosWithComments.reduce((s, v) => s + v._comments.length, 0);
  console.log(`  Total comments fetched: ${totalComments}`);
  const s = summarize(
    'captions+comments',
    videosWithComments,
    (v) => [v.text, ...v._comments],
  );
  return {
    source: 'tiktok',
    ok: r.items.length > 0 && totalComments > 0,
    videos: r.items.length,
    totalComments,
    verbatims: s.verbatims,
  };
}

// ==============================
// INSTAGRAM — apify/instagram-scraper
// ==============================
async function probeInstagram() {
  console.log('\n=== INSTAGRAM ===');
  const input = {
    hashtags: ['insomnia'],
    resultsLimit: 25,
  };
  const r = await call('scrapesmith~instagram-hashtag-scraper', input, 'instagram', 1024);
  if (!r.ok) {
    console.log(`  FAILED (${r.ms}ms):`, r.status ?? '', r.error);
    return { source: 'instagram', ok: false, error: r.error };
  }
  // scrapesmith sometimes returns a single {error} item; filter those out
  const valid = r.items.filter((p) => p.caption && !p.error);
  console.log(`  Posts: ${valid.length}/${r.items.length} valid, ${r.ms}ms`);
  const s = summarize('captions', valid, (p) => [p.caption]);
  return {
    source: 'instagram',
    ok: valid.length >= 5,
    posts: valid.length,
    verbatims: s.verbatims,
  };
}

// ==============================
// FACEBOOK — apify/facebook-posts-scraper
// ==============================
async function probeFacebook() {
  console.log('\n=== FACEBOOK ===');
  // Known public pages/groups on insomnia/sleep
  const startUrls = [
    { url: 'https://www.facebook.com/SleepFoundation/' },
    { url: 'https://www.facebook.com/betterhealthchannel/' },
  ];
  const input = {
    startUrls,
    resultsLimit: 25,
    maxComments: 20,
    resultsType: 'posts',
  };
  const r = await call('apify~facebook-posts-scraper', input, 'facebook', 1024);
  if (!r.ok) {
    console.log(`  FAILED (${r.ms}ms):`, r.status ?? '', r.error);
    return { source: 'facebook', ok: false, error: r.error };
  }
  console.log(`  Posts: ${r.items.length}, ${r.ms}ms`);
  const s = summarize(
    'text+comments',
    r.items,
    (p) => {
      const comments = Array.isArray(p.comments)
        ? p.comments.map((c) => c.text)
        : Array.isArray(p.topComments)
        ? p.topComments.map((c) => c.text)
        : [];
      return [p.text, ...comments];
    },
  );
  return {
    source: 'facebook',
    ok: r.items.length > 0,
    posts: r.items.length,
    verbatims: s.verbatims,
  };
}

const target = process.argv[2]; // optional single source
const all = { reddit: probeReddit, tiktok: probeTikTok, instagram: probeInstagram, facebook: probeFacebook };
const tasks = target ? [[target, all[target]]] : Object.entries(all);

// Sequential: Apify free tier is 8GB total memory, parallel runs collide.
const results = [];
for (const [name, fn] of tasks) {
  const r = await fn();
  results.push(r);
}

console.log('\n=== SUMMARY ===');
console.table(results);
const bad = results.filter((r) => !r.ok);
if (bad.length > 0) {
  console.log(`\n${bad.length}/${results.length} sources FAILED:`, bad.map((b) => b.source).join(', '));
  process.exit(1);
}
console.log(`\nAll ${results.length} sources OK.`);
