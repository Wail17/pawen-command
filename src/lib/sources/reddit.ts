// ============================================================
// PAWEN — Reddit Source Fetcher (v4 — Native JSON API + Apify fallback)
//
// Strategy:
//   1. Auto-discover relevant subreddits via Reddit's search API
//   2. Search + fetch deep comments from EVERY discovered subreddit
//   3. Global Reddit search for broad queries
//   4. All comments extracted recursively (not just top-level)
//   5. Apify fallback if Reddit blocks Vercel IPs
//
// Coverage:
//   standard: ~15 subs + 5 global searches ≈ 100+ threads, 1000+ comments
//   deep:     ~30 subs + 10 global searches ≈ 200+ threads, 3000+ comments
//   maximum:  ~50 subs + 15 global searches ≈ 400+ threads, 8000+ comments
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { toRawItem } from './common';
import { apiUrl } from '../util/apiBaseUrl';
import { isNewScrapingStackOn, fetchViaNewStack } from './providers/clientDispatch';

export type RedditDepth = 'standard' | 'deep' | 'maximum';

export interface RedditFetchOptions {
  maxThreadsPerSubreddit?: number;
  maxSubreddits?: number;
  maxQueriesPerSub?: number;
  depth?: RedditDepth;
}

export const REDDIT_DEPTH_PRESETS: Record<RedditDepth, {
  maxSubreddits: number;
  maxThreadsPerSubreddit: number;
  maxQueriesPerSub: number;
  globalSearches: number;
  globalSearchLimit: number;
  label: string;
  description: string;
}> = {
  standard: {
    maxSubreddits: 15,
    maxThreadsPerSubreddit: 8,
    maxQueriesPerSub: 3,
    globalSearches: 5,
    globalSearchLimit: 25,
    label: 'Standard',
    description: '~15 subs + 5 global searches ≈ 100+ threads, 1000+ comments',
  },
  deep: {
    maxSubreddits: 30,
    maxThreadsPerSubreddit: 10,
    maxQueriesPerSub: 4,
    globalSearches: 10,
    globalSearchLimit: 40,
    label: 'Deep',
    description: '~30 subs + 10 global searches ≈ 200+ threads, 3000+ comments',
  },
  maximum: {
    maxSubreddits: 50,
    maxThreadsPerSubreddit: 15,
    maxQueriesPerSub: 5,
    globalSearches: 15,
    globalSearchLimit: 50,
    label: 'Maximum',
    description: '~50 subs + 15 global searches ≈ 400+ threads, 8000+ comments',
  },
};

interface RedditSubredditResponse {
  posts: Array<{
    url: string;
    title: string;
    markdown: string;
    subreddit: string;
    score: number;
    numComments: number;
  }>;
  count: number;
  totalComments?: number;
  source?: string;
  error?: string;
}

interface RedditDiscoverResponse {
  subreddits: Array<{
    name: string;
    subscribers: number;
    description: string;
  }>;
  count: number;
}

interface RedditSearchResponse {
  posts: Array<{
    url: string;
    title: string;
    markdown?: string;
    subreddit: string;
    score: number;
    numComments: number;
  }>;
  count: number;
  totalComments?: number;
  source?: string;
}

interface FetchDiagnostics {
  plannedSubs: number;
  discoveredSubs: number;
  totalSubsFetched: number;
  globalSearches: number;
  totalPosts: number;
  totalComments: number;
  nativeSuccesses: number;
  apifyFallbacks: number;
  failures: number;
  lastError: string | null;
}

function newDiagnostics(): FetchDiagnostics {
  return {
    plannedSubs: 0,
    discoveredSubs: 0,
    totalSubsFetched: 0,
    globalSearches: 0,
    totalPosts: 0,
    totalComments: 0,
    nativeSuccesses: 0,
    apifyFallbacks: 0,
    failures: 0,
    lastError: null,
  };
}

// Fetch posts from a single subreddit via /api/reddit
async function fetchSubreddit(
  subreddit: string,
  queries: string[],
  limit: number,
  diag: FetchDiagnostics,
): Promise<RedditSubredditResponse['posts']> {
  try {
    const res = await fetch(apiUrl('/api/reddit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'subreddit',
        subreddit,
        queries,
        limit,
        deep_comments: true,
      }),
    });
    if (!res.ok) {
      diag.failures++;
      diag.lastError = `HTTP ${res.status} for r/${subreddit}`;
      return [];
    }
    const data = (await res.json()) as RedditSubredditResponse;
    const posts = Array.isArray(data.posts) ? data.posts : [];
    if (data.source === 'native') diag.nativeSuccesses++;
    if (data.source === 'apify') diag.apifyFallbacks++;
    if (data.totalComments) diag.totalComments += data.totalComments;
    if (posts.length === 0 && data.error) diag.lastError = data.error;
    return posts;
  } catch (e) {
    diag.failures++;
    diag.lastError = e instanceof Error ? e.message : String(e);
    return [];
  }
}

// Discover subreddits for a query via /api/reddit
async function discoverSubs(query: string, limit: number): Promise<string[]> {
  try {
    const res = await fetch(apiUrl('/api/reddit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'discover', query, limit }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as RedditDiscoverResponse;
    return (data.subreddits ?? [])
      .sort((a, b) => b.subscribers - a.subscribers)
      .map(s => s.name);
  } catch {
    return [];
  }
}

// Global Reddit search via /api/reddit
async function globalSearch(
  query: string,
  limit: number,
  maxThreads: number,
  diag: FetchDiagnostics,
): Promise<RedditSubredditResponse['posts']> {
  try {
    const res = await fetch(apiUrl('/api/reddit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'search',
        query,
        limit,
        fetch_comments: true,
        max_threads: maxThreads,
      }),
    });
    if (!res.ok) {
      diag.failures++;
      return [];
    }
    const data = (await res.json()) as RedditSearchResponse;
    if (data.totalComments) diag.totalComments += data.totalComments;
    return (data.posts ?? []).map(p => ({
      ...p,
      markdown: p.markdown ?? `# ${p.title}\n*r/${p.subreddit}*\n\n`,
    }));
  } catch (e) {
    diag.failures++;
    diag.lastError = e instanceof Error ? e.message : String(e);
    return [];
  }
}

export async function fetchReddit(
  plan: SourceDiscoveryPlan['reddit'],
  _language: string,
  options: RedditFetchOptions = {},
): Promise<RawSourceData> {
  // Phase U.4: short-circuit to the new provider stack when flag is on.
  if (isNewScrapingStackOn()) {
    return fetchViaNewStack('reddit', plan, _language);
  }

  const start = Date.now();

  const preset = REDDIT_DEPTH_PRESETS[options.depth ?? 'deep'];
  const maxThreads = options.maxThreadsPerSubreddit ?? preset.maxThreadsPerSubreddit;
  const maxSubs = options.maxSubreddits ?? preset.maxSubreddits;
  const maxQueriesPerSub = options.maxQueriesPerSub ?? preset.maxQueriesPerSub;

  const diag = newDiagnostics();
  const queriesUsed: string[] = [];
  const allPosts: RedditSubredditResponse['posts'] = [];
  const seenUrls = new Set<string>();

  // --- Phase 1: Auto-discover subreddits ---
  // Use the plan's queries to find relevant subreddits we might have missed
  const plannedSubs = plan.subreddits.slice(0, maxSubs);
  diag.plannedSubs = plannedSubs.length;

  const discoveryQueries = (plan.queries || []).slice(0, 3);
  const discoveredSubs: string[] = [];
  if (discoveryQueries.length > 0) {
    const discoveries = await Promise.allSettled(
      discoveryQueries.map(q => discoverSubs(q, 15)),
    );
    for (const d of discoveries) {
      if (d.status === 'fulfilled') discoveredSubs.push(...d.value);
    }
  }

  // Merge planned + discovered, deduplicate, prioritize planned
  const plannedSet = new Set(plannedSubs.map(s => s.toLowerCase().replace(/^r\//, '')));
  const uniqueDiscovered = discoveredSubs.filter(s => !plannedSet.has(s.toLowerCase()));
  const allSubs = [...plannedSubs, ...uniqueDiscovered].slice(0, maxSubs);
  diag.discoveredSubs = uniqueDiscovered.length;

  if (allSubs.length === 0 && (plan.queries || []).length === 0) {
    return {
      source: 'reddit',
      queries: [],
      items: [],
      itemCount: 0,
      fetchDurationMs: Date.now() - start,
      error: 'Reddit: zero subreddits and zero queries. Marcus did not identify relevant subs.',
    };
  }

  // --- Phase 2: Fetch all subreddits ---
  // /api/reddit is Apify-first when APIFY_TOKEN is set (no OAuth), so 4-way
  // concurrency is safe — Apify manages its own rate limits and residential
  // proxy pool. The per-request retry/backoff inside /api/reddit covers the
  // rare 429 or timeout.
  const queries = (plan.queries || []).slice(0, maxQueriesPerSub);
  const concurrency = 4;
  const subQueue = [...allSubs];

  async function subWorker() {
    while (subQueue.length > 0) {
      const sub = subQueue.shift();
      if (!sub) break;
      diag.totalSubsFetched++;
      const label = queries.length > 0
        ? `r/${sub.replace(/^r\//, '')} :: ${queries.slice(0, 2).join(' | ')}`
        : `r/${sub.replace(/^r\//, '')} :: TOP`;
      queriesUsed.push(label);

      const posts = await fetchSubreddit(sub, queries, maxThreads, diag);
      for (const p of posts) {
        if (p.url && !seenUrls.has(p.url) && p.markdown && p.markdown.length >= 80) {
          seenUrls.add(p.url);
          allPosts.push(p);
        }
      }
    }
  }

  const subWorkers = Array.from({ length: Math.min(concurrency, allSubs.length) }, subWorker);
  await Promise.all(subWorkers);

  // --- Phase 3: Global Reddit searches for broader coverage ---
  const globalQueries = (plan.queries || []).slice(0, preset.globalSearches);
  if (globalQueries.length > 0) {
    diag.globalSearches = globalQueries.length;
    const globalConcurrency = 3;
    const gQueue = [...globalQueries];

    async function globalWorker() {
      while (gQueue.length > 0) {
        const q = gQueue.shift();
        if (!q) break;
        queriesUsed.push(`GLOBAL: ${q}`);
        const posts = await globalSearch(q, preset.globalSearchLimit, 15, diag);
        for (const p of posts) {
          if (p.url && !seenUrls.has(p.url) && p.markdown && p.markdown.length >= 80) {
            seenUrls.add(p.url);
            allPosts.push(p);
          }
        }
      }
    }

    const gWorkers = Array.from({ length: Math.min(globalConcurrency, globalQueries.length) }, globalWorker);
    await Promise.all(gWorkers);
  }

  // --- Build output ---
  diag.totalPosts = allPosts.length;

  const items = allPosts.map(p =>
    toRawItem('reddit', p.url, p.markdown, {
      title: p.title,
      metadata: {
        subreddit: p.subreddit,
        score: p.score,
        num_comments: p.numComments,
      },
    }),
  );

  let error: string | undefined;
  if (items.length === 0) {
    const parts: string[] = [
      `Reddit: 0 items from ${allSubs.length} subs (${diag.plannedSubs} planned + ${diag.discoveredSubs} discovered).`,
    ];
    if (diag.failures > 0) {
      parts.push(`${diag.failures} fetch failures.`);
    }
    if (diag.lastError) parts.push(`Last error: ${diag.lastError}`);
    parts.push(
      'Possible causes: Reddit blocking Vercel IPs (check Apify token), queries too narrow, or niche has no Reddit presence.',
    );
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
