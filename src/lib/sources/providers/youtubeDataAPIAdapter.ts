// ============================================================
// PAWEN — Phase U.4 — YouTube Data API v3 adapter
//
// Free tier: 10,000 units/day. Search costs 100 units,
// comment thread costs 1 unit → plenty of budget.
//
// Env: YOUTUBE_API_KEY
// ============================================================

import 'server-only';
import type { VideoProvider, VideoResult, VideoFetchOptions, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

interface YTSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
}

interface YTCommentThread {
  snippet?: {
    topLevelComment?: { snippet?: { textDisplay?: string; likeCount?: number; authorDisplayName?: string; publishedAt?: string } };
    totalReplyCount?: number;
  };
  replies?: { comments?: Array<{ snippet?: { textDisplay?: string; likeCount?: number; authorDisplayName?: string } }> };
}

interface YTVideoStats {
  id?: string;
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

export class YouTubeDataAPIAdapter implements VideoProvider {
  id = 'youtube-data-api';
  priority = 2; // fallback after BrightDataYouTubeAdapter
  supports: VideoFetchOptions['platform'][] = ['youtube'];

  async fetch(query: string, opts: VideoFetchOptions): Promise<VideoResult[]> {
    if (opts.platform !== 'youtube') return [];
    const key = requireEnv('YOUTUBE_API_KEY');
    if (!key) throw new ProviderError('YOUTUBE_API_KEY not configured', this.id);

    const maxResults = Math.min(opts.maxVideos ?? 16, 50);
    const maxComments = opts.maxCommentsPerVideo ?? 100;
    const lang = opts.language?.slice(0, 2) || 'en';

    const searchParams = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(maxResults),
      relevanceLanguage: lang,
      key,
    });
    const searchRes = await fetchWithTimeout(`${YT_BASE}/search?${searchParams.toString()}`, {
      method: 'GET', timeoutMs: 20_000,
    });
    if (!searchRes) throw new ProviderError('YouTube network failure', this.id, undefined, true);
    if (!searchRes.ok) {
      const text = await searchRes.text().catch(() => '');
      throw new ProviderError(`YouTube search ${searchRes.status}: ${text.slice(0, 200)}`, this.id, searchRes.status, searchRes.status >= 500);
    }
    const searchData = await searchRes.json() as { items?: YTSearchItem[] };
    const videos = (searchData.items ?? [])
      .map(it => ({
        videoId: it.id?.videoId,
        title: it.snippet?.title,
        description: it.snippet?.description,
        channel: it.snippet?.channelTitle,
        publishedAt: it.snippet?.publishedAt,
      }))
      .filter(v => v.videoId);

    if (videos.length === 0) return [];

    // Hydrate stats
    const ids = videos.map(v => v.videoId).join(',');
    const statsRes = await fetchWithTimeout(`${YT_BASE}/videos?part=statistics&id=${ids}&key=${key}`, {
      method: 'GET', timeoutMs: 15_000,
    });
    const statsMap = new Map<string, YTVideoStats['statistics']>();
    if (statsRes && statsRes.ok) {
      const d = await statsRes.json() as { items?: YTVideoStats[] };
      for (const it of d.items ?? []) if (it.id) statsMap.set(it.id, it.statistics ?? {});
    }

    // Hydrate comments (per video)
    const results: VideoResult[] = [];
    for (const v of videos) {
      const commentsUrl = `${YT_BASE}/commentThreads?part=snippet,replies&videoId=${v.videoId}&maxResults=${Math.min(maxComments, 100)}&order=relevance&key=${key}`;
      const cRes = await fetchWithTimeout(commentsUrl, { method: 'GET', timeoutMs: 15_000 });
      const comments: VideoResult['comments'] = [];
      if (cRes && cRes.ok) {
        const cData = await cRes.json() as { items?: YTCommentThread[] };
        for (const t of cData.items ?? []) {
          const top = t.snippet?.topLevelComment?.snippet;
          if (!top?.textDisplay) continue;
          const replies = (t.replies?.comments ?? []).map(r => ({
            text: r.snippet?.textDisplay ?? '',
            likes: r.snippet?.likeCount,
            author: r.snippet?.authorDisplayName,
          })).filter(r => r.text);
          comments.push({ text: top.textDisplay, likes: top.likeCount, author: top.authorDisplayName, replies });
        }
      }
      const stats = statsMap.get(v.videoId!);
      results.push({
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        title: v.title,
        content: [v.title, v.description].filter(Boolean).join('\n\n'),
        platform: 'youtube',
        videoId: v.videoId!,
        caption: v.description,
        author: v.channel,
        playCount: stats?.viewCount ? Number(stats.viewCount) : undefined,
        likeCount: stats?.likeCount ? Number(stats.likeCount) : undefined,
        commentCount: stats?.commentCount ? Number(stats.commentCount) : undefined,
        comments,
        publishedAt: v.publishedAt,
        fetchedAt: nowIso(),
        providerId: this.id,
      });
    }
    return results;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return missingEnvHealth(this.id, 'YOUTUBE_API_KEY');
  }
}
