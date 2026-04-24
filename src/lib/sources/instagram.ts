// ============================================================
// PAWEN — Instagram Source Fetcher
//
// Strategy:
//   1. Primary: /api/instagram → Apify apify/instagram-scraper
//      → returns posts + organic comments (the real gold).
//   2. Fallback: Tavily + Firecrawl on site:instagram.com queries.
//      Yields caption text only (no comments) but keeps the run
//      alive if Apify is down or APIFY_TOKEN is missing.
//
// Comments are folded into the RawSourceItem as a big
// "--- COMMENTS ---" block inside `content`, matching the TikTok
// fetcher pattern so downstream n-gram + analyzer phases see
// every verbatim without code changes.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { scrapeMany, webSearch, toRawItem, languageModifier } from './common';
import { apiUrl } from '../util/apiBaseUrl';

export interface InstagramFetchOptions {
  maxPosts?: number;
  maxCommentsPerPost?: number;
}

interface InstagramApiPost {
  url: string;
  caption: string;
  author: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string | null;
  hashtags: string[];
  comments: string[];
}

interface InstagramApiResponse {
  mode: 'search' | 'hashtag';
  queriesUsed: string[];
  posts: InstagramApiPost[];
  postCount: number;
  totalComments: number;
  errors?: string[];
}

interface IgApifyCallResult {
  data: InstagramApiResponse | null;
  httpStatus: number | null;
  errorMessage: string | null;
}

async function scrapeViaApify(
  payload: Record<string, unknown>,
): Promise<IgApifyCallResult> {
  try {
    const res = await fetch(apiUrl('/api/instagram'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      if (typeof window !== 'undefined') {
        console.warn('[instagram:apify] HTTP', res.status, bodyText.slice(0, 200));
      }
      return {
        data: null,
        httpStatus: res.status,
        errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as InstagramApiResponse;
    return { data, httpStatus: res.status, errorMessage: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (typeof window !== 'undefined') {
      console.warn('[instagram:apify] threw:', msg);
    }
    return { data: null, httpStatus: null, errorMessage: msg };
  }
}

function renderApifyPost(p: InstagramApiPost): string {
  const head = [
    `CAPTION: ${p.caption}`,
    p.author ? `AUTHOR: @${p.author}` : '',
    `STATS: ${p.likeCount.toLocaleString()} likes · ${p.commentCount.toLocaleString()} comments${p.viewCount > 0 ? ` · ${p.viewCount.toLocaleString()} views` : ''}`,
    p.hashtags.length > 0 ? `HASHTAGS: ${p.hashtags.slice(0, 15).map((h) => `#${h}`).join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const commentsBlock =
    p.comments.length > 0
      ? `\n\n--- COMMENTS (${p.comments.length}) ---\n${p.comments.map((c) => `• ${c}`).join('\n')}`
      : '';

  return `${head}${commentsBlock}`;
}

export async function fetchInstagram(
  plan: SourceDiscoveryPlan['instagram'],
  language: string,
  options: InstagramFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();
  const maxPosts = options.maxPosts ?? 25;
  const maxCommentsPerPost = options.maxCommentsPerPost ?? 30;
  const queriesUsed: string[] = [];

  // ============================================================
  // PRIMARY PATH — Apify (real comments)
  // ============================================================
  const hashtags = (plan.hashtags ?? []).slice(0, 8);
  const searchQueries = (plan.search_queries ?? []).slice(0, 6);

  // Empty-plan guard — Marcus produced nothing to search.
  if (hashtags.length === 0 && searchQueries.length === 0) {
    return {
      source: 'instagram',
      queries: [],
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error:
        'Instagram: discovery plan contained zero hashtags and zero search queries. Marcus did not identify any relevant IG angles for this niche/language.',
    };
  }

  const passes: Promise<IgApifyCallResult>[] = [];
  if (hashtags.length > 0) {
    queriesUsed.push(...hashtags.map((h) => `#${h.replace(/^#/, '')}`));
    passes.push(
      scrapeViaApify({
        mode: 'hashtag',
        hashtags,
        resultsLimit: Math.ceil(maxPosts / 2),
        maxComments: maxCommentsPerPost,
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
        resultsLimit: Math.ceil(maxPosts / 2),
        maxComments: maxCommentsPerPost,
        language,
      }),
    );
  }

  const apifyResults = await Promise.all(passes);
  const dedupedByUrl = new Map<string, InstagramApiPost>();
  let apifyHttpFails = 0;
  let apifyEmpty = 0;
  let lastApifyStatus: number | null = null;
  let lastApifyError: string | null = null;
  for (const r of apifyResults) {
    if (r.data && Array.isArray(r.data.posts) && r.data.posts.length > 0) {
      for (const p of r.data.posts) {
        if (!dedupedByUrl.has(p.url)) dedupedByUrl.set(p.url, p);
      }
      continue;
    }
    if (r.data && Array.isArray(r.data.posts)) {
      apifyEmpty++;
    } else {
      apifyHttpFails++;
      if (r.httpStatus) lastApifyStatus = r.httpStatus;
      if (r.errorMessage) lastApifyError = r.errorMessage;
    }
  }

  if (dedupedByUrl.size > 0) {
    const posts = Array.from(dedupedByUrl.values()).slice(0, maxPosts);
    const items = posts.map((p) =>
      toRawItem('instagram', p.url, renderApifyPost(p), {
        title: p.caption.slice(0, 120),
        comments: p.comments,
        metadata: {
          author: p.author,
          like_count: p.likeCount,
          comment_count: p.commentCount,
          view_count: p.viewCount,
          created_at: p.createdAt,
          hashtags: p.hashtags,
          comments_scraped: p.comments.length,
          via: 'apify',
        },
      }),
    );

    return {
      source: 'instagram',
      queries: queriesUsed,
      items,
      itemCount: items.length,
      fetchDurationMs: Date.now() - start,
    };
  }

  // ============================================================
  // FALLBACK PATH — Tavily + Firecrawl (captions only)
  // ============================================================
  const langMod = languageModifier(language);
  const postUrls = new Set<string>();
  const queries = [...searchQueries, ...hashtags.map((h) => `#${h}`)].slice(0, 4);

  for (const q of queries) {
    const searchQuery = `site:instagram.com ${q} ${langMod}`.trim();
    queriesUsed.push(`fallback: ${searchQuery}`);
    const result = await webSearch(searchQuery, { maxResults: 8 });
    if (!result) continue;
    for (const r of result.results) {
      if (r.url.includes('instagram.com/p/') || r.url.includes('instagram.com/reel/')) {
        postUrls.add(r.url);
      }
    }
  }

  const urlList = Array.from(postUrls).slice(0, Math.min(maxPosts, 10));
  const scraped = await scrapeMany(urlList, 3);

  const items = scraped.map((page) =>
    toRawItem('instagram', page.url, page.markdown, {
      title: (page.metadata.title as string) ?? undefined,
      metadata: { ...page.metadata, via: 'firecrawl-fallback' },
    }),
  );

  let error: string | undefined;
  if (items.length === 0) {
    const parts: string[] = [
      `Instagram: 0 items from ${passes.length} Apify pass${passes.length === 1 ? '' : 'es'} + Firecrawl fallback.`,
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
        `All ${passes.length} Apify passes returned 0 posts. Likely cause: hashtags/queries in "${language}" are too niche, OR IG is hiding results behind the login wall for this actor.`,
      );
    } else {
      parts.push('Firecrawl fallback also returned nothing — IG posts render behind a login wall.');
    }
    error = parts.join(' ');
  }

  return {
    source: 'instagram',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
    error,
  };
}
