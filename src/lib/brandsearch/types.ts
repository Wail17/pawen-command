// ============================================================
// PAWEN — BrandSearch API Types
// PRE-GATE module for competitor brand research
// ============================================================

// === BRAND ===

export interface BrandSearchBrand {
  id: string;
  name: string;
  url: string;
  logo_url?: string;
  description?: string;

  // Location
  country?: string;
  city?: string;
  state?: string;

  // Traffic
  monthly_visits?: number;
  monthly_visits_trend?: number;

  // Social
  facebook_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  youtube_url?: string;
  twitter_url?: string;
  pinterest_url?: string;
  facebook_followers?: number;
  instagram_followers?: number;
  tiktok_followers?: number;
  youtube_subscribers?: number;
  twitter_followers?: number;
  pinterest_followers?: number;
  combined_followers?: number;

  // Product catalog
  total_products?: number;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  currency?: string;

  // Meta ads metrics
  meta_ads_active?: boolean;
  meta_active_count?: number;
  meta_inactive_count?: number;
  meta_total_count?: number;
  last_meta_active_count?: number;
  meta_total_spend?: number;
  meta_avg_spend_per_ad?: number;
  meta_spend_trend?: number;

  // Google ads
  google_ads_active?: boolean;
  google_active_count?: number;

  // Revenue & sales
  estimated_sales?: number;
  estimated_revenue?: number;
  interest_score?: number;

  // Brand analysis
  niche?: string;
  sub_niche?: string;
  personas?: string[];
  usps?: string[];
  ad_angle_taxonomy?: string[];
  brand_positioning?: string;

  // Reviews
  avg_rating?: number;
  total_reviews?: number;

  // Tech / theme
  platform?: string;
  theme?: string;
  tech_stack?: string[];

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// === AD ===

export interface BrandSearchAd {
  id: string;
  ad_id?: string;
  brand_id: string;
  platform: 'meta' | 'tiktok' | 'instagram';
  status?: 'active' | 'inactive';

  // Dates
  start_date?: string;
  end_date?: string;
  total_active_time?: number; // days

  // Creative
  content?: string;          // ad copy text
  cards?: BrandSearchAdCard[];
  is_video?: boolean;
  is_image?: boolean;
  duration?: number;         // video duration seconds
  media_path?: string;
  hd_media_path?: string;

  // Targeting
  platforms?: string[];
  target_gender?: string;
  target_ages?: string;
  target_locations?: string[];

  // Spend & reach (EU transparency)
  eu_total_spend?: number;
  eu_daily_spend?: number;
  eu_total_reach?: number;
  per_country_spend?: Record<string, number>;

  // Funnel classification
  funnel_type?: 'TOF' | 'MOF' | 'BOF';

  // Other
  language?: string;
  reach_rank?: number;
}

export interface BrandSearchAdCard {
  title?: string;
  body?: string;
  link?: string;
  image_url?: string;
}

// === PRODUCT ===

export interface BrandSearchProduct {
  id: string;
  brand_id: string;
  title: string;
  url?: string;
  image_url?: string;
  price?: number;
  compare_at_price?: number;
  currency?: string;
  product_type?: 'bestseller' | 'latest' | 'all';
  description?: string;
  rating?: number;
  review_count?: number;
  variants?: string[];
  tags?: string[];
  created_at?: string;
}

// === API RESPONSES ===

export interface BrandSearchListResponse {
  brands: BrandSearchBrand[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface BrandSearchAdsResponse {
  ads: BrandSearchAd[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface BrandSearchProductsResponse {
  products: BrandSearchProduct[];
  total: number;
}

// === ACTION PAYLOADS (client → API route) ===

export type BrandSearchAction =
  | { action: 'search_brands'; query?: string; monthly_visits_min?: number; monthly_visits_max?: number; meta_ads_active?: boolean; meta_total_min?: number; meta_total_max?: number; avg_price_min?: number; avg_price_max?: number; sort?: BrandSearchSort; page?: number; page_size?: number }
  | { action: 'get_brand'; brand_id: string }
  | { action: 'get_brand_by_url'; url: string }
  | { action: 'get_ads'; brand_id: string; platform: 'meta' | 'tiktok' | 'instagram'; status?: 'active' | 'inactive'; min_spend?: number; max_spend?: number; page?: number; page_size?: number }
  | { action: 'get_products'; brand_id: string; product_type?: 'all' | 'bestsellers' | 'latest' };

export type BrandSearchSort =
  | 'monthly_visits'
  | 'last_meta_active_count'
  | 'estimated_sales'
  | 'interest_score'
  | 'combined_followers'
  | 'avg_price';
