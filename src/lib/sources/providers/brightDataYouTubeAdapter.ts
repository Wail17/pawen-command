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
  // Confirmed schema from live Bright Data probe (2026-04-26):
  url?: string;
  video_id?: string;
  title?: string;
  description?: string;
  youtuber?: string;          // channel name (NOT `channel` / `channel_name`)
  channel_url?: string;
  views?: number;             // view count (NOT `view_count`)
  likes?: number;             // like count (NOT `like_count`)
  num_comments?: number;      // comment count (NOT `comment_count`)
  date_posted?: string;       // ISO timestamp (NOT `posted_at`)
  subscribers?: number;
  hashtags?: string[];
  tags?: string[];
  transcript?: string;
}
interface YouTubeCommentRow {
  // BD comments naming convention mirrors TikTok/Reddit — confirmed by
  // pattern across other BD comment datasets (post_url + commenter_*).
  // If actual schema differs, surface it via console.error and iterate.
  url?: string;             // video URL we asked about
  post_url?: string;        // synonym some BD datasets use
  comment_id?: string;
  comment_url?: string;
  comment_text?: string;    // the body
  comment?: string;         // some datasets use `comment` instead
  num_likes?: number;
  num_replies?: number;
  commenter_user_name?: string;
  commenter_id?: string;
  date_created?: string;
  date_posted?: string;
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
        // Include transcript when present — it's the highest-signal text on a video.
        content: [r.title, r.description, r.transcript].filter(Boolean).join('\n\n'),
        platform: 'youtube',
        caption: r.description,
        author: r.youtuber,
        playCount: r.views,
        likeCount: r.likes,
        commentCount: r.num_comments,
        hashtags: r.hashtags ?? r.tags,
        comments: [],
        publishedAt: r.date_posted,
        fetchedAt: BD_NOW(),
        providerId: this.id,
      });
    }

    // YT comments hydration — re-enabled with HARD BUDGET CAPS because BD
    // has no native `limit` parameter on this dataset and a single mega-
    // viral can return 50k+ rows ($75+).
    //   - Skip if BRIGHTDATA_DISABLE_YOUTUBE_COMMENTS=1
    //   - Top 2 videos by likes
    //   - Drop videos with views > 50k (tight mega-viral filter)
    //   - Drop videos with declared num_comments > 300
    //   - Worst-case cost per run: ~$0.90 (2 × 300 records × $1.50/1k)
    //   - Realistic per niche query: <$0.20
    //   - Hard 90s timeout so we don't blow the route budget
    if (videos.length > 0 && process.env.BRIGHTDATA_DISABLE_YOUTUBE_COMMENTS !== '1') {
      const commentsId = requireEnv('BRIGHTDATA_DATASET_ID_YOUTUBE_COMMENTS') ?? COMMENTS_DEFAULT;
      const top = videos
        .filter(v => (v.playCount ?? 0) <= 50_000)
        .filter(v => (v.commentCount ?? 0) <= 300)
        .slice()
        .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
        .slice(0, 2);
      if (top.length > 0) {
        try {
          const cInputs = top.map(v => ({ url: v.url }));
          const commentRows = await brightDataCollect<YouTubeCommentRow>({
            providerId: this.id,
            datasetId: commentsId,
            inputs: cInputs,
            type: 'url_collection',
            timeoutMs: 90_000,
          });
          const estCost = (commentRows.length / 1000) * 1.5;
          console.log(`[brightdata-youtube] comments: ${commentRows.length} rows for ${top.length} videos (~$${estCost.toFixed(3)} BD cost)`);
          // Log actual schema once so if the field-name guess is wrong we
          // can spot it in Vercel logs without burning more credit on probes.
          if (commentRows.length > 0) {
            console.log(`[brightdata-youtube] comment row keys: ${Object.keys(commentRows[0]).join(', ')}`);
          }
          if (commentRows.length > 5000) {
            console.warn(`[brightdata-youtube] WARN: ${commentRows.length} rows is unusually high — tighten the view-count filter`);
          }
          // Group by video URL — try post_url first then url
          const byVideo = new Map<string, YouTubeCommentRow[]>();
          for (const c of commentRows) {
            const key = c.post_url ?? c.url ?? '';
            if (!key) continue;
            const arr = byVideo.get(key) ?? [];
            arr.push(c);
            byVideo.set(key, arr);
          }
          for (const v of videos) {
            const list = (byVideo.get(v.url) ?? []).slice(0, opts.maxCommentsPerVideo ?? 80);
            v.comments = list
              .filter(c => c.comment_text || c.comment)
              .map(c => ({
                text: (c.comment_text ?? c.comment ?? '').slice(0, 1500),
                likes: c.num_likes,
                author: c.commenter_user_name,
              }));
          }
        } catch (e) {
          console.error(`[brightdata-youtube] comments fetch error (videos still returned without comments): ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        console.log(`[brightdata-youtube] comments skipped — no videos passed the views≤200k AND declared-comments≤1000 filter (mega-viral guard)`);
      }
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
