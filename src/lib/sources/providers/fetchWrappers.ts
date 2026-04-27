// ============================================================
// PAWEN — Phase U.4.3 — Source-fetcher wrappers using providers
//
// These wrappers are what the rewritten `reddit.ts` / `tiktok.ts` /
// `amazon.ts` / `youtube.ts` / `quora.ts` / `shopify.ts` call when
// USE_NEW_SCRAPING_STACK is on. They return the SAME `RawSourceData`
// shape the legacy fetchers produce, so callers upstream don't need
// any changes.
// ============================================================

import 'server-only';
import type { RawSourceData, RawSourceItem, SourceDiscoveryPlan } from '../../avatars/types';
import type { SocialResult, VideoResult, EcomResult } from './types';
import { getSocialProvider, getVideoProvider, getEcomProvider, getScraperProvider, getSearchProvider } from './registry';
// Note: health tracking is done centrally in /api/scraping/fetch after
// each wrapper returns. Keeps the wrappers pure.

// Per-source fetch caps. CHEAP mode is now the DEFAULT — keeps a fresh
// excavation under ~€2 of BrightData spend (target ~300 items per
// active source). To opt back into the previous high-recall behavior,
// set PAWEN_DEEP_SCRAPE=1 on the worker env.
const DEEP = process.env.PAWEN_DEEP_SCRAPE === '1';
const CAPS = DEEP
  ? {
      reddit:  { queries: 4, maxThreads: 15, maxComments: 40 },
      quora:   { queries: 6, maxThreads: 15, maxComments: 20 },
      youtube: { queries: 6, maxVideos: 8,   maxComments: 80 },
      tiktok:  { queries: 6, maxVideos: 12,  maxComments: 30 },
      amazon:  { queries: 4, maxProducts: 5, maxReviews: 40 },
    }
  : {
      reddit:  { queries: 3, maxThreads: 6,  maxComments: 25 },
      quora:   { queries: 3, maxThreads: 5,  maxComments: 20 },
      youtube: { queries: 3, maxVideos: 4,   maxComments: 25 },
      tiktok:  { queries: 4, maxVideos: 4,   maxComments: 15 },
      amazon:  { queries: 3, maxProducts: 4, maxReviews: 25 },
    };
console.info(`[fetchWrappers] mode=${DEEP ? 'DEEP' : 'CHEAP'} caps=`, CAPS);

function toRaw(source: RawSourceItem['source'], r: { url: string; title?: string; content: string; comments?: Array<{ text: string }>; metadata?: Record<string, unknown> }): RawSourceItem {
  return {
    source,
    url: r.url,
    title: r.title,
    content: r.content,
    comments: r.comments?.map(c => c.text).filter(Boolean),
    metadata: r.metadata,
  };
}

function renderSocialItem(r: SocialResult): string {
  const head = [
    r.title ? `TITLE: ${r.title}` : '',
    r.subreddit ? `SUBREDDIT: r/${r.subreddit}` : '',
    r.author ? `AUTHOR: ${r.author}` : '',
    typeof r.score === 'number' ? `SCORE: ${r.score}` : '',
    typeof r.commentCount === 'number' ? `COMMENTS: ${r.commentCount}` : '',
  ].filter(Boolean).join('\n');
  const body = r.content ? `\n\n${r.content}` : '';
  const comments = (r.comments ?? []).length > 0
    ? `\n\n--- COMMENTS (${r.comments!.length}) ---\n${r.comments!.map(c => `• ${c.text}`).join('\n')}`
    : '';
  return `${head}${body}${comments}`;
}

function renderVideoItem(r: VideoResult): string {
  const head = [
    r.title ? `TITLE: ${r.title}` : '',
    r.author ? `CHANNEL: ${r.author}` : '',
    typeof r.playCount === 'number' ? `VIEWS: ${r.playCount.toLocaleString()}` : '',
    typeof r.likeCount === 'number' ? `LIKES: ${r.likeCount.toLocaleString()}` : '',
    typeof r.commentCount === 'number' ? `COMMENTS: ${r.commentCount.toLocaleString()}` : '',
    r.hashtags && r.hashtags.length > 0 ? `HASHTAGS: ${r.hashtags.slice(0, 15).map(h => '#' + h).join(' ')}` : '',
  ].filter(Boolean).join('\n');
  const body = r.caption ? `\n\n${r.caption}` : '';
  const allComments: string[] = [];
  for (const c of r.comments ?? []) {
    allComments.push(`• ${c.text}${typeof c.likes === 'number' ? ` [${c.likes} likes]` : ''}`);
    for (const rep of c.replies ?? []) allComments.push(`  ↳ ${rep.text}`);
  }
  const commentsBlock = allComments.length > 0
    ? `\n\n--- COMMENTS (${allComments.length}) ---\n${allComments.join('\n')}`
    : '';
  return `${head}${body}${commentsBlock}`;
}

function renderEcomItem(r: EcomResult): string {
  const head = [
    r.title ? `PRODUCT: ${r.title}` : '',
    typeof r.rating === 'number' ? `RATING: ${r.rating}/5 (${r.reviewCount ?? 0} reviews)` : '',
    r.price !== undefined ? `PRICE: ${r.currency ?? ''} ${r.price}` : '',
    `URL: ${r.url}`,
  ].filter(Boolean).join('\n');
  const reviews = (r.reviews ?? []).map(rv => {
    const stars = typeof rv.rating === 'number' ? '★'.repeat(Math.round(rv.rating)) + '☆'.repeat(5 - Math.round(rv.rating)) : '';
    const verified = rv.verified ? ' [VERIFIED]' : '';
    return `${stars}${verified} "${rv.title ?? ''}"\n${rv.body}\n— ${rv.author ?? ''}${rv.date ? `, ${rv.date}` : ''}`;
  });
  const reviewsBlock = reviews.length > 0 ? `\n\n--- REVIEWS (${reviews.length}) ---\n\n${reviews.join('\n\n')}` : '';
  return `${head}${reviewsBlock}`;
}

// --- Reddit ---

export async function fetchRedditViaProviders(
  plan: SourceDiscoveryPlan['reddit'],
  language: string,
): Promise<RawSourceData> {
  const start = Date.now();
  const queries = (plan.queries ?? []).slice(0, 6);
  const subs = (plan.subreddits ?? []).slice(0, 30);
  const queriesUsed: string[] = [];
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();

  const provider = await getSocialProvider('reddit');
  if (!provider) {
    return {
      source: 'reddit',
      queries: queriesUsed,
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error: 'No healthy social provider available for Reddit (check BRIGHTDATA_API_KEY or REDDIT_CLIENT_ID/SECRET).',
    };
  }

  let lastError: string | null = null;
  for (const q of queries.slice(0, CAPS.reddit.queries)) {
    queriesUsed.push(q);
    try {
      const results = await provider.fetch(q, {
        platform: 'reddit',
        maxThreads: CAPS.reddit.maxThreads,
        maxCommentsPerThread: CAPS.reddit.maxComments,
        subreddits: subs,
        deepComments: true,
        language,
      });
      for (const r of results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        out.push(toRaw('reddit', { ...r, content: renderSocialItem(r) }));
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return {
    source: 'reddit',
    queries: queriesUsed,
    items: out,
    itemCount: out.length,
    fetchDurationMs: Date.now() - start,
    error: out.length === 0 ? (lastError ?? `Reddit via ${provider.id}: 0 items returned`) : undefined,
  };
}

// --- Quora ---

export async function fetchQuoraViaProviders(
  plan: SourceDiscoveryPlan['quora'],
  language: string,
): Promise<RawSourceData> {
  const start = Date.now();
  const queries = (plan.queries ?? []).slice(0, CAPS.quora.queries);
  const queriesUsed: string[] = [];
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();

  const provider = await getSocialProvider('quora');
  if (!provider) {
    return {
      source: 'quora',
      queries: queriesUsed,
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error: 'No healthy social provider available for Quora (check BRIGHTDATA_API_KEY).',
    };
  }
  let lastError: string | null = null;
  for (const q of queries) {
    queriesUsed.push(q);
    try {
      const results = await provider.fetch(q, {
        platform: 'quora',
        maxThreads: CAPS.quora.maxThreads,
        maxCommentsPerThread: CAPS.quora.maxComments,
        language,
      });
      for (const r of results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        out.push(toRaw('quora', { ...r, content: renderSocialItem(r) }));
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return {
    source: 'quora',
    queries: queriesUsed,
    items: out,
    itemCount: out.length,
    fetchDurationMs: Date.now() - start,
    error: out.length === 0 ? (lastError ?? `Quora via ${provider.id}: 0 items returned`) : undefined,
  };
}

// --- YouTube ---

export async function fetchYoutubeViaProviders(
  plan: SourceDiscoveryPlan['youtube'],
  language: string,
): Promise<RawSourceData> {
  const start = Date.now();
  const queries = (plan.video_queries ?? []).slice(0, CAPS.youtube.queries);
  const queriesUsed: string[] = [];
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();

  const provider = await getVideoProvider('youtube');
  if (!provider) {
    return {
      source: 'youtube',
      queries: queriesUsed,
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error: 'No healthy video provider for YouTube (check YOUTUBE_API_KEY).',
    };
  }
  let lastError: string | null = null;
  for (const q of queries) {
    queriesUsed.push(q);
    try {
      const results = await provider.fetch(q, {
        platform: 'youtube', mode: 'search', maxVideos: CAPS.youtube.maxVideos, maxCommentsPerVideo: CAPS.youtube.maxComments, language,
      });
      for (const r of results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        out.push(toRaw('youtube', { ...r, content: renderVideoItem(r) }));
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return {
    source: 'youtube',
    queries: queriesUsed,
    items: out,
    itemCount: out.length,
    fetchDurationMs: Date.now() - start,
    error: out.length === 0 ? (lastError ?? `YouTube via ${provider.id}: 0 items`) : undefined,
  };
}

// --- TikTok ---

export async function fetchTikTokViaProviders(
  plan: SourceDiscoveryPlan['tiktok'],
  language: string,
): Promise<RawSourceData> {
  const start = Date.now();
  const queries = (plan.search_queries ?? []).slice(0, CAPS.tiktok.queries);
  const hashtags = (plan.hashtags ?? []).slice(0, Math.min(4, CAPS.tiktok.queries));
  const queriesUsed: string[] = [];
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();

  const provider = await getVideoProvider('tiktok');
  if (!provider) {
    return {
      source: 'tiktok',
      queries: queriesUsed,
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error: 'No healthy video provider for TikTok (check TIKAPI_KEY).',
    };
  }
  let lastError: string | null = null;
  const passes: Array<{ mode: 'search' | 'hashtag'; query: string }> = [
    ...queries.map(q => ({ mode: 'search' as const, query: q })),
    ...hashtags.map(h => ({ mode: 'hashtag' as const, query: h })),
  ];
  for (const p of passes) {
    queriesUsed.push(p.mode === 'hashtag' ? `#${p.query}` : `search: ${p.query}`);
    try {
      const results = await provider.fetch(p.query, {
        platform: 'tiktok', mode: p.mode, maxVideos: CAPS.tiktok.maxVideos, maxCommentsPerVideo: CAPS.tiktok.maxComments, language,
      });
      for (const r of results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        out.push(toRaw('tiktok', { ...r, content: renderVideoItem(r) }));
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return {
    source: 'tiktok',
    queries: queriesUsed,
    items: out,
    itemCount: out.length,
    fetchDurationMs: Date.now() - start,
    error: out.length === 0 ? (lastError ?? `TikTok via ${provider.id}: 0 items`) : undefined,
  };
}

// --- Amazon ---

export async function fetchAmazonViaProviders(
  plan: SourceDiscoveryPlan['amazon'],
): Promise<RawSourceData> {
  const start = Date.now();
  const queries = (plan.product_queries ?? []).slice(0, CAPS.amazon.queries);
  const queriesUsed: string[] = [];
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();

  const provider = await getEcomProvider('amazon');
  if (!provider) {
    return {
      source: 'amazon',
      queries: queriesUsed,
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error: 'No healthy ecom provider for Amazon (check RAINFOREST_API_KEY).',
    };
  }
  let lastError: string | null = null;
  for (const q of queries) {
    queriesUsed.push(q);
    try {
      const results = await provider.fetch(q, {
        platform: 'amazon', marketplace: plan.marketplace ?? 'amazon.com', maxProducts: CAPS.amazon.maxProducts, maxReviewsPerProduct: CAPS.amazon.maxReviews,
      });
      for (const r of results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        out.push(toRaw('amazon', {
          ...r,
          content: renderEcomItem(r),
          comments: (r.reviews ?? []).map(rv => ({ text: rv.body })),
        }));
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return {
    source: 'amazon',
    queries: queriesUsed,
    items: out,
    itemCount: out.length,
    fetchDurationMs: Date.now() - start,
    error: out.length === 0 ? (lastError ?? `Amazon via ${provider.id}: 0 items`) : undefined,
  };
}

// --- Shopify (public) + Tavily/Exa competitor discovery ---

export async function fetchShopifyViaProviders(
  plan: SourceDiscoveryPlan['shopify'],
): Promise<RawSourceData> {
  const start = Date.now();
  const queriesUsed: string[] = [];
  const out: RawSourceItem[] = [];
  const seen = new Set<string>();

  // (1) Direct store URLs from the plan
  const ecom = await getEcomProvider('shopify');
  if (ecom) {
    for (const storeUrl of (plan.store_urls ?? []).slice(0, 5)) {
      queriesUsed.push(`shopify:${storeUrl}`);
      try {
        const results = await ecom.fetch(storeUrl, { platform: 'shopify', maxProducts: 10 });
        for (const r of results) {
          if (seen.has(r.url)) continue;
          seen.add(r.url);
          out.push(toRaw('shopify', { ...r, content: renderEcomItem(r) }));
        }
      } catch { /* skip */ }
    }
  }

  // (2) Search for competitor stores via the search provider
  const search = await getSearchProvider();
  if (search) {
    for (const q of (plan.product_queries ?? []).slice(0, 4)) {
      queriesUsed.push(`search: ${q}`);
      try {
        const results = await search.search(`site:myshopify.com OR site:shopify.com ${q}`, { maxResults: 5 });
        for (const r of results) {
          if (seen.has(r.url)) continue;
          seen.add(r.url);
          out.push(toRaw('shopify', {
            url: r.url,
            title: r.title,
            content: [r.title, r.snippet ?? r.content].filter(Boolean).join('\n\n'),
            metadata: r.metadata,
          }));
        }
      } catch { /* skip */ }
    }
  }

  return {
    source: 'shopify',
    queries: queriesUsed,
    items: out,
    itemCount: out.length,
    fetchDurationMs: Date.now() - start,
  };
}

// --- Tavily-replacement: generic search fetcher for existing consumers ---

export async function searchViaProviders(query: string, opts?: { maxResults?: number; language?: string }): Promise<Array<{ url: string; title: string; content: string }>> {
  const search = await getSearchProvider();
  if (!search) return [];
  try {
    const results = await search.search(query, { maxResults: opts?.maxResults ?? 10, language: opts?.language });
    return results.map(r => ({ url: r.url, title: r.title ?? '', content: r.snippet ?? r.content ?? '' }));
  } catch {
    return [];
  }
}

export async function scrapeViaProviders(url: string): Promise<{ url: string; markdown: string; metadata: Record<string, unknown> } | null> {
  const scraper = await getScraperProvider();
  if (!scraper) return null;
  try {
    const r = await scraper.scrape(url);
    return { url: r.url, markdown: r.markdown, metadata: r.metadata ?? {} };
  } catch {
    return null;
  }
}
