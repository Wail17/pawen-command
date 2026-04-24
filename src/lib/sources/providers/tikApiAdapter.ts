// ============================================================
// PAWEN — Phase U.4 — TikAPI adapter (video, TikTok)
//
// https://tikapi.io — pay-per-request TikTok API, free tier 100 req/mo.
// Supports hashtag + search + video detail + comments.
//
// Env: TIKAPI_KEY
// Docs: https://tikapi.io/docs
// ============================================================

import 'server-only';
import type { VideoProvider, VideoResult, VideoFetchOptions, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

interface TikApiVideo {
  id?: string;
  video?: { id?: string; originCover?: string };
  desc?: string;
  createTime?: number;
  stats?: { playCount?: number; diggCount?: number; commentCount?: number; shareCount?: number };
  author?: { uniqueId?: string; nickname?: string };
  textExtra?: Array<{ hashtagName?: string }>;
}

interface TikApiComment {
  text?: string;
  digg_count?: number;
  user?: { unique_id?: string; nickname?: string };
}

export class TikApiAdapter implements VideoProvider {
  id = 'tikapi';
  priority = 1;
  supports: VideoFetchOptions['platform'][] = ['tiktok'];

  async fetch(query: string, opts: VideoFetchOptions): Promise<VideoResult[]> {
    if (opts.platform !== 'tiktok') return [];
    const key = requireEnv('TIKAPI_KEY');
    if (!key) throw new ProviderError('TIKAPI_KEY not configured', this.id);

    const maxVideos = Math.min(opts.maxVideos ?? 25, 100);
    const maxComments = opts.maxCommentsPerVideo ?? 30;

    // 1. Discover videos (hashtag or keyword search)
    const videoList: TikApiVideo[] = [];
    if (opts.mode === 'hashtag') {
      const tag = query.replace(/^#/, '');
      const res = await fetchWithTimeout(
        `https://api.tikapi.io/public/hashtag?name=${encodeURIComponent(tag)}&count=${maxVideos}`,
        { method: 'GET', headers: { 'X-API-KEY': key, 'Accept': 'application/json' }, timeoutMs: 30_000 },
      );
      if (!res) throw new ProviderError('TikAPI network failure', this.id, undefined, true);
      if (!res.ok) throw new ProviderError(`TikAPI hashtag ${res.status}`, this.id, res.status, res.status >= 500 || res.status === 429);
      const data = await res.json() as { itemList?: TikApiVideo[] };
      videoList.push(...(data.itemList ?? []));
    } else {
      const res = await fetchWithTimeout(
        `https://api.tikapi.io/public/search/general?query=${encodeURIComponent(query)}&count=${maxVideos}`,
        { method: 'GET', headers: { 'X-API-KEY': key, 'Accept': 'application/json' }, timeoutMs: 30_000 },
      );
      if (!res) throw new ProviderError('TikAPI network failure', this.id, undefined, true);
      if (!res.ok) throw new ProviderError(`TikAPI search ${res.status}`, this.id, res.status, res.status >= 500 || res.status === 429);
      const data = await res.json() as { item_list?: TikApiVideo[] };
      videoList.push(...(data.item_list ?? []));
    }

    // 2. Hydrate comments for each video
    const results: VideoResult[] = [];
    for (const v of videoList.slice(0, maxVideos)) {
      const videoId = v.id ?? v.video?.id;
      if (!videoId) continue;
      let comments: VideoResult['comments'] = [];
      try {
        const cRes = await fetchWithTimeout(
          `https://api.tikapi.io/public/comment/list?media_id=${encodeURIComponent(videoId)}&count=${maxComments}`,
          { method: 'GET', headers: { 'X-API-KEY': key }, timeoutMs: 20_000 },
        );
        if (cRes && cRes.ok) {
          const cData = await cRes.json() as { comments?: TikApiComment[] };
          comments = (cData.comments ?? []).map(c => ({
            text: c.text ?? '',
            likes: c.digg_count,
            author: c.user?.unique_id,
          }));
        }
      } catch { /* skip */ }

      results.push({
        url: `https://www.tiktok.com/@${v.author?.uniqueId ?? 'unknown'}/video/${videoId}`,
        title: (v.desc ?? '').slice(0, 120),
        content: v.desc ?? '',
        platform: 'tiktok',
        videoId,
        caption: v.desc,
        author: v.author?.uniqueId,
        playCount: v.stats?.playCount,
        likeCount: v.stats?.diggCount,
        commentCount: v.stats?.commentCount,
        hashtags: (v.textExtra ?? []).map(t => t.hashtagName).filter(Boolean) as string[],
        comments,
        publishedAt: v.createTime ? new Date(v.createTime * 1000).toISOString() : undefined,
        fetchedAt: nowIso(),
        providerId: this.id,
      });
    }

    return results;
  }

  async isHealthy(): Promise<ProviderHealth> {
    return missingEnvHealth(this.id, 'TIKAPI_KEY');
  }
}
