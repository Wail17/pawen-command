// ============================================================
// PAWEN — Phase U.4 — Reddit OAuth adapter (secondary social)
//
// Free tier: 100 req/min. Used for low-volume queries and to
// complement Bright Data on the Reddit platform.
//
// Env:
//   REDDIT_CLIENT_ID
//   REDDIT_CLIENT_SECRET
//   REDDIT_USER_AGENT (optional — defaults to web:pawen:v1 (by /u/pawen_bot))
// ============================================================

import 'server-only';
import type { SocialProvider, SocialResult, SocialFetchOptions, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

const UA = () => requireEnv('REDDIT_USER_AGENT') ?? 'web:pawen-command-center:v1.0 (by /u/pawen_bot)';

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  const clientId = requireEnv('REDDIT_CLIENT_ID');
  const clientSecret = requireEnv('REDDIT_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetchWithTimeout('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA(),
    },
    body: 'grant_type=client_credentials',
    timeoutMs: 10_000,
  });
  if (!res || !res.ok) return null;
  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  tokenCache = { token: data.access_token, expiresAt: now + (data.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

interface RedditListingPostData {
  permalink: string;
  url: string;
  title: string;
  selftext: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
  author: string;
}

export class RedditOAuthAdapter implements SocialProvider {
  id = 'reddit-oauth';
  priority = 2;                       // secondary — Bright Data primary for high volume
  supports: SocialFetchOptions['platform'][] = ['reddit'];

  async fetch(query: string, opts: SocialFetchOptions): Promise<SocialResult[]> {
    if (opts.platform !== 'reddit') return [];
    const token = await getToken();
    if (!token) throw new ProviderError('Reddit OAuth unavailable (REDDIT_CLIENT_ID/SECRET missing)', this.id);

    const limit = Math.min(opts.maxThreads ?? 15, 100);
    const subs = opts.subreddits && opts.subreddits.length > 0
      ? opts.subreddits.map(s => s.replace(/^r\//, ''))
      : [];

    const posts: SocialResult[] = [];
    const seen = new Set<string>();

    const searchOne = async (path: string, params: Record<string, string>) => {
      const url = `https://oauth.reddit.com${path}?${new URLSearchParams(params).toString()}`;
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': UA() },
        timeoutMs: 15_000,
      });
      if (!res || !res.ok) return;
      const data = await res.json() as { data?: { children?: Array<{ data: RedditListingPostData }> } };
      for (const c of data.data?.children ?? []) {
        const p = c.data;
        if (seen.has(p.permalink)) continue;
        seen.add(p.permalink);
        posts.push({
          url: `https://www.reddit.com${p.permalink}`,
          title: p.title,
          content: p.selftext || p.title,
          author: p.author,
          score: p.score,
          commentCount: p.num_comments,
          subreddit: p.subreddit,
          publishedAt: new Date(p.created_utc * 1000).toISOString(),
          platform: 'reddit',
          fetchedAt: nowIso(),
          providerId: this.id,
        });
      }
    };

    if (subs.length > 0) {
      for (const sub of subs.slice(0, 10)) {
        await searchOne(`/r/${sub}/search`, {
          q: query, restrict_sr: 'on', sort: 'relevance',
          limit: String(Math.ceil(limit / subs.length)),
        });
      }
    } else {
      await searchOne('/search', { q: query, sort: 'relevance', limit: String(limit) });
    }

    // Hydrate comments for top-scoring posts
    if (opts.deepComments !== false) {
      const top = posts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
      for (const p of top) {
        try {
          const res = await fetchWithTimeout(
            `https://oauth.reddit.com/comments/${p.url.split('/comments/')[1]?.split('/')[0]}?limit=50`,
            { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': UA() }, timeoutMs: 10_000 },
          );
          if (!res || !res.ok) continue;
          type CommentListing = { data?: { children?: Array<{ data: { body?: string; author?: string; score?: number } }> } };
          const data = (await res.json()) as CommentListing[];
          const comments = (data[1]?.data?.children ?? [])
            .map(c => c.data)
            .filter(c => c.body && c.body !== '[removed]' && c.body !== '[deleted]')
            .slice(0, opts.maxCommentsPerThread ?? 30)
            .map(c => ({ text: c.body!, author: c.author, score: c.score }));
          p.comments = comments;
        } catch { /* skip */ }
      }
    }

    return posts.slice(0, limit);
  }

  async isHealthy(): Promise<ProviderHealth> {
    return missingEnvHealth(this.id, ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET']);
  }
}
