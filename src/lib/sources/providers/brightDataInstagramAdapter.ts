// ============================================================
// PAWEN — Bright Data Instagram adapter
// Env: BRIGHTDATA_API_KEY,
//      BRIGHTDATA_DATASET_ID_INSTAGRAM_REELS,    (used when profile URLs supplied)
//      BRIGHTDATA_DATASET_ID_INSTAGRAM_COMMENTS, (idem)
//      BRIGHTDATA_DATASET_ID_INSTAGRAM_POSTS / _PROFILES (declared, not currently used)
//
// Bright Data's Instagram datasets only accept profile URLs (`url` /
// `url_all_reels`) — no keyword or hashtag discovery. Until upstream
// surfaces a `plan.profile_urls` list, this adapter no-ops cleanly
// instead of returning HTTP 400 from BD.
// ============================================================

import 'server-only';
import type { VideoProvider, VideoResult, VideoFetchOptions, ProviderHealth } from './types';
import { brightDataHealth } from './brightDataCommon';

export class BrightDataInstagramAdapter implements VideoProvider {
  id = 'brightdata-instagram';
  priority = 1;
  supports: VideoFetchOptions['platform'][] = ['instagram'];

  async fetch(query: string, opts: VideoFetchOptions): Promise<VideoResult[]> {
    if (opts.platform !== 'instagram') return [];
    console.log(`[brightdata-instagram] skip — IG datasets need profile URLs, none supplied (query="${query}", maxVideos=${opts.maxVideos ?? 20})`);
    return [];
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}
