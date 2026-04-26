// ============================================================
// PAWEN — Hydrate excavation_fetch_cache from recovered BD snapshots
//
// Usage: node scripts/hydrate-cache-from-snapshots.mjs <jobId>
//
// Takes a job's input hash, picks the most recent BD snapshots per
// source (assumed to be from that job's run since BD keeps them
// chronological), maps raw BD rows → RawSourceItem shape, and
// inserts the bundle into excavation_fetch_cache so the next run
// (or test-pipeline-from-cache.mjs) gets a clean cache hit.
//
// Mapping is deliberately minimal: we just stuff each row's text
// payload into RawSourceItem.content. The analyzer LLMs care about
// content and comments[] — that's it.
// ============================================================

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);

const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: node scripts/hydrate-cache-from-snapshots.mjs <jobId>');
  process.exit(1);
}

const sql = neon(env.DATABASE_URL);

const job = (await sql`SELECT id, payload FROM pipeline_jobs WHERE id = ${jobId} LIMIT 1`)[0];
if (!job) { console.error(`Job ${jobId} not found`); process.exit(1); }

const core = job.payload.core;
console.log(`→ hydrating cache for "${core?.product?.slice(0, 60)}..."`);

function stableHash(inputs) {
  const stable = JSON.stringify({
    product: inputs.core?.product?.trim().toLowerCase() ?? '',
    niche: inputs.core?.niche?.trim().toLowerCase() ?? '',
    surface_desire: inputs.core?.surface_desire?.trim().toLowerCase() ?? '',
    language: inputs.core?.language ?? '',
    market: inputs.core?.market ?? '',
    config: inputs.config ?? null,
    redditDepth: inputs.redditDepth ?? '',
  });
  return crypto.createHash('sha256').update(stable).digest('hex');
}

const cacheKey = stableHash({ core, config: job.payload.config, redditDepth: job.payload.redditDepth });
console.log(`→ cache key: ${cacheKey.slice(0, 16)}...`);

// Pull latest snapshots per source from the recovered BD cache.
async function latestRows(label, limit = 5) {
  const rows = await sql`
    SELECT data, record_count, recovered_at
    FROM bd_snapshot_cache
    WHERE label = ${label}
    ORDER BY bd_created_at DESC NULLS LAST, recovered_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

// === Reddit posts ===
function mapRedditPosts(snapshotRows) {
  const out = [];
  for (const s of snapshotRows) {
    for (const r of (s.data ?? [])) {
      if (!r.url) continue;
      out.push({
        url: r.url,
        title: r.title ?? '',
        content: [r.title, r.description].filter(Boolean).join('\n\n').slice(0, 8000),
        comments: [],
        source: 'reddit',
        metadata: { post_id: r.post_id, num_upvotes: r.num_upvotes, community: r.community_name },
      });
    }
  }
  return out;
}

// === Reddit comments → fold into matching posts as comment strings ===
function foldRedditComments(redditPosts, snapshotRows) {
  const byPostUrl = new Map();
  for (const s of snapshotRows) {
    for (const c of (s.data ?? [])) {
      const key = c.post_url ?? '';
      if (!key || !c.comment) continue;
      const arr = byPostUrl.get(key) ?? [];
      arr.push(c.comment.slice(0, 1500));
      byPostUrl.set(key, arr);
    }
  }
  for (const p of redditPosts) {
    p.comments = (byPostUrl.get(p.url) ?? []).slice(0, 50);
  }
}

// === TikTok posts (caption only, since BD comments hydration is per-video URL) ===
function mapTikTokPosts(snapshotRows) {
  const out = [];
  for (const s of snapshotRows) {
    for (const r of (s.data ?? [])) {
      if (!r.url) continue;
      out.push({
        url: r.url,
        title: (r.description ?? '').slice(0, 120),
        content: r.description ?? '',
        comments: [],
        source: 'tiktok',
        metadata: { likes: r.digg_count, plays: r.play_count, author: r.profile_username },
      });
    }
  }
  return out;
}

function foldTikTokComments(tiktokPosts, snapshotRows) {
  const byPostUrl = new Map();
  for (const s of snapshotRows) {
    for (const c of (s.data ?? [])) {
      const key = c.post_url ?? '';
      if (!key || !c.comment_text) continue;
      const arr = byPostUrl.get(key) ?? [];
      arr.push(c.comment_text.slice(0, 1500));
      byPostUrl.set(key, arr);
    }
  }
  for (const p of tiktokPosts) {
    p.comments = (byPostUrl.get(p.url) ?? []).slice(0, 30);
  }
}

// === YouTube videos ===
function mapYouTubeVideos(snapshotRows) {
  const out = [];
  for (const s of snapshotRows) {
    for (const r of (s.data ?? [])) {
      if (!r.url) continue;
      out.push({
        url: r.url,
        title: r.title ?? '',
        content: [r.title, r.description, r.transcript].filter(Boolean).join('\n\n').slice(0, 8000),
        comments: [],
        source: 'youtube',
        metadata: { views: r.views, likes: r.likes, channel: r.youtuber },
      });
    }
  }
  return out;
}

function foldYouTubeComments(videos, snapshotRows) {
  const byVideoUrl = new Map();
  for (const s of snapshotRows) {
    for (const c of (s.data ?? [])) {
      // YT comments BD schema uses different fields — best-effort
      const key = c.video_url ?? c.url ?? c.post_url ?? '';
      const text = c.comment_text ?? c.comment ?? c.text ?? '';
      if (!key || !text) continue;
      const arr = byVideoUrl.get(key) ?? [];
      arr.push(text.slice(0, 1500));
      byVideoUrl.set(key, arr);
    }
  }
  for (const v of videos) {
    v.comments = (byVideoUrl.get(v.url) ?? []).slice(0, 80);
  }
}

// === Amazon products + reviews folded ===
function mapAmazon(searchRows, reviewRows) {
  const out = [];
  const reviewsByUrl = new Map();
  for (const s of reviewRows) {
    for (const r of (s.data ?? [])) {
      const key = r.url ?? '';
      if (!key || !r.review_text) continue;
      const arr = reviewsByUrl.get(key) ?? [];
      arr.push(`${r.review_header ? `[${r.review_header}] ` : ''}${r.review_text}`.slice(0, 1500));
      reviewsByUrl.set(key, arr);
    }
  }
  const seen = new Set();
  for (const s of searchRows) {
    for (const r of (s.data ?? [])) {
      if (!r.url || !r.asin || seen.has(r.url)) continue;
      seen.add(r.url);
      out.push({
        url: r.url,
        title: r.name ?? '',
        content: [r.name, `Rating: ${r.rating ?? '?'}/5 (${r.num_ratings ?? 0} reviews)`].filter(Boolean).join('\n'),
        comments: (reviewsByUrl.get(r.url) ?? []).slice(0, 50),
        source: 'amazon',
        metadata: { asin: r.asin, rating: r.rating, brand: r.brand },
      });
    }
  }
  return out;
}

console.log('→ pulling snapshots from bd_snapshot_cache');
const [redditPostsSnaps, redditCommentsSnaps, ttPostsSnaps, ttCommentsSnaps, ytVideosSnaps, ytCommentsSnaps, amazonSearchSnaps, amazonReviewsSnaps] = await Promise.all([
  latestRows('reddit_posts', 8),
  latestRows('reddit_comments', 8),
  latestRows('tiktok_posts', 8),
  latestRows('tiktok_comments', 8),
  latestRows('youtube_videos', 8),
  latestRows('youtube_comments', 8),
  latestRows('amazon_search', 4),
  latestRows('amazon_reviews', 8),
]);

const redditItems = mapRedditPosts(redditPostsSnaps);
foldRedditComments(redditItems, redditCommentsSnaps);

const tiktokItems = mapTikTokPosts(ttPostsSnaps);
foldTikTokComments(tiktokItems, ttCommentsSnaps);

const youtubeItems = mapYouTubeVideos(ytVideosSnaps);
foldYouTubeComments(youtubeItems, ytCommentsSnaps);

const amazonItems = mapAmazon(amazonSearchSnaps, amazonReviewsSnaps);

const fetchData = {};
function bucket(source, items) {
  if (items.length === 0) return;
  fetchData[source] = {
    source,
    queries: ['hydrated-from-snapshots'],
    items,
    itemCount: items.length,
    fetchDurationMs: 0,
  };
}
bucket('reddit', redditItems);
bucket('tiktok', tiktokItems);
bucket('youtube', youtubeItems);
bucket('amazon', amazonItems);

const totalItems = redditItems.length + tiktokItems.length + youtubeItems.length + amazonItems.length;
console.log(`\n→ assembled fetch bundle:`);
console.log(`  reddit:  ${redditItems.length} posts (${redditItems.reduce((s,p)=>s+p.comments.length,0)} comments folded)`);
console.log(`  tiktok:  ${tiktokItems.length} posts (${tiktokItems.reduce((s,p)=>s+p.comments.length,0)} comments folded)`);
console.log(`  youtube: ${youtubeItems.length} videos (${youtubeItems.reduce((s,p)=>s+p.comments.length,0)} comments folded)`);
console.log(`  amazon:  ${amazonItems.length} products (${amazonItems.reduce((s,p)=>s+p.comments.length,0)} reviews folded)`);
console.log(`  TOTAL:   ${totalItems} items`);

if (totalItems === 0) {
  console.error('❌ No items to insert. bd_snapshot_cache empty for these labels.');
  process.exit(1);
}

const inputsSummary = `${core.product?.slice(0,80)} | ${core.niche?.slice(0,80)} | ${core.language ?? ''}`;
const expiresAt = new Date(Date.now() + 6 * 3600 * 1000).toISOString();

await sql`
  INSERT INTO excavation_fetch_cache (cache_key, data, inputs_summary, expires_at)
  VALUES (${cacheKey}, ${JSON.stringify(fetchData)}::jsonb, ${inputsSummary}, ${expiresAt})
  ON CONFLICT (cache_key) DO UPDATE SET
    data = EXCLUDED.data,
    inputs_summary = EXCLUDED.inputs_summary,
    cached_at = NOW(),
    expires_at = EXCLUDED.expires_at,
    hit_count = 0
`;

console.log(`\n✓ excavation_fetch_cache populated (key=${cacheKey.slice(0, 16)}..., ${totalItems} items, expires ${expiresAt})`);
console.log(`\nNext step:`);
console.log(`  node scripts/test-pipeline-from-cache.mjs ${jobId}`);
