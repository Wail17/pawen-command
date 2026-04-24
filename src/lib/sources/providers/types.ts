// ============================================================
// PAWEN — Phase U.4 — Provider Abstraction Types
//
// Interfaces that every provider adapter implements. The registry
// picks the first healthy provider per category with auto-fallback
// on quota exhaustion or downtime.
// ============================================================

export type ProviderCategory = 'search' | 'scraper' | 'social' | 'video' | 'ecom' | 'meta_ads' | 'embedding';

export type SocialPlatform = 'reddit' | 'quora' | 'forum' | 'twitter';
export type VideoPlatform = 'tiktok' | 'youtube' | 'instagram';
export type EcomPlatform = 'amazon' | 'shopify';

// --- Health check ---

export interface ProviderHealth {
  ok: boolean;
  message?: string;
  quota?: { remaining?: number; resetAt?: string; limit?: number };
  envVarMissing?: string[];          // names of required env vars that are unset
  lastCheckedAt: string;
}

// --- Common result fields ---

export interface BaseResult {
  url: string;
  title?: string;
  content: string;                    // markdown or plain text
  metadata?: Record<string, unknown>;
  fetchedAt: string;
  providerId: string;                 // 'exa' | 'brave' | 'brightdata' | …
  cost?: { usd?: number; credits?: number; units?: number };
}

// --- Search ---

export interface SearchResult extends BaseResult {
  snippet?: string;
  score?: number;                     // provider relevance score
  publishedAt?: string;
}

export interface SearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  language?: string;                  // 'es-ES' etc.
  country?: string;                   // 'ES', 'US', …
  freshness?: 'day' | 'week' | 'month' | 'year' | null;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface SearchProvider {
  id: string;
  priority: number;                    // lower = preferred
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  isHealthy(): Promise<ProviderHealth>;
}

// --- Generic scrape (URL → markdown) ---

export interface ScrapeResult extends BaseResult {
  markdown: string;
  statusCode?: number;
  cached?: boolean;
}

export interface ScrapeOptions {
  onlyMainContent?: boolean;
  cacheTtlSec?: number;                // 0 = no cache
  formats?: Array<'markdown' | 'html' | 'raw'>;
}

export interface ScraperProvider {
  id: string;
  priority: number;
  scrape(url: string, opts?: ScrapeOptions): Promise<ScrapeResult>;
  isHealthy(): Promise<ProviderHealth>;
}

// --- Social ---

export interface SocialResult extends BaseResult {
  platform: SocialPlatform;
  author?: string;
  score?: number;                     // upvotes / likes
  commentCount?: number;
  comments?: Array<{ text: string; author?: string; score?: number }>;
  subreddit?: string;                 // for reddit
  publishedAt?: string;
}

export interface SocialFetchOptions {
  platform: SocialPlatform;
  maxThreads?: number;
  maxCommentsPerThread?: number;
  language?: string;
  subreddits?: string[];              // when platform='reddit'
  deepComments?: boolean;
}

export interface SocialProvider {
  id: string;
  priority: number;
  supports: SocialPlatform[];
  fetch(query: string, opts: SocialFetchOptions): Promise<SocialResult[]>;
  isHealthy(): Promise<ProviderHealth>;
}

// --- Video ---

export interface VideoResult extends BaseResult {
  platform: VideoPlatform;
  videoId: string;
  caption?: string;
  author?: string;
  playCount?: number;
  likeCount?: number;
  commentCount?: number;
  hashtags?: string[];
  comments?: Array<{ text: string; likes?: number; author?: string; replies?: Array<{ text: string; likes?: number; author?: string }> }>;
  publishedAt?: string;
}

export interface VideoFetchOptions {
  platform: VideoPlatform;
  mode?: 'search' | 'hashtag';
  maxVideos?: number;
  maxCommentsPerVideo?: number;
  language?: string;
}

export interface VideoProvider {
  id: string;
  priority: number;
  supports: VideoPlatform[];
  fetch(query: string, opts: VideoFetchOptions): Promise<VideoResult[]>;
  isHealthy(): Promise<ProviderHealth>;
}

// --- Ecom ---

export interface EcomReview {
  author?: string;
  rating?: number;
  title?: string;
  body: string;
  date?: string;
  verified?: boolean;
}

export interface EcomResult extends BaseResult {
  platform: EcomPlatform;
  productId?: string;                  // ASIN / Shopify handle
  price?: number | string;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  reviews?: EcomReview[];
  marketplace?: string;                // amazon.es, amazon.de, …
}

export interface EcomFetchOptions {
  platform: EcomPlatform;
  marketplace?: string;
  maxProducts?: number;
  maxReviewsPerProduct?: number;
}

export interface EcomProvider {
  id: string;
  priority: number;
  supports: EcomPlatform[];
  fetch(query: string, opts: EcomFetchOptions): Promise<EcomResult[]>;
  isHealthy(): Promise<ProviderHealth>;
}

// --- Meta Ads ---

export interface MetaAdResult {
  id: string;
  pageName: string;
  pageId?: string;
  adCreativeBodies: string[];
  adCreativeLinkTitles: string[];
  adCreativeLinkDescriptions?: string[];
  adCreativeLinkCaptions?: string[];
  snapshotUrl?: string;
  adDeliveryStartTime?: string;
  adDeliveryStopTime?: string;
  euTotalReach?: { lower_bound?: string; upper_bound?: string };
  demographicDistribution?: Array<{ age?: string; gender?: string; percentage?: number }>;
  deliveryByRegion?: Array<{ region?: string; percentage?: number }>;
  publisherPlatforms?: string[];
  cost?: { usd?: number };
}

export interface MetaAdsFetchOptions {
  searchTerms: string;
  countries?: string[];                // ISO-3166-1 alpha-2 codes
  activeStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  adDeliveryDateMin?: string;          // YYYY-MM-DD
  adDeliveryDateMax?: string;
  limit?: number;                      // 1-1000 (Graph cap)
}

export interface MetaAdsProvider {
  id: string;
  priority: number;
  fetch(opts: MetaAdsFetchOptions): Promise<MetaAdResult[]>;
  isHealthy(): Promise<ProviderHealth>;
}

// --- Embeddings ---

export interface EmbeddingProvider {
  id: string;
  priority: number;
  embed(texts: string[]): Promise<Float32Array[]>;
  dimensions: number;                  // e.g. 512 or 1024
  isHealthy(): Promise<ProviderHealth>;
}

// --- Helper: uniform error thrown by adapters when unrecoverable ---

export class ProviderError extends Error {
  constructor(
    message: string,
    public providerId: string,
    public status?: number,
    public retriable: boolean = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
