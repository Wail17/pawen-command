// ============================================================
// PAWEN — Bright Data YouTube adapter
// Env: BRIGHTDATA_API_KEY,
//      BRIGHTDATA_DATASET_ID_YOUTUBE_VIDEOS,
//      BRIGHTDATA_DATASET_ID_YOUTUBE_COMMENTS
//
// Note: there's also BRIGHTDATA_DATASET_ID_YOUTUBE_CHANNELS available
// but not used here — channel scraping is a separate need.
// ============================================================

import 'server-only';
import type { VideoProvider, VideoResult, VideoFetchOptions, ProviderHealth } from './types';
import { brightDataCollect, brightDataHealth, BD_NOW } from './brightDataCommon';
import { requireEnv } from './common';

interface YouTubeVideoRow {
  url?: string;
  video_id?: string;
  title?: string;
  description?: string;
  channel?: string;
  channel_name?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  posted_at?: string;
  hashtags?: string[];
}
interface YouTubeCommentRow {
  parent_url?: string;
  text?: string;
  comment_text?: string;
  author?: string;
  like_count?: number;
  replies?: Array<{ text?: string; author?: string; like_count?: number }>;
}

const VIDEOS_DEFAULT = 'gd_lk56epmy2i5g7lzu0k';
const COMMENTS_DEFAULT = 'gd_lk9q0ew71spt1mxywf';

export class BrightDataYouTubeAdapter implements VideoProvider {
  id = 'brightdata-youtube';
  priority = 1;                      // primary; YouTubeDataAPIAdapter is 2 (fallback)
  supports: VideoFetchOptions['platform'][] = ['youtube'];

  async fetch(query: string, opts: VideoFetchOptions): Promise<VideoResult[]> {
    if (opts.platform !== 'youtube') return [];
    const videosId = requireEnv('BRIGHTDATA_DATASET_ID_YOUTUBE_VIDEOS') ?? VIDEOS_DEFAULT;
    const maxVideos = Math.min(opts.maxVideos ?? 16, 50);

    // YouTube videos dataset — schema requires start_date + end_date (can be empty)
    const inputs = [{
      keyword: query,
      num_of_posts: maxVideos,
      country: '',
      start_date: '',
      end_date: '',
    }];

    const rows = await brightDataCollect<YouTubeVideoRow>({
      providerId: this.id,
      datasetId: videosId,
      inputs,
      discoverBy: 'keyword',
    });

    const videos: VideoResult[] = [];
    for (const r of rows.slice(0, maxVideos)) {
      if (!r.url) continue;
      const videoId = r.video_id ?? extractYouTubeId(r.url);
      videos.push({
        url: r.url,
        videoId: videoId ?? '',
        title: r.title,
        content: [r.title, r.description].filter(Boolean).join('\n\n'),
        platform: 'youtube',
        caption: r.description,
        author: r.channel ?? r.channel_name,
        playCount: r.view_count,
        likeCount: r.like_count,
        commentCount: r.comment_count,
        hashtags: r.hashtags,
        comments: [],
        publishedAt: r.posted_at,
        fetchedAt: BD_NOW(),
        providerId: this.id,
      });
    }

    // Hydrate comments for top videos
    if (videos.length > 0) {
      const commentsId = requireEnv('BRIGHTDATA_DATASET_ID_YOUTUBE_COMMENTS') ?? COMMENTS_DEFAULT;
      const top = videos.slice(0, 6);
      try {
        const cInputs = top.map(v => ({ url: v.url, num_of_comments: opts.maxCommentsPerVideo ?? 50 }));
        const commentRows = await brightDataCollect<YouTubeCommentRow>({
          providerId: this.id,
          datasetId: commentsId,
          inputs: cInputs,
          discoverBy: 'video_url',
        });
        const byVideo = new Map<string, YouTubeCommentRow[]>();
        for (const c of commentRows) {
          const key = c.parent_url ?? '';
          if (!key) continue;
          const arr = byVideo.get(key) ?? [];
          arr.push(c);
          byVideo.set(key, arr);
        }
        for (const v of videos) {
          const list = (byVideo.get(v.url) ?? []).slice(0, opts.maxCommentsPerVideo ?? 50);
          v.comments = list.map(c => ({
            text: c.text ?? c.comment_text ?? '',
            author: c.author,
            likes: c.like_count,
            replies: (c.replies ?? []).map(r => ({ text: r.text ?? '', author: r.author, likes: r.like_count })),
          }));
        }
      } catch { /* silent */ }
    }

    return videos;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}

function extractYouTubeId(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.searchParams.has('v')) return u.searchParams.get('v') ?? undefined;
    const m = u.pathname.match(/\/(?:embed|shorts)\/([A-Za-z0-9_-]{6,})/);
    return m?.[1];
  } catch { return undefined; }
}
