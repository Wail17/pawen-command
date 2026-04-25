// ============================================================
// PAWEN — Phase U.4.1 — Provider registry
//
// Central factory. Picks the first healthy provider per category
// with automatic fallback on quota exhaustion / downtime.
// Source files call `getSearchProvider()` etc. — NOT adapters directly.
// ============================================================

import 'server-only';
import type {
  SearchProvider, ScraperProvider, SocialProvider, VideoProvider,
  EcomProvider, MetaAdsProvider, EmbeddingProvider, ProviderHealth,
} from './types';

import { ExaAdapter } from './exaAdapter';
import { BraveAdapter } from './braveAdapter';
import { FirecrawlAdapter } from './firecrawlAdapter';
import { BrightDataRedditAdapter } from './brightDataRedditAdapter';
import { BrightDataQuoraAdapter } from './brightDataQuoraAdapter';
import { BrightDataTikTokAdapter } from './brightDataTikTokAdapter';
import { BrightDataYouTubeAdapter } from './brightDataYouTubeAdapter';
import { BrightDataInstagramAdapter } from './brightDataInstagramAdapter';
import { BrightDataAmazonAdapter } from './brightDataAmazonAdapter';
import { RedditOAuthAdapter } from './redditOAuthAdapter';
import { YouTubeDataAPIAdapter } from './youtubeDataAPIAdapter';
import { ShopifyPublicAdapter } from './shopifyPublicAdapter';
import { metaGraphAdapter } from './metaGraphAdapter';
import { VoyageEmbeddingAdapter, SimhashEmbeddingAdapter } from './voyageEmbeddingAdapter';

// --- Singleton instances (cheap, stateless) ---

const SEARCH: SearchProvider[] = [new ExaAdapter(), new BraveAdapter()];
const SCRAPER: ScraperProvider[] = [new FirecrawlAdapter()];
// All social via Bright Data; RedditOAuth retained as a free fallback.
const SOCIAL: SocialProvider[] = [new BrightDataRedditAdapter(), new BrightDataQuoraAdapter(), new RedditOAuthAdapter()];
// All video via Bright Data; YouTube Data API retained as fallback.
const VIDEO: VideoProvider[] = [new BrightDataTikTokAdapter(), new BrightDataYouTubeAdapter(), new BrightDataInstagramAdapter(), new YouTubeDataAPIAdapter()];
const ECOM: EcomProvider[] = [new BrightDataAmazonAdapter(), new ShopifyPublicAdapter()];
const META_ADS: MetaAdsProvider[] = [metaGraphAdapter];
const EMBEDDING: EmbeddingProvider[] = [new VoyageEmbeddingAdapter(), new SimhashEmbeddingAdapter()];

// --- Health cache: avoid hitting health checks on every call ---

const HEALTH_TTL_MS = 60_000;
const healthCache = new Map<string, { health: ProviderHealth; checkedAt: number }>();

async function getHealthCached(p: { id: string; isHealthy: () => Promise<ProviderHealth> }): Promise<ProviderHealth> {
  const now = Date.now();
  const hit = healthCache.get(p.id);
  if (hit && now - hit.checkedAt < HEALTH_TTL_MS) return hit.health;
  const h = await p.isHealthy().catch((err): ProviderHealth => ({
    ok: false,
    message: err instanceof Error ? err.message : String(err),
    lastCheckedAt: new Date().toISOString(),
  }));
  healthCache.set(p.id, { health: h, checkedAt: now });
  return h;
}

async function pickHealthy<T extends { id: string; priority: number; isHealthy: () => Promise<ProviderHealth> }>(
  pool: T[],
  supportsFilter?: (p: T) => boolean,
): Promise<T | null> {
  const candidates = (supportsFilter ? pool.filter(supportsFilter) : pool)
    .slice()
    .sort((a, b) => a.priority - b.priority);
  for (const p of candidates) {
    const h = await getHealthCached(p);
    if (h.ok) return p;
  }
  return null;
}

// --- Public factory functions ---

export async function getSearchProvider(): Promise<SearchProvider | null> {
  return pickHealthy(SEARCH);
}

export async function getScraperProvider(): Promise<ScraperProvider | null> {
  return pickHealthy(SCRAPER);
}

export async function getSocialProvider(platform: 'reddit' | 'quora' | 'forum' | 'twitter'): Promise<SocialProvider | null> {
  return pickHealthy(SOCIAL, p => p.supports.includes(platform));
}

export async function getVideoProvider(platform: 'tiktok' | 'youtube' | 'instagram'): Promise<VideoProvider | null> {
  return pickHealthy(VIDEO, p => p.supports.includes(platform));
}

export async function getEcomProvider(platform: 'amazon' | 'shopify'): Promise<EcomProvider | null> {
  return pickHealthy(ECOM, p => p.supports.includes(platform));
}

export async function getMetaAdsProvider(): Promise<MetaAdsProvider | null> {
  return pickHealthy(META_ADS);
}

export async function getEmbeddingProvider(): Promise<EmbeddingProvider | null> {
  return pickHealthy(EMBEDDING);
}

// --- Observability surface for /admin/scraping-health ---

export interface ProviderStatus {
  id: string;
  category: string;
  priority: number;
  health: ProviderHealth;
}

export async function snapshotAllHealth(): Promise<ProviderStatus[]> {
  const out: ProviderStatus[] = [];
  const sections: Array<[string, Array<{ id: string; priority: number; isHealthy: () => Promise<ProviderHealth> }>]> = [
    ['search', SEARCH],
    ['scraper', SCRAPER],
    ['social', SOCIAL],
    ['video', VIDEO],
    ['ecom', ECOM],
    ['meta_ads', META_ADS],
    ['embedding', EMBEDDING],
  ];
  for (const [cat, pool] of sections) {
    for (const p of pool) {
      out.push({ id: p.id, category: cat, priority: p.priority, health: await getHealthCached(p) });
    }
  }
  return out;
}
