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
  url?: string;
  post_id?: string;
  description?: string;
  caption?: string;
  author?: string;
  user_unique_id?: string;
  play_count?: number;
  like_count?: number;
  digg_count?: number;
  comment_count?: number;
  share_count?: number;
  hashtags?: string[];
  posted_at?: string;
  create_time?: string;
}
interface TikTokCommentRow {
  parent_url?: string;
  url?: string;
  text?: string;
  comment_text?: string;
  user?: string;
  like_count?: number;
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

    const url = opts.mode === 'hashtag'
      ? `https://www.tiktok.com/tag/${encodeURIComponent(query.replace(/^#/, ''))}`
      : `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;

    const inputs = [{ url, num_of_posts: maxVideos, language: opts.language }];

    const postRows = await brightDataCollect<TikTokPostRow>({
      providerId: this.id,
      datasetId: postsId,
      inputs,
    });

    const videos: VideoResult[] = [];
    for (const r of postRows.slice(0, maxVideos)) {
      const videoUrl = r.url;
      if (!videoUrl) continue;
      const videoId = r.post_id ?? videoUrl.split('/').pop() ?? '';
      videos.push({
        url: videoUrl,
        videoId,
        title: (r.description ?? r.caption ?? '').slice(0, 120),
        content: r.description ?? r.caption ?? '',
        platform: 'tiktok',
        caption: r.description ?? r.caption,
        author: r.user_unique_id ?? r.author,
        playCount: r.play_count,
        likeCount: r.like_count ?? r.digg_count,
        commentCount: r.comment_count,
        hashtags: r.hashtags,
        comments: [],
        publishedAt: r.posted_at ?? r.create_time,
        fetchedAt: BD_NOW(),
        providerId: this.id,
      });
    }

    // Pull comments for the top videos (up to 8 to keep cost bounded)
    if (videos.length > 0) {
      const commentsId = requireEnv('BRIGHTDATA_DATASET_ID_TIKTOK_COMMENTS') ?? COMMENTS_DEFAULT;
      const top = videos.slice(0, 8);
      try {
        const inputs = top.map(v => ({ url: v.url, num_of_comments: opts.maxCommentsPerVideo ?? 30 }));
        const commentRows = await brightDataCollect<TikTokCommentRow>({
          providerId: this.id,
          datasetId: commentsId,
          inputs,
        });
        const byVideo = new Map<string, TikTokCommentRow[]>();
        for (const c of commentRows) {
          const key = c.parent_url ?? '';
          if (!key) continue;
          const arr = byVideo.get(key) ?? [];
          arr.push(c);
          byVideo.set(key, arr);
        }
        for (const v of videos) {
          const list = (byVideo.get(v.url) ?? []).slice(0, opts.maxCommentsPerVideo ?? 30);
          v.comments = list.map(c => ({ text: c.text ?? c.comment_text ?? '', likes: c.like_count, author: c.user }));
        }
      } catch { /* silent */ }
    }

    return videos;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}
