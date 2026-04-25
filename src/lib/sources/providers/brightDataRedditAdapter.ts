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
  url?: string;
  post_id?: string;
  title?: string;
  text?: string;
  description?: string;
  subreddit?: string;
  author?: string;
  score?: number;
  num_comments?: number;
  created_utc?: number;
  posted_at?: string;
}
interface RedditCommentRow {
  url?: string;
  parent_url?: string;
  body?: string;
  author?: string;
  score?: number;
  created_utc?: number;
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
      triggers = [{ keyword: query, num_of_posts: limit, language: opts.language }];
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
        content: (r.text ?? r.description ?? r.title ?? '').slice(0, 8000),
        author: r.author,
        score: r.score,
        commentCount: r.num_comments,
        subreddit: r.subreddit,
        publishedAt: r.created_utc
          ? new Date(r.created_utc * 1000).toISOString()
          : (r.posted_at ?? undefined),
        platform: 'reddit',
        comments: [],
        metadata: { post_id: r.post_id },
        fetchedAt: BD_NOW(),
        providerId: this.id,
      });
    }

    // Hydrate comments for the top-scoring posts
    if (opts.deepComments !== false && posts.length > 0) {
      const commentsId = requireEnv('BRIGHTDATA_DATASET_ID_REDDIT_COMMENTS') ?? COMMENTS_DEFAULT;
      const top = posts.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
      try {
        const commentInputs = top.map(p => ({ url: p.url }));
        const commentRows = await brightDataCollect<RedditCommentRow>({
          providerId: this.id,
          datasetId: commentsId,
          inputs: commentInputs,
          discoverBy: 'post_url',
        });
        // Group by parent post URL
        const byPost = new Map<string, RedditCommentRow[]>();
        for (const c of commentRows) {
          const key = c.parent_url ?? c.url ?? '';
          if (!key) continue;
          const arr = byPost.get(key) ?? [];
          arr.push(c);
          byPost.set(key, arr);
        }
        for (const p of posts) {
          const matched = byPost.get(p.url) ?? [];
          p.comments = matched.slice(0, opts.maxCommentsPerThread ?? 50)
            .filter(c => c.body && c.body !== '[removed]' && c.body !== '[deleted]')
            .map(c => ({ text: c.body!, author: c.author, score: c.score }));
        }
      } catch {
        // Silent — posts without comments still useful.
      }
    }

    return posts;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}
