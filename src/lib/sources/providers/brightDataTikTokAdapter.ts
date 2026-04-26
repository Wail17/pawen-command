// ============================================================
// PAWEN — Bright Data TikTok adapter (replaces TikAPI)
// Env: BRIGHTDATA_API_KEY,
//      BRIGHTDATA_DATASET_ID_TIKTOK_POSTS,
//      BRIGHTDATA_DATASET_ID_TIKTOK_COMMENTS
// ============================================================

import 'server-only';
import type { VideoProvider, VideoResult, VideoFetchOptions, ProviderHealth } from './types';
import { brightDataCollect, brightDataHealth, BD_NOW } from './brightDataCommon';
import { requireEnv } from './common';

interface TikTokPostRow {
  // Confirmed schema from live Bright Data probe (2026-04-26):
  url?: string;
  post_id?: string;
  description?: string;        // caption (NOT a separate `caption` field)
  profile_username?: string;   // author handle (NOT `author` / `user_unique_id`)
  digg_count?: number;         // likes (NOT `like_count`)
  play_count?: number;
  comment_count?: number;
  share_count?: number;
  hashtags?: string[];
  create_time?: string;        // ISO timestamp (NOT `posted_at`)
  is_verified?: boolean;
}
interface TikTokCommentRow {
  // Confirmed from BD docs (gd_lkf2st302ap89utw5k):
  // post_url, post_id, post_date_created, date_created, comment_text, num_likes,
  // num_replies, comment_id, comment_url, commenter_user_name, commenter_id, commenter_url
  post_url?: string;       // group by this
  post_id?: string;
  comment_text?: string;
  num_likes?: number;
  num_replies?: number;
  comment_id?: string;
  comment_url?: string;
  commenter_user_name?: string;
  commenter_id?: string;
  date_created?: string;
}

const POSTS_DEFAULT = 'gd_lu702nij2f790tmv9h';
const COMMENTS_DEFAULT = 'gd_lkf2st302ap89utw5k';

export class BrightDataTikTokAdapter implements VideoProvider {
  id = 'brightdata-tiktok';
  priority = 1;
  supports: VideoFetchOptions['platform'][] = ['tiktok'];

  async fetch(query: string, opts: VideoFetchOptions): Promise<VideoResult[]> {
    if (opts.platform !== 'tiktok') return [];
    const postsId = requireEnv('BRIGHTDATA_DATASET_ID_TIKTOK_POSTS') ?? POSTS_DEFAULT;
    const maxVideos = Math.min(opts.maxVideos ?? 25, 100);

    let inputs: unknown;
    let discoverBy: string;
    if (opts.mode === 'hashtag') {
      inputs = [{ url: `https://www.tiktok.com/tag/${encodeURIComponent(query.replace(/^#/, ''))}`, num_of_posts: maxVideos }];
      discoverBy = 'hashtag_url';
    } else {
      // TikTok posts dataset — only `search_keyword` + `num_of_posts` allowed.
      // `start_date`, `end_date`, `country` are rejected.
      inputs = [{ search_keyword: query, num_of_posts: maxVideos }];
      discoverBy = 'keyword';
    }

    const postRows = await brightDataCollect<TikTokPostRow>({
      providerId: this.id,
      datasetId: postsId,
      inputs,
      discoverBy,
    });

    const videos: VideoResult[] = [];
    for (const r of postRows.slice(0, maxVideos)) {
      const videoUrl = r.url;
      if (!videoUrl) continue;
      const videoId = r.post_id ?? videoUrl.split('/').pop() ?? '';
      videos.push({
        url: videoUrl,
        videoId,
        title: (r.description ?? '').slice(0, 120),
        content: r.description ?? '',
        platform: 'tiktok',
        caption: r.description,
        author: r.profile_username,
        playCount: r.play_count,
        likeCount: r.digg_count,
        commentCount: r.comment_count,
        hashtags: r.hashtags,
        comments: [],
        publishedAt: r.create_time,
        fetchedAt: BD_NOW(),
        providerId: this.id,
      });
    }

    // HARD BUDGET CAPS — TikTok megaposts can return 100k+ comments.
    //   - Cap to top 4 videos (was 8) by like count
    //   - Drop videos with likeCount > 1M (mega-virals → uncapped row count)
    //   - Kill switch BRIGHTDATA_DISABLE_TIKTOK_COMMENTS=1
    if (videos.length > 0 && process.env.BRIGHTDATA_DISABLE_TIKTOK_COMMENTS !== '1') {
      const commentsId = requireEnv('BRIGHTDATA_DATASET_ID_TIKTOK_COMMENTS') ?? COMMENTS_DEFAULT;
      const top = videos
        .filter(v => (v.likeCount ?? 0) <= 1_000_000)
        .slice()
        .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
        .slice(0, 4);
      try {
        const inputs = top.map(v => ({ url: v.url }));
        // TikTok comments dataset is also slow on cold start. Cap at 90s so
        // we don't blow the 300s route budget; videos still come back.
        const commentRows = await brightDataCollect<TikTokCommentRow>({
          providerId: this.id,
          datasetId: commentsId,
          inputs,
          type: 'url_collection',
          timeoutMs: 90_000,
        });
        const estCost = (commentRows.length / 1000) * 1.5;
        console.log(`[brightdata-tiktok] comments: ${commentRows.length} rows for ${top.length} videos (~$${estCost.toFixed(3)} BD cost)`);
        if (commentRows.length > 5000) {
          console.warn(`[brightdata-tiktok] WARN: ${commentRows.length} rows is unusually high — investigate filter`);
        }
        const byVideo = new Map<string, TikTokCommentRow[]>();
        for (const c of commentRows) {
          const key = c.post_url ?? '';
          if (!key) continue;
          const arr = byVideo.get(key) ?? [];
          arr.push(c);
          byVideo.set(key, arr);
        }
        for (const v of videos) {
          const list = (byVideo.get(v.url) ?? []).slice(0, opts.maxCommentsPerVideo ?? 30);
          v.comments = list
            .filter(c => c.comment_text)
            .map(c => ({ text: c.comment_text!, likes: c.num_likes, author: c.commenter_user_name }));
        }
      } catch (e) {
        console.error(`[brightdata-tiktok] comments fetch error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return videos;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}
