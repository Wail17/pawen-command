// ============================================================
// PAWEN — Phase U.4 — Meta Graph Ad Library adapter
//
// Replaces the Tavily-wrapper hack at /api/meta-ads. Uses the
// official Meta Graph API `/ads_archive` endpoint directly.
//
// Docs: https://www.facebook.com/ads/library/api/
//
// Env: META_ACCESS_TOKEN
// ============================================================

import 'server-only';
import type { MetaAdsProvider, MetaAdResult, MetaAdsFetchOptions, ProviderHealth } from './types';
import { ProviderError } from './types';
import { fetchWithTimeout, missingEnvHealth, nowIso, requireEnv } from './common';

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? 'v19.0';

interface MetaAdsArchiveRow {
  id?: string;
  page_name?: string;
  page_id?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  ad_snapshot_url?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  eu_total_reach?: { lower_bound?: string; upper_bound?: string };
  demographic_distribution?: Array<{ age?: string; gender?: string; percentage?: number }>;
  delivery_by_region?: Array<{ region?: string; percentage?: number }>;
  publisher_platforms?: string[];
}

interface MetaAdsResponse {
  data?: MetaAdsArchiveRow[];
  paging?: { next?: string };
  error?: { message?: string; type?: string; code?: number };
}

const FIELDS = [
  'id',
  'page_name',
  'page_id',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'ad_creative_link_captions',
  'ad_snapshot_url',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'eu_total_reach',
  'demographic_distribution',
  'delivery_by_region',
  'publisher_platforms',
].join(',');

export class MetaGraphAdapter implements MetaAdsProvider {
  id = 'meta-graph';
  priority = 1;

  async fetch(opts: MetaAdsFetchOptions): Promise<MetaAdResult[]> {
    const token = requireEnv('META_ACCESS_TOKEN');
    if (!token) throw new ProviderError('META_ACCESS_TOKEN not configured', this.id);

    const limit = Math.min(opts.limit ?? 100, 1000);
    const params = new URLSearchParams({
      access_token: token,
      search_terms: opts.searchTerms,
      fields: FIELDS,
      limit: String(limit),
      ad_active_status: opts.activeStatus ?? 'ACTIVE',
    });
    if (opts.countries && opts.countries.length > 0) {
      params.set('ad_reached_countries', JSON.stringify(opts.countries));
    }
    if (opts.adDeliveryDateMin) params.set('ad_delivery_date_min', opts.adDeliveryDateMin);
    if (opts.adDeliveryDateMax) params.set('ad_delivery_date_max', opts.adDeliveryDateMax);

    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive?${params.toString()}`;
    const res = await fetchWithTimeout(url, { method: 'GET', timeoutMs: 45_000 });
    if (!res) throw new ProviderError('Meta Graph network failure', this.id, undefined, true);
    const data = (await res.json()) as MetaAdsResponse;
    if (!res.ok || data.error) {
      const msg = data.error?.message ?? `${res.status}`;
      throw new ProviderError(`Meta Graph: ${msg}`, this.id, res.status, res.status >= 500 || data.error?.code === 32);
    }

    return (data.data ?? []).map(r => ({
      id: r.id ?? '',
      pageName: r.page_name ?? '',
      pageId: r.page_id,
      adCreativeBodies: r.ad_creative_bodies ?? [],
      adCreativeLinkTitles: r.ad_creative_link_titles ?? [],
      adCreativeLinkDescriptions: r.ad_creative_link_descriptions,
      adCreativeLinkCaptions: r.ad_creative_link_captions,
      snapshotUrl: r.ad_snapshot_url,
      adDeliveryStartTime: r.ad_delivery_start_time,
      adDeliveryStopTime: r.ad_delivery_stop_time,
      euTotalReach: r.eu_total_reach,
      demographicDistribution: r.demographic_distribution,
      deliveryByRegion: r.delivery_by_region,
      publisherPlatforms: r.publisher_platforms,
    })).filter(r => r.id);
  }

  async isHealthy(): Promise<ProviderHealth> {
    const base = missingEnvHealth(this.id, 'META_ACCESS_TOKEN');
    if (!base.ok) return base;
    base.message = `meta-graph: token present (version ${META_GRAPH_VERSION}, live check not performed)`;
    return base;
  }
}

// Also exported for use in /api/meta-ads route directly.
export const metaGraphAdapter = new MetaGraphAdapter();
// Keep metadata referenced to avoid unused-export lints.
export const _metaTimestamp = () => nowIso();
