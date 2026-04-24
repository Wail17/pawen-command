// ============================================================
// PAWEN — TikTok Source Fetcher (v2 — Apify-first)
//
// Strategy:
//   1. Primary: /api/tiktok → Apify clockworks/free-tiktok-scraper
//      → returns real video metadata + ORGANIC COMMENTS.
//   2. Fallback: if Apify is unavailable or returns nothing, fall
//      back to the old Tavily + Firecrawl path so TikTok never hard-
//      fails a run.
//
// Comments are folded into the RawSourceItem as a big "--- COMMENTS ---"
// block inside `content`, so the downstream n-gram + analyzer phases
// see every verbatim exactly like they do for Reddit threads.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { scrapeMany, webSearch, toRawItem, languageModifier } from './common';
import { apiUrl } from '../util/apiBaseUrl';
import { isNewScrapingStackOn, fetchViaNewStack } from './providers/clientDispatch';

export interface TikTokFetchOptions {
  maxVideos?: number;        // default 25
  maxCommentsPerVideo?: number; // default 40
}

interface TikTokApiVideo {
  url: string;
  caption: string;
  author: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string | null;
  hashtags: string[];
  comments: string[];
}

interface TikTokApiResponse {
  mode: 'search' | 'hashtag';
  queriesUsed: string[];
  videos: TikTokApiVideo[];
  videoCount: number;
  totalComments: number;
  error?: string;
}

interface ApifyCallResult {
  data: TikTokApiResponse | null;
  httpStatus: number | null;
  errorMessage: string | null;
}

async function scrapeViaApify(
  payload: Record<string, unknown>,
): Promise<ApifyCallResult> {
  try {
    const res = await fetch(apiUrl('/api/tiktok'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      if (typeof window !== 'undefined') {
        console.warn('[tiktok:apify] HTTP', res.status, bodyText.slice(0, 200));
      }
      return {
        data: null,
        httpStatus: res.status,
        errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as TikTokApiResponse;
    return {
      data,
      httpStatus: res.status,
      errorMessage: data.error ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (typeof window !== 'undefined') {
      console.warn('[tiktok:apify] threw:', msg);
    }
    return { data: null, httpStatus: null, errorMessage: msg };
  }
}

function renderApifyVideo(v: TikTokApiVideo): string {
  const head = [
    `CAPTION: ${v.caption}`,
    v.author ? `AUTHOR: @${v.author}` : '',
    `STATS: ${v.playCount.toLocaleString()} views · ${v.likeCount.toLocaleString()} likes · ${v.commentCount.toLocaleString()} comments`,
    v.hashtags.length > 0 ? `HASHTAGS: ${v.hashtags.slice(0, 15).join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const commentsBlock =
    v.comments.length > 0
      ? `\n\n--- COMMENTS (${v.comments.length}) ---\n${v.comments.map((c) => `• ${c}`).join('\n')}`
      : '';

  return `${head}${commentsBlock}`;
}

export async function fetchTikTok(
  plan: SourceDiscoveryPlan['tiktok'],
  language: string,
  options: TikTokFetchOptions = {},
): Promise<RawSourceData> {
  if (isNewScrapingStackOn()) {
    return fetchViaNewStack('tiktok', plan, language);
  }
  const start = Date.now();
  const maxVideos = options.maxVideos ?? 25;
  const maxCommentsPerVideo = options.maxCommentsPerVideo ?? 40;
  const queriesUsed: string[] = [];

  // ============================================================
  // PRIMARY PATH — Apify (real comments)
  // ============================================================
  // Run TWO passes in parallel: (a) hashtag mode over plan.hashtags,
  // (b) search mode over plan.search_queries. Merge both into one
  // dedup'd video list. This doubles our organic coverage without
  // doubling the runtime.
  const hashtags = (plan.hashtags ?? []).slice(0, 6);
  const searchQueries = (plan.search_queries ?? []).slice(0, 6);

  // Empty-plan guard — Marcus produced no hashtags or queries at all.
  if (hashtags.length === 0 && searchQueries.length === 0) {
    return {
      source: 'tiktok',
      queries: [],
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error:
        'TikTok: discovery plan contained zero hashtags and zero search queries. Marcus did not identify any relevant TikTok angles for this niche/language.',
    };
  }

  const passes: Promise<ApifyCallResult>[] = [];
  if (hashtags.length > 0) {
    queriesUsed.push(...hashtags.map((h) => `#${h.replace(/^#/, '')}`));
    passes.push(
      scrapeViaApify({
        mode: 'hashtag',
        hashtags,
        maxVideos: Math.ceil(maxVideos / Math.max(1, passes.length + 1)),
        maxComments: maxCommentsPerVideo,
        language,
      }),
    );
  }
  if (searchQueries.length > 0) {
    queriesUsed.push(...searchQueries.map((q) => `search: ${q}`));
    passes.push(
      scrapeViaApify({
        mode: 'search',
        queries: searchQueries,
        maxVideos: Math.ceil(maxVideos / Math.max(1, passes.length + 1)),
        maxComments: maxCommentsPerVideo,
        language,
      }),
    );
  }

  const apifyResults = await Promise.all(passes);
  const dedupedByUrl = new Map<string, TikTokApiVideo>();
  let apifyHttpFails = 0;
  let apifyEmpty = 0;
  let lastApifyStatus: number | null = null;
  let lastApifyError: string | null = null;
  for (const r of apifyResults) {
    if (r.data && Array.isArray(r.data.videos) && r.data.videos.length > 0) {
      for (const v of r.data.videos) {
        if (!dedupedByUrl.has(v.url)) dedupedByUrl.set(v.url, v);
      }
      continue;
    }
    if (r.data && Array.isArray(r.data.videos)) {
      apifyEmpty++;
      if (r.errorMessage) lastApifyError = r.errorMessage;
    } else {
      apifyHttpFails++;
      if (r.httpStatus) lastApifyStatus = r.httpStatus;
      if (r.errorMessage) lastApifyError = r.errorMessage;
    }
  }

  if (dedupedByUrl.size > 0) {
    const videos = Array.from(dedupedByUrl.values()).slice(0, maxVideos);
    const items = videos.map((v) =>
      toRawItem('tiktok', v.url, renderApifyVideo(v), {
        title: v.caption.slice(0, 120),
        comments: v.comments,
        metadata: {
          author: v.author,
          play_count: v.playCount,
          like_count: v.likeCount,
          comment_count: v.commentCount,
          created_at: v.createdAt,
          hashtags: v.hashtags,
          comments_scraped: v.comments.length,
          via: 'apify',
        },
      }),
    );

    return {
      source: 'tiktok',
      queries: queriesUsed,
      items,
      itemCount: items.length,
      fetchDurationMs: Date.now() - start,
    };
  }

  // ============================================================
  // FALLBACK PATH — Tavily + Firecrawl (no comments, best-effort)
  // ============================================================
  const langMod = languageModifier(language);
  const videoUrls = new Set<string>();
  const allQueries = [...searchQueries, ...hashtags].slice(0, 4);

  for (const q of allQueries) {
    const searchQuery = `site:tiktok.com ${q} ${langMod}`.trim();
    queriesUsed.push(`fallback: ${searchQuery}`);
    const result = await webSearch(searchQuery, { maxResults: 8 });
    if (!result) continue;
    for (const r of result.results) {
      if (r.url.includes('tiktok.com/@') || r.url.includes('tiktok.com/tag/')) {
        videoUrls.add(r.url);
      }
    }
  }

  const urlList = Array.from(videoUrls).slice(0, Math.min(maxVideos, 10));
  const scraped = await scrapeMany(urlList, 3);

  const items = scraped.map((page) =>
    toRawItem('tiktok', page.url, page.markdown, {
      title: (page.metadata.title as string) ?? undefined,
      metadata: { ...page.metadata, via: 'firecrawl-fallback' },
    }),
  );

  let error: string | undefined;
  if (items.length === 0) {
    const parts: string[] = [
      `TikTok: 0 items from ${passes.length} Apify pass${passes.length === 1 ? '' : 'es'} + Firecrawl fallback.`,
    ];
    if (apifyHttpFails > 0) {
      parts.push(
        `Apify HTTP failures: ${apifyHttpFails}/${passes.length}${lastApifyStatus ? ` (last status ${lastApifyStatus})` : ''}.`,
      );
      if (lastApifyStatus === 401 || lastApifyStatus === 403) {
        parts.push('Likely cause: APIFY_TOKEN missing or invalid on the server.');
      } else if (lastApifyStatus === 429) {
        parts.push('Rate limited by Apify.');
      }
      if (lastApifyError) parts.push(`Last error: ${lastApifyError.slice(0, 200)}`);
    } else if (apifyEmpty === passes.length && passes.length > 0) {
      parts.push(
        `All ${passes.length} Apify passes returned 0 videos. Likely cause: hashtags/queries in "${language}" didn't match any public TikTok content, OR TikTok's algorithm blocked the actor's searches.`,
      );
    } else {
      parts.push('Firecrawl fallback also returned nothing — TikTok pages may be rendering behind a login wall.');
    }
    error = parts.join(' ');
  }

  return {
    source: 'tiktok',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
    error,
  };
}
