// ============================================================
// PAWEN — /api/reddit — Reddit Deep Scraper (v4 — Native + Apify)
//
// TWO MODES:
//   1. Native Reddit JSON API (.json suffix) — free, fast, no auth
//   2. Apify fallback if Reddit blocks (CloudFlare 403)
//
// ENDPOINTS:
//   mode: "subreddit"  — search a subreddit for posts + all comments
//   mode: "search"     — search ALL of Reddit for a query
//   mode: "discover"   — find relevant subreddits for a topic
//   mode: "deep_thread"— fetch ALL comments from a specific thread
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 120;

const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT?.trim()
  || 'web:pawen-command-center:v1.0 (by /u/pawen_bot)';

// ---- OAuth2 app-only token cache (free tier: 100 req/min) ----
// Register app at https://www.reddit.com/prefs/apps (type: "script" or "web app")
// Set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET in Vercel env.
// Without them we fall back to unauthed public JSON (blocked from Vercel) → Apify.

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_USER_AGENT,
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in ?? 3600) * 1000,
    };
    return cachedToken.token;
  } catch {
    return null;
  }
}

// Convert a public reddit.com URL to the authenticated oauth.reddit.com equivalent
function toOAuthUrl(url: string): string {
  return url
    .replace('https://www.reddit.com', 'https://oauth.reddit.com')
    .replace('https://old.reddit.com', 'https://oauth.reddit.com');
}

// --------------- Reddit Native JSON API ---------------

interface RedditPost {
  url: string;
  permalink: string;
  title: string;
  selftext: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
  author: string;
}

interface RedditComment {
  body: string;
  author: string;
  score: number;
  replies?: { data?: { children?: RedditCommentChild[] } };
}

interface RedditCommentChild {
  kind: string;
  data: RedditComment;
}

// Recursively extract ALL comments from a comment tree
function flattenComments(children: RedditCommentChild[], depth = 0, max = 500): string[] {
  const results: string[] = [];
  if (depth > 15 || results.length >= max) return results;

  for (const child of children) {
    if (results.length >= max) break;
    if (child.kind !== 't1') continue;
    const c = child.data;
    if (!c.body || c.body === '[deleted]' || c.body === '[removed]') continue;
    if (c.author === 'AutoModerator') continue;
    if (c.body.includes('I am a bot, and this action was performed automatically')) continue;

    const text = c.body.trim();
    if (text.length > 15) {
      results.push(text);
    }

    // Recurse into replies
    if (c.replies?.data?.children) {
      const nested = flattenComments(c.replies.data.children, depth + 1, max - results.length);
      results.push(...nested);
    }
  }
  return results;
}

// Fetch JSON from Reddit with 3-tier strategy (free):
//   1. OAuth2 app-only via oauth.reddit.com (if REDDIT_CLIENT_ID+SECRET set)
//   2. old.reddit.com .json (often less aggressive CF blocking)
//   3. www.reddit.com .json (last resort, usually blocked from cloud IPs)
async function redditFetch(url: string, retries = 2): Promise<unknown | null> {
  const token = await getRedditToken();

  // Build fetch attempts in priority order
  const attempts: Array<{ url: string; headers: Record<string, string> }> = [];
  if (token) {
    attempts.push({
      url: toOAuthUrl(url),
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': REDDIT_USER_AGENT,
        Accept: 'application/json',
      },
    });
  }
  // Try old.reddit.com before www — less CF-protected
  if (url.includes('www.reddit.com')) {
    attempts.push({
      url: url.replace('www.reddit.com', 'old.reddit.com'),
      headers: { 'User-Agent': REDDIT_USER_AGENT, Accept: 'application/json' },
    });
  }
  attempts.push({
    url,
    headers: { 'User-Agent': REDDIT_USER_AGENT, Accept: 'application/json' },
  });

  for (const attempt of attempts) {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(attempt.url, {
          headers: attempt.headers,
          signal: AbortSignal.timeout(15_000),
        });
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 2000 * (i + 1)));
          continue;
        }
        if (res.status === 401 && cachedToken) {
          // Token expired mid-flight — clear cache, next call refreshes
          cachedToken = null;
          break;
        }
        if (!res.ok) break; // try next attempt
        return await res.json();
      } catch {
        if (i < retries) {
          await new Promise(r => setTimeout(r, 500 * (i + 1)));
          continue;
        }
      }
    }
  }
  return null;
}

// Search within a subreddit
async function searchSubreddit(
  subreddit: string,
  query: string,
  sort: string = 'relevance',
  limit: number = 25,
): Promise<RedditPost[]> {
  const clean = subreddit.replace(/^r\//, '');
  const url = `https://www.reddit.com/r/${encodeURIComponent(clean)}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=${sort}&t=all&limit=${limit}`;
  const data = await redditFetch(url);
  if (!data || typeof data !== 'object') return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing = data as any;
  const children = listing?.data?.children ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return children.map((c: any) => ({
    url: `https://www.reddit.com${c.data.permalink}`,
    permalink: c.data.permalink,
    title: c.data.title ?? '',
    selftext: c.data.selftext ?? '',
    subreddit: c.data.subreddit ?? clean,
    score: c.data.score ?? 0,
    num_comments: c.data.num_comments ?? 0,
    created_utc: c.data.created_utc ?? 0,
    author: c.data.author ?? '',
  }));
}

// Get top/hot posts from a subreddit
async function getSubredditPosts(
  subreddit: string,
  sort: string = 'top',
  limit: number = 25,
): Promise<RedditPost[]> {
  const clean = subreddit.replace(/^r\//, '');
  const url = `https://www.reddit.com/r/${encodeURIComponent(clean)}/${sort}.json?t=year&limit=${limit}`;
  const data = await redditFetch(url);
  if (!data || typeof data !== 'object') return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing = data as any;
  const children = listing?.data?.children ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return children.map((c: any) => ({
    url: `https://www.reddit.com${c.data.permalink}`,
    permalink: c.data.permalink,
    title: c.data.title ?? '',
    selftext: c.data.selftext ?? '',
    subreddit: c.data.subreddit ?? clean,
    score: c.data.score ?? 0,
    num_comments: c.data.num_comments ?? 0,
    created_utc: c.data.created_utc ?? 0,
    author: c.data.author ?? '',
  }));
}

// Search ALL of Reddit
async function searchAllReddit(
  query: string,
  sort: string = 'relevance',
  limit: number = 50,
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=${sort}&t=all&limit=${limit}`;
  const data = await redditFetch(url);
  if (!data || typeof data !== 'object') return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing = data as any;
  const children = listing?.data?.children ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return children.map((c: any) => ({
    url: `https://www.reddit.com${c.data.permalink}`,
    permalink: c.data.permalink,
    title: c.data.title ?? '',
    selftext: c.data.selftext ?? '',
    subreddit: c.data.subreddit ?? '',
    score: c.data.score ?? 0,
    num_comments: c.data.num_comments ?? 0,
    created_utc: c.data.created_utc ?? 0,
    author: c.data.author ?? '',
  }));
}

// Fetch ALL comments from a thread (deep tree)
async function fetchThreadComments(permalink: string): Promise<string[]> {
  // Remove trailing slash if present, add .json
  const cleanPermalink = permalink.replace(/\/$/, '');
  const url = `https://www.reddit.com${cleanPermalink}.json?limit=500&depth=20&sort=top`;
  const data = await redditFetch(url);
  if (!Array.isArray(data) || data.length < 2) return [];
  const commentListing = data[1];
  const children = commentListing?.data?.children ?? [];
  return flattenComments(children);
}

// Discover subreddits for a topic
async function discoverSubreddits(query: string, limit: number = 25): Promise<Array<{
  name: string;
  subscribers: number;
  description: string;
}>> {
  const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await redditFetch(url);
  if (!data || typeof data !== 'object') return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing = data as any;
  const children = listing?.data?.children ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return children.map((c: any) => ({
    name: c.data.display_name ?? '',
    subscribers: c.data.subscribers ?? 0,
    description: (c.data.public_description ?? '').slice(0, 200),
  })).filter((s: { name: string }) => s.name);
}

// --------------- Apify Fallback ---------------

interface ApifyRedditPost {
  dataType?: 'post';
  id?: string;
  url?: string;
  title?: string;
  body?: string;
  communityName?: string;
  upVotes?: number;
  numberOfComments?: number;
}

interface ApifyRedditComment {
  dataType?: 'comment';
  id?: string;
  postId?: string;
  body?: string;
  upVotes?: number;
}

type ApifyRedditItem = ApifyRedditPost | ApifyRedditComment | { dataType?: string };

async function apifyFallback(
  subreddit: string | null,
  queries: string[],
  limit: number,
): Promise<{ posts: OutputPost[]; error?: string }> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) return { posts: [], error: 'APIFY_TOKEN not configured' };

  const cleanSub = subreddit ? subreddit.replace(/^r\//, '') : null;
  const maxComments = 50;
  const maxItems = 1 + limit + limit * maxComments;
  const input: Record<string, unknown> = {
    searches: queries.filter(Boolean),
    skipComments: false,
    maxItems,
    maxPostCount: limit,
    maxComments,
    maxCommunitiesAndUsers: 1,
    type: 'posts',
    sort: queries.length > 0 ? 'relevance' : 'top',
    time: 'year',
    includeNSFW: false,
    proxy: { useApifyProxy: true },
  };
  if (cleanSub) {
    input.startUrls = [{ url: `https://www.reddit.com/r/${cleanSub}/` }];
  } else {
    // Global search (no specific subreddit) — point Apify at Reddit search URLs
    input.startUrls = queries.filter(Boolean).slice(0, 5).map(q => ({
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(q)}&sort=relevance&t=year`,
    }));
  }

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(200_000),
      },
    );
    if (!res.ok) return { posts: [], error: `Apify HTTP ${res.status}` };

    const raw = await res.json();
    if (!Array.isArray(raw)) return { posts: [], error: 'Apify non-array' };

    const items = raw as ApifyRedditItem[];
    const rawPosts = items.filter((it): it is ApifyRedditPost => it.dataType === 'post');
    const rawComments = items.filter((it): it is ApifyRedditComment => it.dataType === 'comment');

    const commentsByPostId = new Map<string, string[]>();
    for (const c of rawComments) {
      if (!c.postId || !c.body) continue;
      const text = c.body.trim();
      if (text.length < 20 || text === '[deleted]' || text === '[removed]') continue;
      const bucket = commentsByPostId.get(c.postId) ?? [];
      bucket.push(text);
      commentsByPostId.set(c.postId, bucket);
    }

    const posts: OutputPost[] = rawPosts
      .filter(p => p.url && p.id)
      .map(p => {
        const comments = commentsByPostId.get(p.id!) ?? [];
        return {
          url: p.url!,
          title: p.title ?? '',
          selftext: p.body ?? '',
          subreddit: (p.communityName ?? cleanSub ?? '').replace(/^r\//, ''),
          score: p.upVotes ?? 0,
          numComments: p.numberOfComments ?? 0,
          comments,
          commentCount: comments.length,
        };
      });

    return { posts };
  } catch (e) {
    return { posts: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// --------------- Output format ---------------

interface OutputPost {
  url: string;
  title: string;
  selftext: string;
  subreddit: string;
  score: number;
  numComments: number;
  comments: string[];
  commentCount: number;
  markdown?: string;
}

function buildMarkdown(post: OutputPost): string {
  const commentLines = post.comments
    .slice(0, 100)
    .map(c => `- ${c.replace(/\n/g, ' ').slice(0, 500)}`);

  return [
    `# ${post.title}`,
    `*r/${post.subreddit} · ${post.score} upvotes · ${post.numComments} comments*`,
    '',
    post.selftext || '_(no body)_',
    '',
    `## Comments (${post.commentCount} extracted)`,
    commentLines.length > 0 ? commentLines.join('\n') : '_(no comments)_',
  ].join('\n');
}

// --------------- Route Handler ---------------

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const body = await req.json();
  const mode = body.mode;

  // ---- MODE: discover — find subreddits for a topic ----
  if (mode === 'discover') {
    const query = body.query;
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
    const limit = Math.min(body.limit ?? 25, 50);
    const subs = await discoverSubreddits(query, limit);
    return NextResponse.json({ subreddits: subs, count: subs.length });
  }

  // ---- MODE: search — search ALL of Reddit ----
  if (mode === 'search') {
    const query = body.query;
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
    const limit = Math.min(body.limit ?? 50, 100);
    const sort = body.sort ?? 'relevance';
    const fetchComments = body.fetch_comments !== false;

    // Apify-first: Reddit's public JSON is blocked by Cloudflare on Vercel egress
    // and self-service API keys are gated since Nov 2025. If APIFY_TOKEN is set and
    // no Reddit OAuth credentials exist, go straight to Apify for reliability + scale.
    const hasApify = !!process.env.APIFY_TOKEN?.trim();
    const hasOAuth = !!(process.env.REDDIT_CLIENT_ID?.trim() && process.env.REDDIT_CLIENT_SECRET?.trim());
    const preferApify = hasApify && !hasOAuth;

    const posts = preferApify ? [] : await searchAllReddit(query, sort, limit);
    const usedApifyFallback = false;

    // If native API failed (CloudFlare block), fall back to Apify global search
    if (posts.length === 0) {
      const apifyResult = await apifyFallback(null, [query], limit);
      if (apifyResult.posts.length > 0) {
        const outputPosts = apifyResult.posts.map(p => {
          p.markdown = buildMarkdown(p);
          return p;
        });
        return NextResponse.json({
          posts: outputPosts.map(p => ({
            url: p.url,
            title: p.title,
            markdown: p.markdown,
            subreddit: p.subreddit,
            score: p.score,
            numComments: p.numComments,
          })),
          count: outputPosts.length,
          totalComments: outputPosts.reduce((sum, p) => sum + p.commentCount, 0),
          source: 'apify',
        });
      }
      return NextResponse.json({
        posts: [],
        count: 0,
        error: apifyResult.error || 'Native blocked, Apify returned 0',
        source: 'blocked',
      });
    }
    void usedApifyFallback;

    // Optionally fetch comments for top posts
    const outputPosts: OutputPost[] = [];
    if (fetchComments) {
      const topPosts = posts.sort((a, b) => b.num_comments - a.num_comments).slice(0, body.max_threads ?? 20);
      // Fetch comments in parallel, batches of 5 to respect rate limits
      for (let i = 0; i < topPosts.length; i += 5) {
        const batch = topPosts.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (p) => {
            const comments = await fetchThreadComments(p.permalink);
            return { post: p, comments };
          }),
        );
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const op: OutputPost = {
              url: r.value.post.url,
              title: r.value.post.title,
              selftext: r.value.post.selftext,
              subreddit: r.value.post.subreddit,
              score: r.value.post.score,
              numComments: r.value.post.num_comments,
              comments: r.value.comments,
              commentCount: r.value.comments.length,
            };
            op.markdown = buildMarkdown(op);
            outputPosts.push(op);
          }
        }
        // Small delay between batches to avoid rate limits
        if (i + 5 < topPosts.length) await new Promise(r => setTimeout(r, 500));
      }
    } else {
      // No comments, just return posts
      for (const p of posts) {
        outputPosts.push({
          url: p.url,
          title: p.title,
          selftext: p.selftext,
          subreddit: p.subreddit,
          score: p.score,
          numComments: p.num_comments,
          comments: [],
          commentCount: 0,
          markdown: `# ${p.title}\n*r/${p.subreddit} · ${p.score} upvotes*\n\n${p.selftext}`,
        });
      }
    }

    return NextResponse.json({
      posts: outputPosts,
      count: outputPosts.length,
      totalComments: outputPosts.reduce((sum, p) => sum + p.commentCount, 0),
      source: 'native',
    });
  }

  // ---- MODE: deep_thread — fetch ALL comments from a thread ----
  if (mode === 'deep_thread') {
    const permalink = body.permalink;
    if (!permalink) return NextResponse.json({ error: 'permalink required' }, { status: 400 });
    const comments = await fetchThreadComments(permalink);
    return NextResponse.json({ comments, count: comments.length });
  }

  // ---- MODE: subreddit — search within a subreddit (default, backward-compat) ----
  if (mode === 'subreddit') {
    const subreddit = body.subreddit;
    if (!subreddit) return NextResponse.json({ error: 'subreddit required' }, { status: 400 });
    const queries = Array.isArray(body.queries) ? (body.queries as string[]) : [];
    const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 50);
    const fetchDeepComments = body.deep_comments !== false;

    // Apify-first when we have the token but no OAuth creds (public JSON is
    // blocked by Cloudflare on Vercel — trying native first just wastes ~15s).
    const hasApify = !!process.env.APIFY_TOKEN?.trim();
    const hasOAuth = !!(process.env.REDDIT_CLIENT_ID?.trim() && process.env.REDDIT_CLIENT_SECRET?.trim());
    const preferApify = hasApify && !hasOAuth;

    let posts: RedditPost[] = [];
    if (!preferApify) {
      if (queries.length > 0) {
        for (const q of queries.slice(0, 5)) {
          const results = await searchSubreddit(subreddit, q, 'relevance', limit);
          posts.push(...results);
        }
      }
      if (posts.length < limit) {
        const topPosts = await getSubredditPosts(subreddit, 'top', limit);
        posts.push(...topPosts);
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    posts = posts.filter(p => {
      if (seen.has(p.url)) return false;
      seen.add(p.url);
      return true;
    });

    // If native API returned nothing, fall back to Apify
    if (posts.length === 0) {
      const apifyResult = await apifyFallback(subreddit, queries, limit);
      if (apifyResult.posts.length > 0) {
        const outputPosts = apifyResult.posts.map(p => {
          p.markdown = buildMarkdown(p);
          return p;
        });
        return NextResponse.json({
          posts: outputPosts.map(p => ({
            url: p.url,
            title: p.title,
            markdown: p.markdown,
            subreddit: p.subreddit,
            score: p.score,
            numComments: p.numComments,
          })),
          count: outputPosts.length,
          totalComments: outputPosts.reduce((sum, p) => sum + p.commentCount, 0),
          source: 'apify',
        });
      }
      return NextResponse.json({
        posts: [],
        count: 0,
        error: apifyResult.error || 'No results from native API or Apify',
        source: 'none',
      });
    }

    // Fetch deep comments for each post
    const outputPosts: OutputPost[] = [];
    if (fetchDeepComments) {
      // Sort by comment count, fetch comments for top posts
      const sorted = posts.sort((a, b) => b.num_comments - a.num_comments);
      for (let i = 0; i < sorted.length; i += 5) {
        const batch = sorted.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (p) => {
            const comments = await fetchThreadComments(p.permalink);
            return { post: p, comments };
          }),
        );
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const op: OutputPost = {
              url: r.value.post.url,
              title: r.value.post.title,
              selftext: r.value.post.selftext,
              subreddit: r.value.post.subreddit,
              score: r.value.post.score,
              numComments: r.value.post.num_comments,
              comments: r.value.comments,
              commentCount: r.value.comments.length,
            };
            op.markdown = buildMarkdown(op);
            outputPosts.push(op);
          }
        }
        if (i + 5 < sorted.length) await new Promise(r => setTimeout(r, 500));
      }
    } else {
      for (const p of posts) {
        outputPosts.push({
          url: p.url,
          title: p.title,
          selftext: p.selftext,
          subreddit: p.subreddit,
          score: p.score,
          numComments: p.num_comments,
          comments: [],
          commentCount: 0,
          markdown: `# ${p.title}\n*r/${p.subreddit} · ${p.score} upvotes*\n\n${p.selftext}`,
        });
      }
    }

    return NextResponse.json({
      posts: outputPosts.map(p => ({
        url: p.url,
        title: p.title,
        markdown: p.markdown,
        subreddit: p.subreddit,
        score: p.score,
        numComments: p.numComments,
      })),
      count: outputPosts.length,
      totalComments: outputPosts.reduce((sum, p) => sum + p.commentCount, 0),
      source: 'native',
    });
  }

  return NextResponse.json({ error: 'Unknown mode. Use: subreddit, search, discover, deep_thread' }, { status: 400 });
}
