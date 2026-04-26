// ============================================================
// PAWEN — Bright Data Reddit adapter (posts + comments)
//
// Two datasets:
//   BRIGHTDATA_DATASET_ID_REDDIT_POSTS    → search/discover threads
//   BRIGHTDATA_DATASET_ID_REDDIT_COMMENTS → fetch full comment trees
//
// We trigger the POSTS dataset on a search URL, then for the top N
// returned posts, trigger the COMMENTS dataset to pull the full
// thread. Comments get folded back into the SocialResult.
// ============================================================

import 'server-only';
import type { SocialProvider, SocialResult, SocialFetchOptions, ProviderHealth } from './types';
import { brightDataCollect, brightDataHealth, BD_NOW } from './brightDataCommon';
import { requireEnv } from './common';

interface RedditPostRow {
  // Confirmed schema from live Bright Data response (2026-04-26):
  url?: string;
  post_id?: string;
  title?: string;
  description?: string;       // post body (often null for link/video posts)
  community_name?: string;    // subreddit name (NOT `subreddit`)
  user_posted?: string;       // author username (NOT `author`)
  num_upvotes?: number;       // score (NOT `score`)
  num_comments?: number;
  date_posted?: string;       // ISO timestamp (NOT `created_utc` epoch)
}
interface RedditCommentRow {
  // Confirmed schema from live Bright Data response (2026-04-25):
  url?: string;             // url of the comment itself
  post_url?: string;        // parent post URL — what we link by
  comment_id?: string;
  comment?: string;         // the actual text (NOT `body`)
  user_posted?: string;     // author username (NOT `author`)
  num_upvotes?: number;     // score (NOT `score`)
  date_posted?: string;
  parent_comment_id?: string;
  root_comment_id?: string;
}

const POSTS_DEFAULT = 'gd_lvz8ah06191smkebj4';
const COMMENTS_DEFAULT = 'gd_lvzdpsdlw09j6t702';

export class BrightDataRedditAdapter implements SocialProvider {
  id = 'brightdata-reddit';
  priority = 1;
  supports: SocialFetchOptions['platform'][] = ['reddit'];

  async fetch(query: string, opts: SocialFetchOptions): Promise<SocialResult[]> {
    if (opts.platform !== 'reddit') return [];

    const postsId = requireEnv('BRIGHTDATA_DATASET_ID_REDDIT_POSTS') ?? POSTS_DEFAULT;
    const limit = opts.maxThreads ?? 20;
    const subs = (opts.subreddits ?? []).map(s => s.replace(/^r\//, ''));

    // For URL-based discovery (search inside specific subreddit), Bright Data
    // expects discover_by=subreddit_url with [{url, num_of_posts}].
    // For keyword discovery (no subreddit list), discover_by=keyword with
    // [{keyword, num_of_posts}]. Pick whichever fits the input shape.
    const useSubredditUrls = subs.length > 0;
    let triggers: unknown;
    let discoverBy: string;
    if (useSubredditUrls) {
      triggers = subs.slice(0, 6).map(sub => ({
        url: `https://www.reddit.com/r/${sub}/search/?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance`,
        num_of_posts: limit,
      }));
      discoverBy = 'subreddit_url';
    } else {
      // BD's keyword discover requires `date` and `sort_by` — without them
      // the trigger fails with HTTP 400 "validation_error". Confirmed
      // 2026-04-26 against gd_lvz8ah06191smkebj4.
      triggers = [{ keyword: query, num_of_posts: limit, date: 'All time', sort_by: 'Hot' }];
      discoverBy = 'keyword';
    }

    const postRows = await brightDataCollect<RedditPostRow>({
      providerId: this.id,
      datasetId: postsId,
      inputs: triggers,
      discoverBy,
    });

    const posts: SocialResult[] = [];
    for (const r of postRows.slice(0, limit)) {
      if (!r.url) continue;
      posts.push({
        url: r.url,
        title: r.title,
        content: (r.description ?? r.title ?? '').slice(0, 8000),
        author: r.user_posted,
        score: r.num_upvotes,
        commentCount: r.num_comments,
        subreddit: r.community_name,
        publishedAt: r.date_posted ?? undefined,
        platform: 'reddit',
        comments: [],
        metadata: { post_id: r.post_id },
        fetchedAt: BD_NOW(),
        providerId: this.id,
      });
    }

    // Hydrate comments for the top-scoring posts.
    // HARD BUDGET CAPS — every constant here is a money-saver:
    //   - Skip if BRIGHTDATA_DISABLE_REDDIT_COMMENTS=1 (kill switch)
    //   - Cap to top 3 posts (was 5) → ≤ ~150 records per run, ~$0.25
    //   - Filter out megathreads (commentCount > 2000) — those alone can be
    //     5k+ records each and balloon the bill on r/AskReddit-style URLs.
    if (opts.deepComments !== false && posts.length > 0 && process.env.BRIGHTDATA_DISABLE_REDDIT_COMMENTS !== '1') {
      const commentsId = requireEnv('BRIGHTDATA_DATASET_ID_REDDIT_COMMENTS') ?? COMMENTS_DEFAULT;
      const top = posts
        .slice()
        .filter(p => (p.commentCount ?? 0) <= 2000)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 3);
      try {
        const commentInputs = top.map(p => ({ url: p.url }));
        const commentRows = await brightDataCollect<RedditCommentRow>({
          providerId: this.id,
          datasetId: commentsId,
          inputs: commentInputs,
          type: 'url_collection',
        });
        // Surface cost: BD bills $1.50/1000 records — log loudly.
        const estCost = (commentRows.length / 1000) * 1.5;
        console.log(`[brightdata-reddit] comments: ${commentRows.length} rows for ${top.length} posts (~$${estCost.toFixed(3)} BD cost)`);
        if (commentRows.length > 5000) {
          console.warn(`[brightdata-reddit] WARN: ${commentRows.length} comment rows is unusually high — investigate input post selection`);
        }
        // Group by parent post URL — Bright Data field is `post_url`
        const byPost = new Map<string, RedditCommentRow[]>();
        for (const c of commentRows) {
          const key = c.post_url ?? '';
          if (!key) continue;
          const arr = byPost.get(key) ?? [];
          arr.push(c);
          byPost.set(key, arr);
        }
        for (const p of posts) {
          const matched = byPost.get(p.url) ?? [];
          p.comments = matched.slice(0, opts.maxCommentsPerThread ?? 50)
            .filter(c => c.comment && c.comment !== '[removed]' && c.comment !== '[deleted]')
            .map(c => ({ text: c.comment!, author: c.user_posted, score: c.num_upvotes }));
        }
      } catch (e) {
        // Log but don't fail the whole fetch — posts without comments still useful.
        console.error(`[brightdata-reddit] comments hydration error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return posts;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}
