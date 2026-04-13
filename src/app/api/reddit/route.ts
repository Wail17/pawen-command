// ============================================================
// PAWEN — /api/reddit — Reddit scraper (Apify)
//
// Reddit hard-blocks all Vercel datacenter IPs with CloudFlare 403,
// regardless of User-Agent. Direct `fetch('https://reddit.com/...')`
// from a serverless function is dead. We route through Apify's
// `trudax/reddit-scraper-lite` actor which uses residential proxies.
// Single batch call per subreddit returns N posts + M comments as a
// mixed stream keyed by dataType.
//
// MODE:
//   { mode: "subreddit", subreddit: "insomnia", queries: ["can't sleep"],
//     limit: 10 }
//     → returns { posts: [{ url, title, markdown, subreddit, score, numComments }] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

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
  parentId?: string;
  body?: string;
  username?: string;
  upVotes?: number;
}

type ApifyRedditItem = ApifyRedditPost | ApifyRedditComment | { dataType?: string };

async function handleSubredditViaApify(
  subreddit: string,
  queries: string[],
  limit: number,
  sort: 'relevance' | 'top' | 'new' | 'hot',
): Promise<NextResponse> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: 'APIFY_TOKEN not configured on server', posts: [] },
      { status: 500 },
    );
  }

  const cleanSub = subreddit.replace(/^r\//, '');
  // Actor returns a mixed stream: 1 community entry, N posts, M comments (as
  // separate top-level items keyed to postId). maxItems is the overall cap;
  // we need headroom for comments too. Budget: 1 community + limit posts +
  // ~12 comments per post.
  const postBudget = limit;
  const commentsPerPost = 12;
  const maxItems = 1 + postBudget + postBudget * commentsPerPost;
  const input = {
    startUrls: [{ url: `https://www.reddit.com/r/${cleanSub}/` }],
    searches: queries.filter(Boolean),
    skipComments: false,
    maxItems,
    maxPostCount: postBudget,
    maxComments: commentsPerPost,
    maxCommunitiesAndUsers: 1,
    type: 'posts',
    sort,
    time: 'year',
    includeNSFW: false,
    proxy: { useApifyProxy: true },
    debugMode: false,
  };

  const runUrl =
    `https://api.apify.com/v2/acts/trudax~reddit-scraper-lite/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180`;

  try {
    const res = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(200_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Apify HTTP ${res.status}: ${text.slice(0, 300)}`, posts: [] },
        { status: 502 },
      );
    }

    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: 'Apify returned non-array', posts: [] }, { status: 502 });
    }

    const items = raw as ApifyRedditItem[];

    // Split into posts and comments, then group comments by their postId so
    // each post gets its own comment bucket.
    const rawPosts = items.filter(
      (it): it is ApifyRedditPost => it.dataType === 'post',
    );
    const rawComments = items.filter(
      (it): it is ApifyRedditComment => it.dataType === 'comment',
    );

    const commentsByPostId = new Map<string, ApifyRedditComment[]>();
    for (const c of rawComments) {
      if (!c.postId) continue;
      const bucket = commentsByPostId.get(c.postId) ?? [];
      bucket.push(c);
      commentsByPostId.set(c.postId, bucket);
    }

    const posts = rawPosts
      .filter((p) => Boolean(p.url) && Boolean(p.id))
      .map((p) => {
        const title = p.title ?? '';
        const body = (p.body ?? '').trim();
        const communityLabel = (p.communityName ?? `r/${cleanSub}`).replace(/^r\//, '');
        const score = p.upVotes ?? 0;
        const numComments = p.numberOfComments ?? 0;

        // Match comments to this post via postId.
        const relatedComments = commentsByPostId.get(p.id!) ?? [];
        const commentLines = relatedComments
          .map((c) => (c.body ?? '').trim())
          .filter(
            (text) =>
              text &&
              text.length > 20 &&
              text !== '[deleted]' &&
              text !== '[removed]' &&
              // Drop AutoModerator boilerplate which dominates many subs.
              !text.startsWith('Welcome to r/') &&
              !text.includes('I am a bot, and this action was performed automatically'),
          )
          .slice(0, 60)
          .map((text) => `- ${text}`);

        const markdown = [
          `# ${title}`,
          `*r/${communityLabel} · ${score} upvotes · ${numComments} comments*`,
          '',
          body || '_(no body)_',
          '',
          '## Comments',
          commentLines.length > 0 ? commentLines.join('\n') : '_(no top comments)_',
        ].join('\n');

        return {
          url: p.url!,
          title,
          markdown,
          subreddit: communityLabel,
          score,
          numComments,
        };
      });

    return NextResponse.json({ posts, count: posts.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Apify fetch threw: ${msg}`, posts: [] }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  try {
    const body = await req.json();
    if (body.mode !== 'subreddit') {
      return NextResponse.json({ error: 'Unknown mode. Use subreddit.' }, { status: 400 });
    }
    if (!body.subreddit) {
      return NextResponse.json({ error: 'subreddit required' }, { status: 400 });
    }
    const queries = Array.isArray(body.queries) ? (body.queries as string[]) : [];
    const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 50);
    const sort = queries.length > 0 ? 'relevance' : 'top';
    return await handleSubredditViaApify(body.subreddit, queries, limit, sort);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
