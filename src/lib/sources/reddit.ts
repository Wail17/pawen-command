// ============================================================
// PAWEN — Reddit Source Fetcher (v3 — Apify batch)
//
// Reddit hard-blocks Vercel datacenter IPs (CloudFlare 403 on every
// request, confirmed empirically via /api/reddit-debug). So we route
// through Apify's trudax/reddit-scraper-lite actor via /api/reddit
// using the new `subreddit` batch mode — one Apify call per sub
// returns N posts + comments in one shot.
//
// Strategy:
//   1. For each subreddit in the plan, POST /api/reddit { mode: 'subreddit',
//      subreddit, queries, limit } → returns posts[] with pre-built markdown.
//   2. If queries are empty OR search returned 0, the route auto-falls back
//      to top-of-year on the server side (single Apify call).
//   3. No per-thread follow-up fetch — the batch already includes comments.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { toRawItem } from './common';

export type RedditDepth = 'standard' | 'deep' | 'maximum';

export interface RedditFetchOptions {
  maxThreadsPerSubreddit?: number;
  maxSubreddits?: number;
  maxQueriesPerSub?: number;
  depth?: RedditDepth;
}

// Preset depth levels — user-facing in the Gate 1 UI.
// "standard" = fast baseline, "deep" = wide coverage default, "maximum" = exhaustive.
export const REDDIT_DEPTH_PRESETS: Record<RedditDepth, {
  maxSubreddits: number;
  maxThreadsPerSubreddit: number;
  maxQueriesPerSub: number;
  label: string;
  description: string;
}> = {
  standard: {
    maxSubreddits: 15,
    maxThreadsPerSubreddit: 4,
    maxQueriesPerSub: 2,
    label: 'Standard',
    description: '15 subs × 4 threads ≈ 60 threads',
  },
  deep: {
    maxSubreddits: 30,
    maxThreadsPerSubreddit: 4,
    maxQueriesPerSub: 3,
    label: 'Deep',
    description: '30 subs × 4 threads ≈ 120 threads',
  },
  maximum: {
    maxSubreddits: 50,
    maxThreadsPerSubreddit: 5,
    maxQueriesPerSub: 3,
    label: 'Maximum',
    description: '50 subs × 5 threads ≈ 250 threads',
  },
};

interface RedditBatchPost {
  url: string;
  title: string;
  markdown: string;
  subreddit: string;
  score: number;
  numComments: number;
}

interface RedditBatchResponse {
  posts?: RedditBatchPost[];
  count?: number;
  error?: string;
}

interface RedditBatchDiagnostics {
  subreddits: number;
  batchCalls: number;
  batchHttpFails: number;
  batchEmpty: number;
  lastError: string | null;
  lastHttpStatus: number | null;
}

function newDiagnostics(): RedditBatchDiagnostics {
  return {
    subreddits: 0,
    batchCalls: 0,
    batchHttpFails: 0,
    batchEmpty: 0,
    lastError: null,
    lastHttpStatus: null,
  };
}

async function batchSubreddit(
  subreddit: string,
  queries: string[],
  limit: number,
  diag: RedditBatchDiagnostics,
): Promise<RedditBatchPost[]> {
  diag.batchCalls++;
  try {
    const res = await fetch('/api/reddit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'subreddit', subreddit, queries, limit }),
    });
    if (!res.ok) {
      diag.batchHttpFails++;
      diag.lastHttpStatus = res.status;
      try {
        const body = (await res.json()) as RedditBatchResponse;
        if (body.error) diag.lastError = body.error;
      } catch {
        // ignore
      }
      return [];
    }
    const data = (await res.json()) as RedditBatchResponse;
    const posts = Array.isArray(data.posts) ? data.posts : [];
    if (posts.length === 0) {
      diag.batchEmpty++;
      if (data.error) diag.lastError = data.error;
    }
    return posts;
  } catch (e) {
    diag.batchHttpFails++;
    diag.lastError = e instanceof Error ? e.message : String(e);
    return [];
  }
}

export async function fetchReddit(
  plan: SourceDiscoveryPlan['reddit'],
  _language: string,
  options: RedditFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();

  // Resolve preset first, then allow explicit overrides to win.
  const preset = REDDIT_DEPTH_PRESETS[options.depth ?? 'deep'];
  const maxThreads = options.maxThreadsPerSubreddit ?? preset.maxThreadsPerSubreddit;
  const maxSubs = options.maxSubreddits ?? preset.maxSubreddits;
  const maxQueriesPerSub = options.maxQueriesPerSub ?? preset.maxQueriesPerSub;

  const subs = plan.subreddits.slice(0, maxSubs);
  const queries = (plan.queries || []).slice(0, maxQueriesPerSub);
  const queriesUsed: string[] = [];
  const diag = newDiagnostics();
  diag.subreddits = subs.length;

  // Empty-plan guard: Marcus produced no subreddits at all
  if (subs.length === 0) {
    return {
      source: 'reddit',
      queries: [],
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error:
        'Reddit: discovery plan contained zero subreddits. Marcus did not identify any relevant subs for this niche/language.',
    };
  }

  // Batch-fetch each subreddit in parallel (Apify handles the actual scraping).
  // Concurrency cap to avoid saturating Apify free tier.
  const concurrency = 3;
  const queue = [...subs];
  const allPosts: RedditBatchPost[] = [];
  const seenUrls = new Set<string>();

  async function worker() {
    while (queue.length > 0) {
      const sub = queue.shift();
      if (!sub) break;
      const label =
        queries.length > 0
          ? `r/${sub.replace(/^r\//, '')} :: ${queries.join(' | ')}`
          : `r/${sub.replace(/^r\//, '')} :: TOP year`;
      queriesUsed.push(label);
      const posts = await batchSubreddit(sub, queries, maxThreads, diag);
      for (const p of posts) {
        if (p.url && !seenUrls.has(p.url) && p.markdown && p.markdown.length >= 100) {
          seenUrls.add(p.url);
          allPosts.push(p);
        }
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, subs.length) }, worker);
  await Promise.all(workers);

  const items = allPosts.map((p) =>
    toRawItem('reddit', p.url, p.markdown, {
      title: p.title,
      metadata: {
        subreddit: p.subreddit,
        score: p.score,
        num_comments: p.numComments,
      },
    }),
  );

  // Build a diagnostic error message if we found nothing.
  let error: string | undefined;
  if (items.length === 0) {
    const parts: string[] = [
      `Reddit: 0 items from ${subs.length} sub${subs.length === 1 ? '' : 's'} via Apify.`,
    ];
    if (diag.batchHttpFails > 0) {
      parts.push(
        `Batch HTTP failures: ${diag.batchHttpFails}/${diag.batchCalls}${diag.lastHttpStatus ? ` (last status ${diag.lastHttpStatus})` : ''}.`,
      );
      if (diag.lastError) parts.push(`Last error: ${diag.lastError}`);
    } else if (diag.batchEmpty === diag.batchCalls) {
      parts.push(
        `All ${diag.batchCalls} Apify calls returned 0 posts. Most likely: queries in "${_language}" didn't match the English-speaking subs Marcus planned, OR the niche is too narrow. Try broader queries or different subs.`,
      );
    } else {
      parts.push(`${diag.batchEmpty}/${diag.batchCalls} subs came back empty.`);
      if (diag.lastError) parts.push(`Last error: ${diag.lastError}`);
    }
    error = parts.join(' ');
  }

  return {
    source: 'reddit',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
    error,
  };
}
