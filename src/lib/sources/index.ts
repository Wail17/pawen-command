// ============================================================
// PAWEN — Source Fetchers Orchestrator
// Runs all enabled source fetchers in parallel given a discovery plan.
// ============================================================

import {
  RawSourceData,
  SourceConfig,
  SourceDiscoveryPlan,
  SourceType,
  AvatarProgressEvent,
} from '../avatars/types';

import { fetchReddit, RedditDepth } from './reddit';
import { fetchAmazon } from './amazon';
import { fetchYoutube } from './youtube';
import { fetchTikTok } from './tiktok';
import { fetchQuora } from './quora';
import { fetchForums } from './forums';
import { fetchReviews } from './reviews';
import { fetchSearchWide } from './searchWide';
import { fetchShopify } from './shopify';
import { fetchInstagram } from './instagram';
import { fetchFacebook } from './facebook';

export interface RunFetchersParams {
  plan: SourceDiscoveryPlan;
  config: SourceConfig;
  language: string;
  market: string;
  redditDepth?: RedditDepth;
  onProgress?: (event: AvatarProgressEvent) => void;
}

export interface RunFetchersResult {
  data: Partial<Record<SourceType, RawSourceData>>;
  totalItems: number;
  totalDurationMs: number;
  errors: Array<{ source: SourceType; message: string }>;
}

export async function runSourceFetchers(
  params: RunFetchersParams,
): Promise<RunFetchersResult> {
  const { plan, config, language, redditDepth, onProgress } = params;
  const start = Date.now();
  const data: Partial<Record<SourceType, RawSourceData>> = {};
  const errors: Array<{ source: SourceType; message: string }> = [];

  // Build list of active fetch tasks
  const tasks: Array<{ source: SourceType; run: () => Promise<RawSourceData> }> = [];

  if (config.reddit) {
    tasks.push({
      source: 'reddit',
      run: () => fetchReddit(plan.reddit, language, { depth: redditDepth ?? 'deep' }),
    });
  }
  if (config.amazon) {
    tasks.push({ source: 'amazon', run: () => fetchAmazon(plan.amazon) });
  }
  if (config.youtube) {
    tasks.push({ source: 'youtube', run: () => fetchYoutube(plan.youtube, language) });
  }
  if (config.tiktok) {
    tasks.push({ source: 'tiktok', run: () => fetchTikTok(plan.tiktok, language) });
  }
  if (config.quora) {
    tasks.push({ source: 'quora', run: () => fetchQuora(plan.quora, language) });
  }
  if (config.forums) {
    tasks.push({ source: 'forums', run: () => fetchForums(plan.forums, language) });
  }
  if (config.reviews) {
    tasks.push({ source: 'reviews', run: () => fetchReviews(plan.reviews, language) });
  }
  if (config.searchWide) {
    tasks.push({ source: 'searchWide', run: () => fetchSearchWide(plan.searchWide, language) });
  }
  if (config.shopify) {
    tasks.push({ source: 'shopify', run: () => fetchShopify(plan.shopify, language) });
  }
  if (config.instagram) {
    tasks.push({
      source: 'instagram',
      run: () =>
        fetchInstagram(
          plan.instagram ?? { hashtags: [], search_queries: [] },
          language,
        ),
    });
  }
  if (config.facebook) {
    tasks.push({
      source: 'facebook',
      run: () =>
        fetchFacebook(
          plan.facebook ?? { page_urls: [], search_queries: [] },
          language,
        ),
    });
  }

  // Notify UI that fetching has begun
  onProgress?.({
    phase: 'fetching',
    message: `Starting ${tasks.length} source fetchers in parallel`,
    progress: 0,
  });

  // Run all in parallel, handling failures per-source
  const results = await Promise.all(
    tasks.map(async (task) => {
      onProgress?.({
        phase: 'fetching',
        source: task.source,
        message: `Fetching ${task.source}...`,
      });
      try {
        const result = await task.run();
        onProgress?.({
          phase: 'fetching',
          source: task.source,
          message: `${task.source}: ${result.itemCount} items`,
          itemCount: result.itemCount,
        });
        return { source: task.source, result, error: null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        onProgress?.({
          phase: 'fetching',
          source: task.source,
          message: `${task.source} failed: ${msg}`,
        });
        return { source: task.source, result: null, error: msg };
      }
    }),
  );

  let totalItems = 0;
  for (const r of results) {
    if (r.result) {
      data[r.source] = r.result;
      totalItems += r.result.itemCount;
    }
    if (r.error) {
      errors.push({ source: r.source, message: r.error });
    }
  }

  return {
    data,
    totalItems,
    totalDurationMs: Date.now() - start,
    errors,
  };
}
