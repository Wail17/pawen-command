// ============================================================
// PAWEN — Bright Data Instagram adapter (new)
// Env: BRIGHTDATA_API_KEY,
//      BRIGHTDATA_DATASET_ID_INSTAGRAM_POSTS,
//      BRIGHTDATA_DATASET_ID_INSTAGRAM_REELS,
//      BRIGHTDATA_DATASET_ID_INSTAGRAM_COMMENTS,
//      BRIGHTDATA_DATASET_ID_INSTAGRAM_PROFILES (optional)
//
// Routed under VideoProvider with platform='instagram'. Treats reels
// + posts symmetrically — both surface as VideoResult.
// ============================================================

import 'server-only';
import type { VideoProvider, VideoResult, VideoFetchOptions, ProviderHealth } from './types';
import { brightDataCollect, brightDataHealth, BD_NOW } from './brightDataCommon';
import { requireEnv } from './common';

interface IgPostRow {
  url?: string;
  shortcode?: string;
  caption?: string;
  description?: string;
  username?: string;
  user_id?: string;
  play_count?: number;
  like_count?: number;
  comment_count?: number;
  hashtags?: string[];
  posted_at?: string;
  is_reel?: boolean;
}
interface IgCommentRow {
  parent_url?: string;
  text?: string;
  comment_text?: string;
  username?: string;
  like_count?: number;
}

const POSTS_DEFAULT = 'gd_lk5ns7kz21pck8jpis';
const REELS_DEFAULT = 'gd_lyclm20il4r5helnj';
const COMMENTS_DEFAULT = 'gd_ltppn085pokosxh13';

export class BrightDataInstagramAdapter implements VideoProvider {
  id = 'brightdata-instagram';
  priority = 1;
  supports: VideoFetchOptions['platform'][] = ['instagram'];

  async fetch(query: string, opts: VideoFetchOptions): Promise<VideoResult[]> {
    if (opts.platform !== 'instagram') return [];

    // Hashtag query → reels dataset (richer signal). Else fallback to posts.
    const isHashtag = opts.mode === 'hashtag' || query.startsWith('#');
    const datasetId = isHashtag
      ? (requireEnv('BRIGHTDATA_DATASET_ID_INSTAGRAM_REELS') ?? REELS_DEFAULT)
      : (requireEnv('BRIGHTDATA_DATASET_ID_INSTAGRAM_POSTS') ?? POSTS_DEFAULT);

    const maxVideos = Math.min(opts.maxVideos ?? 20, 100);
    let inputs: unknown;
    let discoverBy: string;
    if (isHashtag) {
      inputs = [{
        url: `https://www.instagram.com/explore/tags/${encodeURIComponent(query.replace(/^#/, ''))}/`,
        num_of_posts: maxVideos,
      }];
      discoverBy = 'hashtag_url';
    } else {
      inputs = [{ keyword: query, num_of_posts: maxVideos }];
      discoverBy = 'keyword';
    }

    const rows = await brightDataCollect<IgPostRow>({ providerId: this.id, datasetId, inputs, discoverBy });

    const videos: VideoResult[] = [];
    for (const r of rows.slice(0, maxVideos)) {
      if (!r.url) continue;
      const videoId = r.shortcode ?? r.url.split('/').filter(Boolean).pop() ?? '';
      videos.push({
        url: r.url,
        videoId,
        title: (r.caption ?? r.description ?? '').slice(0, 120),
        content: r.caption ?? r.description ?? '',
        platform: 'instagram',
        caption: r.caption ?? r.description,
        author: r.username,
        playCount: r.play_count,
        likeCount: r.like_count,
        commentCount: r.comment_count,
        hashtags: r.hashtags,
        comments: [],
        publishedAt: r.posted_at,
        fetchedAt: BD_NOW(),
        providerId: this.id,
      });
    }

    // Hydrate comments
    if (videos.length > 0) {
      const commentsId = requireEnv('BRIGHTDATA_DATASET_ID_INSTAGRAM_COMMENTS') ?? COMMENTS_DEFAULT;
      const top = videos.slice(0, 6);
      try {
        const cInputs = top.map(v => ({ url: v.url, num_of_comments: opts.maxCommentsPerVideo ?? 30 }));
        const commentRows = await brightDataCollect<IgCommentRow>({
          providerId: this.id,
          datasetId: commentsId,
          inputs: cInputs,
          discoverBy: 'post_url',
        });
        const byVideo = new Map<string, IgCommentRow[]>();
        for (const c of commentRows) {
          const key = c.parent_url ?? '';
          if (!key) continue;
          const arr = byVideo.get(key) ?? [];
          arr.push(c);
          byVideo.set(key, arr);
        }
        for (const v of videos) {
          const list = (byVideo.get(v.url) ?? []).slice(0, opts.maxCommentsPerVideo ?? 30);
          v.comments = list.map(c => ({ text: c.text ?? c.comment_text ?? '', likes: c.like_count, author: c.username }));
        }
      } catch { /* silent */ }
    }

    return videos;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}
