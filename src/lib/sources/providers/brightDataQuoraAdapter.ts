// ============================================================
// PAWEN — Bright Data Quora adapter
// Env: BRIGHTDATA_API_KEY, BRIGHTDATA_DATASET_ID_QUORA
// ============================================================

import 'server-only';
import type { SocialProvider, SocialResult, SocialFetchOptions, ProviderHealth } from './types';
import { brightDataCollect, brightDataHealth, BD_NOW } from './brightDataCommon';
import { requireEnv } from './common';

interface QuoraRow {
  url?: string;
  question?: string;
  question_text?: string;
  answers?: Array<{ text?: string; author?: string; upvotes?: number }>;
  num_answers?: number;
  num_views?: number;
  posted_at?: string;
}

const DEFAULT_QUORA = 'gd_lvz1rbj81afv3m6n5y';

export class BrightDataQuoraAdapter implements SocialProvider {
  id = 'brightdata-quora';
  priority = 1;
  supports: SocialFetchOptions['platform'][] = ['quora'];

  async fetch(query: string, opts: SocialFetchOptions): Promise<SocialResult[]> {
    if (opts.platform !== 'quora') return [];
    const datasetId = requireEnv('BRIGHTDATA_DATASET_ID_QUORA') ?? DEFAULT_QUORA;
    const limit = opts.maxThreads ?? 15;

    const inputs = [{
      url: `https://www.quora.com/search?q=${encodeURIComponent(query)}`,
      num_of_questions: limit,
      include_answers: true,
    }];

    const rows = await brightDataCollect<QuoraRow>({
      providerId: this.id,
      datasetId,
      inputs,
    });

    return rows.slice(0, limit).filter(r => r.url).map(r => {
      const answers = (r.answers ?? []).slice(0, opts.maxCommentsPerThread ?? 20);
      const title = r.question ?? r.question_text;
      return {
        url: r.url!,
        title,
        content: [title, ...answers.map(a => a.text ?? '')].filter(Boolean).join('\n\n'),
        commentCount: r.num_answers,
        publishedAt: r.posted_at,
        platform: 'quora' as const,
        comments: answers.map(a => ({
          text: a.text ?? '',
          author: a.author,
          score: a.upvotes,
        })),
        metadata: { num_views: r.num_views },
        fetchedAt: BD_NOW(),
        providerId: this.id,
      };
    });
  }

  async isHealthy(): Promise<ProviderHealth> {
    return brightDataHealth(this.id);
  }
}
