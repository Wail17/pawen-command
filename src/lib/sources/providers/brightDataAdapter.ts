// ============================================================
// PAWEN — Phase U.4 — Bright Data social adapter
//
// Uses Bright Data's "Dataset API" — https://brightdata.com/products/web-scraper-api
// Replaces Apify for Reddit + Quora + forum scraping. Bright Data has
// pre-built Reddit + Quora datasets we trigger on-demand.
//
// Env:
//   BRIGHTDATA_API_KEY                — bearer token for api.brightdata.com
//   BRIGHTDATA_DATASET_ID_REDDIT      — dataset id for the Reddit collector (optional override)
//   BRIGHTDATA_DATASET_ID_QUORA       — dataset id for the Quora collector (optional override)
// ============================================================

import 'server-only';
import type { SocialProvider, SocialResult, SocialFetchOptions, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

const DEFAULT_REDDIT_DATASET = 'gd_lvz8ah06191smkebj4';      // pre-built reddit posts + comments
const DEFAULT_QUORA_DATASET  = 'gd_lvz8ah06191smkebq1';      // placeholder; user confirms id

interface BrightDataRedditItem {
  url?: string;
  title?: string;
  text?: string;
  score?: number;
  num_comments?: number;
  subreddit?: string;
  author?: string;
  created_utc?: number;
  comments?: Array<{ body?: string; author?: string; score?: number }>;
}

interface BrightDataQuoraItem {
  url?: string;
  question?: string;
  answers?: Array<{ text?: string; author?: string; upvotes?: number }>;
}

export class BrightDataAdapter implements SocialProvider {
  id = 'brightdata';
  priority = 1;
  supports: SocialFetchOptions['platform'][] = ['reddit', 'quora'];

  async fetch(query: string, opts: SocialFetchOptions): Promise<SocialResult[]> {
    const key = requireEnv('BRIGHTDATA_API_KEY');
    if (!key) throw new ProviderError('BRIGHTDATA_API_KEY not configured', this.id);

    const datasetId = this.resolveDatasetId(opts.platform);
    if (!datasetId) throw new ProviderError(`BRIGHTDATA_DATASET_ID_${opts.platform.toUpperCase()} not configured`, this.id);

    const limit = opts.maxThreads ?? 20;

    // Use the "trigger" endpoint for synchronous collection.
    const triggerBody = buildTriggerBody(query, opts);
    const res = await fetchWithTimeout(
      `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true&type=discover_new`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify(triggerBody),
        timeoutMs: 45_000,
      },
    );
    if (!res) throw new ProviderError('Bright Data network failure', this.id, undefined, true);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ProviderError(`Bright Data trigger ${res.status}: ${text.slice(0, 200)}`, this.id, res.status, res.status >= 500);
    }

    const trigger = await res.json() as { snapshot_id?: string; error?: string };
    if (trigger.error) throw new ProviderError(`Bright Data: ${trigger.error}`, this.id);
    const snapshotId = trigger.snapshot_id;
    if (!snapshotId) throw new ProviderError('Bright Data: no snapshot_id returned', this.id);

    // Poll until the snapshot is ready (or fail after ~60s)
    const rows = await this.pollSnapshot(snapshotId, key);

    if (opts.platform === 'reddit') {
      return (rows as BrightDataRedditItem[])
        .filter(r => r.url)
        .slice(0, limit)
        .map(r => ({
          url: r.url!,
          title: r.title,
          content: r.text ?? r.title ?? '',
          author: r.author,
          score: r.score,
          commentCount: r.num_comments,
          subreddit: r.subreddit,
          publishedAt: r.created_utc ? new Date(r.created_utc * 1000).toISOString() : undefined,
          comments: (r.comments ?? []).slice(0, opts.maxCommentsPerThread ?? 50).map(c => ({
            text: c.body ?? '',
            author: c.author,
            score: c.score,
          })),
          platform: 'reddit' as const,
          metadata: { subreddit: r.subreddit },
          fetchedAt: nowIso(),
          providerId: this.id,
        }));
    }

    // Quora
    return (rows as BrightDataQuoraItem[])
      .filter(r => r.url)
      .slice(0, limit)
      .map(r => ({
        url: r.url!,
        title: r.question,
        content: [r.question, ...(r.answers ?? []).map(a => a.text ?? '')].filter(Boolean).join('\n\n'),
        comments: (r.answers ?? []).map(a => ({
          text: a.text ?? '',
          author: a.author,
          score: a.upvotes,
        })),
        platform: 'quora' as const,
        fetchedAt: nowIso(),
        providerId: this.id,
      }));
  }

  async isHealthy(): Promise<ProviderHealth> {
    return missingEnvHealth(this.id, 'BRIGHTDATA_API_KEY');
  }

  private resolveDatasetId(platform: SocialFetchOptions['platform']): string | null {
    if (platform === 'reddit') {
      return requireEnv('BRIGHTDATA_DATASET_ID_REDDIT') ?? DEFAULT_REDDIT_DATASET;
    }
    if (platform === 'quora') {
      return requireEnv('BRIGHTDATA_DATASET_ID_QUORA') ?? DEFAULT_QUORA_DATASET;
    }
    return null;
  }

  private async pollSnapshot(snapshotId: string, key: string): Promise<unknown[]> {
    const start = Date.now();
    const maxMs = 60_000;
    while (Date.now() - start < maxMs) {
      const res = await fetchWithTimeout(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${key}` },
          timeoutMs: 10_000,
        },
      );
      if (!res) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (res.status === 202) {
        // still running
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new ProviderError(`Bright Data snapshot ${res.status}: ${text.slice(0, 200)}`, this.id);
      }
      const data = await res.json();
      return Array.isArray(data) ? data as unknown[] : [];
    }
    throw new ProviderError('Bright Data snapshot timeout (60s)', this.id, 504, true);
  }
}

function buildTriggerBody(query: string, opts: SocialFetchOptions): unknown {
  if (opts.platform === 'reddit') {
    const subs = opts.subreddits && opts.subreddits.length > 0 ? opts.subreddits : ['all'];
    return subs.map(sub => ({
      url: `https://www.reddit.com/r/${sub.replace(/^r\//, '')}/search/?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance`,
      num_of_posts: opts.maxThreads ?? 20,
      include_comments: opts.deepComments !== false,
      language: opts.language,
    }));
  }
  // quora
  return [{
    url: `https://www.quora.com/search?q=${encodeURIComponent(query)}`,
    num_of_questions: opts.maxThreads ?? 20,
    include_answers: true,
  }];
}
