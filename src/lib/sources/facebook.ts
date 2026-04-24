// ============================================================
// PAWEN — Facebook Source Fetcher
//
// Strategy:
//   1. If Marcus's plan provides explicit page/group URLs → direct
//      Apify scrape via /api/facebook (apify/facebook-posts-scraper).
//   2. For search queries, first resolve them to public FB URLs via
//      Tavily (site:facebook.com/groups OR site:facebook.com) then
//      funnel those URLs into the same Apify call.
//   3. If Apify is unavailable or returns nothing, fall back to
//      Firecrawl scraping of the Tavily-resolved URLs. Public FB
//      pages often expose enough caption + top-comment text to be
//      useful even without the full scraper.
//
// Comments are folded into content as "--- COMMENTS ---" blocks
// so the downstream n-gram + analyzer phases see every verbatim.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { scrapeMany, webSearch, toRawItem, languageModifier } from './common';
import { apiUrl } from '../util/apiBaseUrl';

export interface FacebookFetchOptions {
  maxPosts?: number;
  maxCommentsPerPost?: number;
}

interface FacebookApiPost {
  url: string;
  text: string;
  author: string;
  pageOrGroup: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string | null;
  comments: string[];
}

interface FacebookApiResponse {
  urlsUsed: string[];
  posts: FacebookApiPost[];
  postCount: number;
  totalComments: number;
  error?: string;
}

interface FbApifyCallResult {
  data: FacebookApiResponse | null;
  httpStatus: number | null;
  errorMessage: string | null;
}

async function scrapeViaApify(
  startUrls: string[],
  resultsLimit: number,
  maxComments: number,
): Promise<FbApifyCallResult> {
  try {
    const res = await fetch(apiUrl('/api/facebook'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls,
        resultsLimit,
        maxComments,
      }),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      if (typeof window !== 'undefined') {
        console.warn('[facebook:apify] HTTP', res.status, bodyText.slice(0, 200));
      }
      return {
        data: null,
        httpStatus: res.status,
        errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as FacebookApiResponse;
    return { data, httpStatus: res.status, errorMessage: data.error ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (typeof window !== 'undefined') {
      console.warn('[facebook:apify] threw:', msg);
    }
    return { data: null, httpStatus: null, errorMessage: msg };
  }
}

function renderApifyPost(p: FacebookApiPost): string {
  const head = [
    p.pageOrGroup ? `FROM: ${p.pageOrGroup}` : '',
    p.author ? `AUTHOR: ${p.author}` : '',
    `STATS: ${p.likeCount.toLocaleString()} likes · ${p.commentCount.toLocaleString()} comments · ${p.shareCount.toLocaleString()} shares`,
    '',
    `POST: ${p.text}`,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join('\n');

  const commentsBlock =
    p.comments.length > 0
      ? `\n\n--- COMMENTS (${p.comments.length}) ---\n${p.comments.map((c) => `• ${c}`).join('\n')}`
      : '';

  return `${head}${commentsBlock}`;
}

// Resolve text queries → public FB URLs via Tavily. We accept any
// URL that lives under facebook.com/{groups,pages,pg,profile}/ or
// is a direct post/permalink.
async function resolveSearchQueriesToUrls(
  queries: string[],
  language: string,
): Promise<string[]> {
  const langMod = languageModifier(language);
  const urls = new Set<string>();
  for (const q of queries) {
    const searchQuery = `site:facebook.com ${q} ${langMod}`.trim();
    const result = await webSearch(searchQuery, { maxResults: 8 });
    if (!result) continue;
    for (const r of result.results) {
      if (/facebook\.com\/(groups|pages|pg|permalink|posts)/i.test(r.url)) {
        urls.add(r.url);
      }
    }
  }
  return Array.from(urls);
}

export async function fetchFacebook(
  plan: SourceDiscoveryPlan['facebook'],
  language: string,
  options: FacebookFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();
  const maxPosts = options.maxPosts ?? 30;
  const maxCommentsPerPost = options.maxCommentsPerPost ?? 25;
  const queriesUsed: string[] = [];

  // Build the URL list: explicit plan URLs + resolved search queries
  const directUrls = (plan.page_urls ?? [])
    .map((u) => u.trim())
    .filter((u) => /facebook\.com/i.test(u));

  const searchQueries = (plan.search_queries ?? []).slice(0, 5);
  queriesUsed.push(...directUrls.map((u) => `url: ${u}`));

  let resolvedUrls: string[] = [];
  if (searchQueries.length > 0) {
    queriesUsed.push(...searchQueries.map((q) => `search: ${q}`));
    resolvedUrls = await resolveSearchQueriesToUrls(searchQueries, language);
  }

  const allUrls = Array.from(new Set([...directUrls, ...resolvedUrls])).slice(0, 12);

  if (allUrls.length === 0) {
    return {
      source: 'facebook',
      queries: queriesUsed,
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error:
        'Facebook: no public page/group URLs found. Marcus produced no direct URLs and Tavily returned nothing public for the search queries.',
    };
  }

  // ============================================================
  // PRIMARY PATH — Apify
  // ============================================================
  const apifyCall = await scrapeViaApify(allUrls, maxPosts, maxCommentsPerPost);
  const apifyResult = apifyCall.data;

  if (apifyResult && Array.isArray(apifyResult.posts) && apifyResult.posts.length > 0) {
    const posts = apifyResult.posts.slice(0, maxPosts);
    const items = posts.map((p) =>
      toRawItem('facebook', p.url, renderApifyPost(p), {
        title: p.text.slice(0, 120) || p.pageOrGroup || 'Facebook post',
        comments: p.comments,
        metadata: {
          author: p.author,
          page_or_group: p.pageOrGroup,
          like_count: p.likeCount,
          comment_count: p.commentCount,
          share_count: p.shareCount,
          created_at: p.createdAt,
          comments_scraped: p.comments.length,
          via: 'apify',
        },
      }),
    );

    return {
      source: 'facebook',
      queries: queriesUsed,
      items,
      itemCount: items.length,
      fetchDurationMs: Date.now() - start,
    };
  }

  // ============================================================
  // FALLBACK PATH — Firecrawl on the resolved URLs
  // ============================================================
  const scraped = await scrapeMany(allUrls.slice(0, 10), 3);

  const items = scraped.map((page) =>
    toRawItem('facebook', page.url, page.markdown, {
      title: (page.metadata.title as string) ?? undefined,
      metadata: { ...page.metadata, via: 'firecrawl-fallback' },
    }),
  );

  let error: string | undefined;
  if (items.length === 0) {
    const parts: string[] = [
      `Facebook: 0 items from Apify + Firecrawl fallback across ${allUrls.length} URL${allUrls.length === 1 ? '' : 's'}.`,
    ];
    if (apifyCall.httpStatus && apifyCall.httpStatus >= 400) {
      parts.push(`Apify HTTP ${apifyCall.httpStatus}.`);
      if (apifyCall.httpStatus === 401 || apifyCall.httpStatus === 403) {
        parts.push('Likely cause: APIFY_TOKEN missing or invalid.');
      } else if (apifyCall.httpStatus === 429) {
        parts.push('Rate limited by Apify.');
      }
      if (apifyCall.errorMessage) parts.push(`Detail: ${apifyCall.errorMessage.slice(0, 200)}`);
    } else if (apifyResult && Array.isArray(apifyResult.posts)) {
      parts.push('Apify returned 0 posts — most groups in this niche are private (login-walled) or Marcus did not find any public ones.');
    } else if (apifyCall.errorMessage) {
      parts.push(`Apify error: ${apifyCall.errorMessage.slice(0, 200)}`);
    } else {
      parts.push('Firecrawl fallback also returned nothing — URLs are likely login-walled.');
    }
    error = parts.join(' ');
  }

  return {
    source: 'facebook',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
    error,
  };
}
