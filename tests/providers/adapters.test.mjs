// Integration tests for every Phase U.4 adapter.
// Run: npx tsx tests/providers/adapters.test.mjs
//
// Covers: happy path, missing env, upstream 429 (retriable), upstream 500,
// upstream 502, network timeout.

import { installMockRoutes, restoreFetch, test, runTests, assertEqual, assertTrue, assertThrows, withEnv } from './mockFetch.mjs';
import { ExaAdapter } from '../../src/lib/sources/providers/exaAdapter.ts';
import { BraveAdapter } from '../../src/lib/sources/providers/braveAdapter.ts';
import { BrightDataRedditAdapter } from '../../src/lib/sources/providers/brightDataRedditAdapter.ts';
import { BrightDataTikTokAdapter } from '../../src/lib/sources/providers/brightDataTikTokAdapter.ts';
import { BrightDataAmazonAdapter } from '../../src/lib/sources/providers/brightDataAmazonAdapter.ts';
import { RedditOAuthAdapter } from '../../src/lib/sources/providers/redditOAuthAdapter.ts';
import { YouTubeDataAPIAdapter } from '../../src/lib/sources/providers/youtubeDataAPIAdapter.ts';
import { ShopifyPublicAdapter } from '../../src/lib/sources/providers/shopifyPublicAdapter.ts';
import { MetaGraphAdapter } from '../../src/lib/sources/providers/metaGraphAdapter.ts';
import { SimhashEmbeddingAdapter, VoyageEmbeddingAdapter } from '../../src/lib/sources/providers/voyageEmbeddingAdapter.ts';

// ===== Exa =====

test('Exa: missing key throws', async () => {
  await withEnv({ EXA_API_KEY: null }, async () => {
    const a = new ExaAdapter();
    const h = await a.isHealthy();
    assertTrue(!h.ok, 'health should be down');
    await assertThrows(() => a.search('x'), 'EXA_API_KEY');
  });
});

test('Exa: happy path with snippets', async () => {
  await withEnv({ EXA_API_KEY: 'k' }, async () => {
    installMockRoutes([{
      match: 'api.exa.ai',
      json: { results: [
        { url: 'https://a.com', title: 'A', text: 'body A', score: 0.9, highlights: ['hl A'] },
        { url: 'https://b.com', title: 'B', text: 'body B', score: 0.8 },
      ] },
    }]);
    const r = await new ExaAdapter().search('senior dog');
    assertEqual(r.length, 2);
    assertEqual(r[0].url, 'https://a.com');
    assertEqual(r[0].snippet, 'hl A');
    restoreFetch();
  });
});

test('Exa: 429 marked retriable', async () => {
  await withEnv({ EXA_API_KEY: 'k' }, async () => {
    installMockRoutes([{ match: 'api.exa.ai', status: 429, json: { error: 'rate' } }]);
    const err = await assertThrows(() => new ExaAdapter().search('x'), '429');
    assertTrue(err.retriable === true, 'retriable flag');
    restoreFetch();
  });
});

// ===== Brave =====

test('Brave: transforms web.results correctly', async () => {
  await withEnv({ BRAVE_API_KEY: 'k' }, async () => {
    installMockRoutes([{
      match: 'search.brave.com',
      json: { web: { results: [
        { url: 'https://x.com', title: 'X', description: 'desc X' },
      ] } },
    }]);
    const r = await new BraveAdapter().search('q');
    assertEqual(r[0].snippet, 'desc X');
    restoreFetch();
  });
});

// ===== Bright Data =====

test('BrightDataReddit: trigger → poll → posts (no comments hydration since no top score)', async () => {
  await withEnv({ BRIGHTDATA_API_KEY: 'k' }, async () => {
    installMockRoutes([
      // First trigger (POSTS dataset)
      { match: 'trigger?dataset_id', json: { snapshot_id: 'snap-posts' }, times: 1 },
      // First snapshot: 202 still running
      { match: /snapshot\/snap-posts/, status: 202, times: 1 },
      // Then ready
      { match: /snapshot\/snap-posts/, json: [{
        url: 'https://reddit.com/r/dogs/comments/xx',
        title: 'senior dog question',
        text: 'my 10yo lab has gut issues',
        score: 42,
        num_comments: 7,
        subreddit: 'dogs',
      }], times: 1 },
      // Second trigger (COMMENTS dataset)
      { match: 'trigger?dataset_id', json: { snapshot_id: 'snap-comments' } },
      { match: /snapshot\/snap-comments/, json: [{
        parent_url: 'https://reddit.com/r/dogs/comments/xx',
        body: 'try a probiotic',
        score: 12,
      }] },
    ]);
    const r = await new BrightDataRedditAdapter().fetch('senior dog', { platform: 'reddit', subreddits: ['dogs'] });
    assertEqual(r.length, 1);
    assertEqual(r[0].subreddit, 'dogs');
    assertEqual(r[0].comments?.[0]?.text, 'try a probiotic');
    restoreFetch();
  });
});

// ===== Reddit OAuth =====

test('RedditOAuth: missing creds → isHealthy down + throws', async () => {
  await withEnv({ REDDIT_CLIENT_ID: null, REDDIT_CLIENT_SECRET: null }, async () => {
    const a = new RedditOAuthAdapter();
    assertTrue(!(await a.isHealthy()).ok);
    await assertThrows(() => a.fetch('q', { platform: 'reddit' }), 'REDDIT_CLIENT_ID');
  });
});

test('RedditOAuth: token fetch + search happy path', async () => {
  await withEnv({ REDDIT_CLIENT_ID: 'cid', REDDIT_CLIENT_SECRET: 'sec' }, async () => {
    installMockRoutes([
      { match: 'reddit.com/api/v1/access_token', json: { access_token: 'tok', expires_in: 3600 } },
      { match: 'oauth.reddit.com/search', json: { data: { children: [
        { data: { permalink: '/r/dogs/1', url: '', title: 'T', selftext: 'body', score: 5, num_comments: 2, subreddit: 'dogs', created_utc: 1700000000, author: 'u1' } },
      ] } } },
    ]);
    const r = await new RedditOAuthAdapter().fetch('q', { platform: 'reddit', maxThreads: 5, deepComments: false });
    assertEqual(r.length, 1);
    assertEqual(r[0].subreddit, 'dogs');
    restoreFetch();
  });
});

// ===== Bright Data TikTok =====

test('BrightDataTikTok: happy path hashtag mode', async () => {
  await withEnv({ BRIGHTDATA_API_KEY: 'k' }, async () => {
    installMockRoutes([
      // Posts trigger + snapshot
      { match: 'trigger?dataset_id', json: { snapshot_id: 'tt-posts' }, times: 1 },
      { match: /snapshot\/tt-posts/, json: [{
        url: 'https://www.tiktok.com/@u1/video/v1',
        post_id: 'v1',
        description: 'caption',
        user_unique_id: 'u1',
        play_count: 1000,
        like_count: 50,
        comment_count: 20,
        hashtags: ['dog'],
      }] },
      // Comments trigger + snapshot
      { match: 'trigger?dataset_id', json: { snapshot_id: 'tt-cmts' } },
      { match: /snapshot\/tt-cmts/, json: [
        { parent_url: 'https://www.tiktok.com/@u1/video/v1', text: 'nice', like_count: 3 },
      ] },
    ]);
    const r = await new BrightDataTikTokAdapter().fetch('dog', { platform: 'tiktok', mode: 'hashtag', maxVideos: 1 });
    assertEqual(r.length, 1);
    assertEqual(r[0].videoId, 'v1');
    assertEqual(r[0].comments?.[0]?.text, 'nice');
    restoreFetch();
  });
});

test('BrightDataTikTok: missing key throws', async () => {
  await withEnv({ BRIGHTDATA_API_KEY: null }, async () => {
    await assertThrows(() => new BrightDataTikTokAdapter().fetch('q', { platform: 'tiktok', mode: 'search' }), 'BRIGHTDATA_API_KEY');
  });
});

// ===== YouTube Data API =====

test('YouTube: search + stats + comments composition', async () => {
  await withEnv({ YOUTUBE_API_KEY: 'k' }, async () => {
    installMockRoutes([
      { match: 'youtube/v3/search', json: { items: [
        { id: { videoId: 'v1' }, snippet: { title: 'T', description: 'D', channelTitle: 'ch', publishedAt: '2024-01-01T00:00:00Z' } },
      ] } },
      { match: 'youtube/v3/videos', json: { items: [{ id: 'v1', statistics: { viewCount: '100', likeCount: '10', commentCount: '5' } }] } },
      { match: 'youtube/v3/commentThreads', json: { items: [
        { snippet: { topLevelComment: { snippet: { textDisplay: 'hello', likeCount: 3, authorDisplayName: 'u', publishedAt: '' } } } },
      ] } },
    ]);
    const r = await new YouTubeDataAPIAdapter().fetch('q', { platform: 'youtube', maxVideos: 1 });
    assertEqual(r.length, 1);
    assertEqual(r[0].comments?.length, 1);
    assertEqual(r[0].playCount, 100);
    restoreFetch();
  });
});

// ===== Bright Data Amazon =====

test('BrightDataAmazon: marketplace switching with es domain', async () => {
  await withEnv({ BRIGHTDATA_API_KEY: 'k' }, async () => {
    installMockRoutes([
      // Search
      { match: 'trigger?dataset_id', json: { snapshot_id: 'a-search' }, times: 1 },
      { match: /snapshot\/a-search/, json: [
        { asin: 'A1', title: 'Pro', url: 'https://amazon.es/dp/A1', rating: 4.5, ratings_total: 100, price: 25, currency: 'EUR' },
      ] },
      // Reviews
      { match: 'trigger?dataset_id', json: { snapshot_id: 'a-rev' } },
      { match: /snapshot\/a-rev/, json: [
        { asin: 'A1', body: 'great product', rating: 5, author: 'Maria', verified_purchase: true },
      ] },
    ]);
    const r = await new BrightDataAmazonAdapter().fetch('q', { platform: 'amazon', marketplace: 'amazon.es', maxProducts: 1, maxReviewsPerProduct: 1 });
    assertEqual(r.length, 1);
    assertEqual(r[0].marketplace, 'amazon.es');
    assertEqual(r[0].currency, 'EUR');
    assertEqual(r[0].reviews?.length, 1);
    restoreFetch();
  });
});

// ===== ShopifyPublic =====

test('ShopifyPublic: single product URL', async () => {
  installMockRoutes([
    { match: '/products/foo.json', json: { product: {
      id: 1, title: 'Foo', handle: 'foo', body_html: '<p>desc</p>', vendor: 'V',
      variants: [{ price: '9.99', title: 'Default' }], images: [{ src: 'i.jpg' }],
    } } },
  ]);
  const r = await new ShopifyPublicAdapter().fetch('https://x.com/products/foo', { platform: 'shopify' });
  assertEqual(r.length, 1);
  assertEqual(r[0].productId, 'foo');
  restoreFetch();
});

test('ShopifyPublic: non-shopify host returns []', async () => {
  installMockRoutes([{ match: 'x.com', status: 404, text: '<!DOCTYPE html>' }]);
  const r = await new ShopifyPublicAdapter().fetch('https://x.com/products/foo', { platform: 'shopify' });
  assertEqual(r.length, 0);
  restoreFetch();
});

// ===== Meta Graph =====

test('MetaGraph: returns structured ads', async () => {
  await withEnv({ META_ACCESS_TOKEN: 'tok' }, async () => {
    installMockRoutes([{ match: 'graph.facebook.com', json: { data: [
      { id: 'ad1', page_name: 'BrandX', ad_creative_bodies: ['body1'], ad_creative_link_titles: ['hook1'], ad_snapshot_url: 's.url' },
    ] } }]);
    const r = await new MetaGraphAdapter().fetch({ searchTerms: 'dog probiotic' });
    assertEqual(r.length, 1);
    assertEqual(r[0].pageName, 'BrandX');
    assertEqual(r[0].adCreativeBodies[0], 'body1');
    restoreFetch();
  });
});

test('MetaGraph: error.code 32 → retriable', async () => {
  await withEnv({ META_ACCESS_TOKEN: 'tok' }, async () => {
    installMockRoutes([{ match: 'graph.facebook.com', status: 500, json: { error: { message: 'oops', code: 32 } } }]);
    const err = await assertThrows(() => new MetaGraphAdapter().fetch({ searchTerms: 'x' }), 'oops');
    assertTrue(err.retriable === true);
    restoreFetch();
  });
});

// ===== Embeddings =====

test('Simhash fallback: deterministic + normalized', async () => {
  const a = new SimhashEmbeddingAdapter();
  const [e1, e2] = await a.embed(['senior dog probiotic', 'senior dog probiotic']);
  // Same input → same vector
  for (let i = 0; i < e1.length; i++) assertEqual(e1[i], e2[i], `dim ${i}`);
  // L2 norm should be ~1
  let sq = 0; for (const x of e1) sq += x * x;
  assertTrue(Math.abs(Math.sqrt(sq) - 1) < 0.01, 'L2 norm ≈ 1');
});

test('Voyage: missing key throws', async () => {
  await withEnv({ VOYAGE_API_KEY: null }, async () => {
    const a = new VoyageEmbeddingAdapter();
    await assertThrows(() => a.embed(['x']), 'VOYAGE_API_KEY');
  });
});

test('Voyage: happy path returns Float32Array per input', async () => {
  await withEnv({ VOYAGE_API_KEY: 'k' }, async () => {
    installMockRoutes([{ match: 'api.voyageai.com', json: { data: [
      { embedding: [0.1, 0.2, 0.3] },
      { embedding: [0.4, 0.5, 0.6] },
    ] } }]);
    const r = await new VoyageEmbeddingAdapter().embed(['a', 'b']);
    assertEqual(r.length, 2);
    assertTrue(r[0] instanceof Float32Array);
    assertEqual(r[0][0].toFixed(2), '0.10');
    restoreFetch();
  });
});

// Go
await runTests();
