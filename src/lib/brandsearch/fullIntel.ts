// ============================================================
// PAWEN — BrandSearch Full Intel (server-side)
// Fetches brand metadata + active Meta ad library + products
// for a given domain. Used as structured seed context for the
// reverse-engineer pipeline so Claude has REAL ad copy, launch
// dates, spend, funnel types, bestsellers — not just one scraped
// landing page.
// ============================================================

import 'server-only';

const BS_BASE = 'https://api.brandsearch.co';

function extractDomain(raw: string): string {
  const trimmed = raw.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return trimmed.split('/')[0].toLowerCase();
}

async function bsFetch(
  path: string,
  apiKey: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<Response> {
  const url = new URL(path, BS_BASE);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(25_000),
  });
}

export interface BrandIntelAd {
  id: string;
  status: string;
  start_date?: string;
  end_date?: string;
  total_active_time?: number;
  is_video?: boolean;
  is_image?: boolean;
  duration?: number;
  content?: string;
  headline?: string;
  body_text?: string;
  cta_text?: string;
  media_path?: string;
  platforms?: string[];
  funnel_type?: string;
  language?: string;
  eu_total_spend?: number;
  eu_daily_spend?: number;
  eu_total_reach?: number;
  reach_rank?: number;
  target_gender?: string;
  target_ages?: string;
  target_locations?: string[];
  copy_word_count?: number;
}

export interface BrandIntelProduct {
  id: string;
  title: string;
  price?: number | { amount?: number; currencyCode?: string };
  description?: string;
  url?: string;
  vendor?: string;
  product_type?: string;
  rank?: number;
  tags?: string[];
}

export interface BrandIntelPackage {
  domain: string;
  fetched_at: string;
  brand: Record<string, unknown> | null;
  ads: {
    meta: BrandIntelAd[];
    tiktok: BrandIntelAd[];
    instagram: BrandIntelAd[];
  };
  products: {
    bestsellers: BrandIntelProduct[];
    latest: BrandIntelProduct[];
  };
  signals: {
    total_meta_active: number;
    longest_running_ads: Array<{ id: string; days_live: number; spend?: number; headline?: string }>;
    highest_spend_ads: Array<{ id: string; spend: number; headline?: string }>;
    funnel_mix: Record<string, number>;
    format_mix: { image: number; video: number };
    languages: string[];
    avg_copy_word_count: number;
    first_ad_date?: string;
    latest_ad_date?: string;
  };
  errors: string[];
}

// Normalize a BrandSearch ad object into our flatter shape. BrandSearch
// returns `content` as an object ({ title, body, cta: { text }, link_url,
// display_format }) OR as a string depending on the ad. We handle both.
function normalizeAd(a: Record<string, unknown>): BrandIntelAd {
  const content = a.content as
    | { title?: string; body?: string; cta?: { text?: string } | string; link_url?: string; display_format?: string }
    | string
    | undefined;

  let headline: string | undefined;
  let body_text: string | undefined;
  let cta_text: string | undefined;
  let bodyFlat: string | undefined;

  if (typeof content === 'string') {
    bodyFlat = content;
  } else if (content && typeof content === 'object') {
    headline = content.title;
    body_text = content.body;
    cta_text =
      typeof content.cta === 'string'
        ? content.cta
        : content.cta?.text;
    bodyFlat = [headline, body_text, cta_text].filter(Boolean).join(' | ');
  }

  return {
    id: String(a.id ?? a._id ?? ''),
    status: String(a.status ?? ''),
    start_date: a.start_date as string | undefined,
    end_date: a.end_date as string | undefined,
    total_active_time: a.total_active_time as number | undefined,
    is_video: a.is_video as boolean | undefined,
    is_image: a.is_image as boolean | undefined,
    duration: a.duration as number | undefined,
    content: bodyFlat,
    headline,
    body_text,
    cta_text,
    media_path: a.media_path as string | undefined,
    platforms: a.platforms as string[] | undefined,
    funnel_type: a.funnel_type as string | undefined,
    language: a.language as string | undefined,
    eu_total_spend: a.eu_total_spend as number | undefined,
    eu_daily_spend: a.eu_daily_spend as number | undefined,
    eu_total_reach: a.eu_total_reach as number | undefined,
    reach_rank: a.reach_rank as number | undefined,
    target_gender: a.target_gender as string | undefined,
    target_ages: a.target_ages as string | undefined,
    target_locations: a.target_locations as string[] | undefined,
    copy_word_count: a.copy_word_count as number | undefined,
  };
}

function normalizeProduct(p: Record<string, unknown>): BrandIntelProduct {
  return {
    id: String(p.id ?? ''),
    title: String(p.title ?? ''),
    price: p.price as number | { amount?: number; currencyCode?: string } | undefined,
    description: p.description as string | undefined,
    url: p.url as string | undefined,
    vendor: p.vendor as string | undefined,
    product_type: p.product_type as string | undefined,
    rank: p.rank as number | undefined,
    tags: p.tags as string[] | undefined,
  };
}

function computeSignals(metaAds: BrandIntelAd[]): BrandIntelPackage['signals'] {
  const funnelMix: Record<string, number> = {};
  const langSet = new Set<string>();
  let img = 0;
  let vid = 0;
  let firstDate: string | undefined;
  let latestDate: string | undefined;
  let totalWords = 0;
  let wordCount = 0;

  for (const a of metaAds) {
    if (a.funnel_type) funnelMix[a.funnel_type] = (funnelMix[a.funnel_type] ?? 0) + 1;
    if (a.language) langSet.add(a.language);
    if (a.is_video) vid++;
    if (a.is_image) img++;
    if (a.copy_word_count) {
      totalWords += a.copy_word_count;
      wordCount++;
    }
    if (a.start_date) {
      if (!firstDate || a.start_date < firstDate) firstDate = a.start_date;
      if (!latestDate || a.start_date > latestDate) latestDate = a.start_date;
    }
  }

  const byRuntime = [...metaAds]
    .filter((a) => a.total_active_time && a.total_active_time > 0)
    .sort((a, b) => (b.total_active_time ?? 0) - (a.total_active_time ?? 0))
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      days_live: Math.round((a.total_active_time ?? 0) / 86_400),
      spend: a.eu_total_spend,
      headline: a.headline ?? a.content?.slice(0, 120),
    }));

  const bySpend = [...metaAds]
    .filter((a) => a.eu_total_spend && a.eu_total_spend > 0)
    .sort((a, b) => (b.eu_total_spend ?? 0) - (a.eu_total_spend ?? 0))
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      spend: a.eu_total_spend ?? 0,
      headline: a.headline ?? a.content?.slice(0, 120),
    }));

  return {
    total_meta_active: metaAds.filter((a) => a.status === 'Active').length,
    longest_running_ads: byRuntime,
    highest_spend_ads: bySpend,
    funnel_mix: funnelMix,
    format_mix: { image: img, video: vid },
    languages: Array.from(langSet),
    avg_copy_word_count: wordCount > 0 ? Math.round(totalWords / wordCount) : 0,
    first_ad_date: firstDate,
    latest_ad_date: latestDate,
  };
}

export async function fetchBrandIntel(
  domainOrUrl: string,
  apiKey: string,
  opts: { metaAdLimit?: number; includeSocial?: boolean } = {},
): Promise<BrandIntelPackage> {
  const domain = extractDomain(domainOrUrl);
  const metaLimit = Math.min(opts.metaAdLimit ?? 60, 100);
  const errors: string[] = [];

  // Fetch brand metadata + meta ads + products in parallel. Optionally
  // TikTok/Instagram too (limited to one page each to keep quota usage sane).
  const tasks: Array<Promise<unknown>> = [
    bsFetch(`/v1/brands/by-url/${encodeURIComponent(domain)}`, apiKey).then((r) =>
      r.ok ? r.json() : Promise.reject(`brand ${r.status}`),
    ),
    bsFetch(`/v1/brands/${encodeURIComponent(domain)}/ads`, apiKey, {
      platform: 'meta',
      sort_by: 'eu_total_spend',
      sort_order: 'desc',
      page_size: metaLimit,
    }).then((r) => (r.ok ? r.json() : Promise.reject(`meta ads ${r.status}`))),
    bsFetch(`/v1/brands/${encodeURIComponent(domain)}/products`, apiKey, { product_type: 'all' }).then((r) =>
      r.ok ? r.json() : Promise.reject(`products ${r.status}`),
    ),
  ];

  if (opts.includeSocial) {
    tasks.push(
      bsFetch(`/v1/brands/${encodeURIComponent(domain)}/ads`, apiKey, {
        platform: 'tiktok',
        sort_by: 'engagement_rate',
        sort_order: 'desc',
        page_size: 15,
      }).then((r) => (r.ok ? r.json() : Promise.reject(`tiktok ${r.status}`))),
      bsFetch(`/v1/brands/${encodeURIComponent(domain)}/ads`, apiKey, {
        platform: 'instagram',
        sort_by: 'engagement_rate',
        sort_order: 'desc',
        page_size: 15,
      }).then((r) => (r.ok ? r.json() : Promise.reject(`instagram ${r.status}`))),
    );
  }

  const results = await Promise.allSettled(tasks);
  const [brandRes, metaRes, productRes, tiktokRes, instagramRes] = results;

  const brand =
    brandRes.status === 'fulfilled'
      ? (brandRes.value as Record<string, unknown>)
      : (errors.push(`brand: ${brandRes.reason}`), null);

  const metaRaw =
    metaRes.status === 'fulfilled'
      ? ((metaRes.value as { data?: unknown[] }).data ?? [])
      : (errors.push(`meta: ${metaRes.reason}`), []);
  const metaAds = (metaRaw as Record<string, unknown>[]).map(normalizeAd);

  const productsRaw =
    productRes.status === 'fulfilled'
      ? (productRes.value as { bestsellers?: unknown[]; latest?: unknown[] })
      : (errors.push(`products: ${productRes.reason}`), { bestsellers: [], latest: [] });
  const bestsellers = (productsRaw.bestsellers ?? []).map((p) => normalizeProduct(p as Record<string, unknown>));
  const latest = (productsRaw.latest ?? []).map((p) => normalizeProduct(p as Record<string, unknown>));

  const tiktokAds =
    tiktokRes?.status === 'fulfilled'
      ? ((tiktokRes.value as { data?: unknown[] }).data ?? []).map((a) => normalizeAd(a as Record<string, unknown>))
      : [];

  const instagramAds =
    instagramRes?.status === 'fulfilled'
      ? ((instagramRes.value as { data?: unknown[] }).data ?? []).map((a) => normalizeAd(a as Record<string, unknown>))
      : [];

  return {
    domain,
    fetched_at: new Date().toISOString(),
    brand,
    ads: { meta: metaAds, tiktok: tiktokAds, instagram: instagramAds },
    products: { bestsellers, latest },
    signals: computeSignals(metaAds),
    errors,
  };
}

// Compact serialization for injection into LLM prompts. Keeps only the fields
// that matter for reverse-engineering an avatar, and truncates ad copy bodies
// so we stay under token budgets.
export function serializeIntelForPrompt(pkg: BrandIntelPackage, opts: { maxAds?: number } = {}): string {
  const maxAds = opts.maxAds ?? 30;
  const b = (pkg.brand ?? {}) as Record<string, unknown>;

  const brandBlock = [
    `BRAND: ${b.title ?? b.name ?? pkg.domain} (${pkg.domain})`,
    b.description ? `Description: ${b.description}` : '',
    b.niche ? `Niche: ${b.niche}${Array.isArray(b.niches) && b.niches.length ? ` / ${(b.niches as string[]).join(', ')}` : ''}` : '',
    b.target_persona ? `BrandSearch target persona: ${b.target_persona}` : '',
    Array.isArray(b.key_usps) && b.key_usps.length ? `Key USPs: ${(b.key_usps as string[]).join(' | ')}` : '',
    Array.isArray(b.ad_angle_taxonomy) && b.ad_angle_taxonomy.length
      ? `Ad angle taxonomy: ${(b.ad_angle_taxonomy as string[]).join(', ')}`
      : '',
    b.price_tier ? `Price tier: ${b.price_tier}` : '',
    b.country_code ? `Country: ${b.country_code}` : '',
    b.language_code ? `Language: ${b.language_code}` : '',
    b.monthly_visits ? `Monthly visits: ${b.monthly_visits}` : '',
    b.last_meta_active_count ? `Active Meta ads: ${b.last_meta_active_count}` : '',
    b.last_meta_total_count ? `Total Meta ads (lifetime): ${b.last_meta_total_count}` : '',
    b.eu_total_spend ? `EU total ad spend (€): ${b.eu_total_spend}` : '',
    b.instagram_follower_count ? `Instagram followers: ${b.instagram_follower_count}` : '',
    b.tiktok_follower_count ? `TikTok followers: ${b.tiktok_follower_count}` : '',
    b.judgeme_avg_rating ? `Judge.me: ${b.judgeme_avg_rating}★ (${b.judgeme_review_count} reviews)` : '',
    b.trustpilot_avg_rating ? `Trustpilot: ${b.trustpilot_avg_rating}★ (${b.trustpilot_review_count} reviews)` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const signalsBlock = [
    `=== COMPUTED SIGNALS ===`,
    `Active Meta ads (in sample): ${pkg.signals.total_meta_active}`,
    `Creative format mix: ${pkg.signals.format_mix.video} video / ${pkg.signals.format_mix.image} image`,
    `Funnel mix: ${Object.entries(pkg.signals.funnel_mix)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ') || 'unknown'}`,
    `Ad copy avg word count: ${pkg.signals.avg_copy_word_count}`,
    pkg.signals.first_ad_date ? `First ad: ${pkg.signals.first_ad_date}` : '',
    pkg.signals.latest_ad_date ? `Latest ad: ${pkg.signals.latest_ad_date}` : '',
    pkg.signals.longest_running_ads.length
      ? `Longest-running ads (likely winners):\n${pkg.signals.longest_running_ads
          .map((a) => `  - ${a.days_live}d live | €${a.spend ?? '?'} | "${a.headline ?? ''}"`)
          .join('\n')}`
      : '',
    pkg.signals.highest_spend_ads.length
      ? `Highest-spend ads:\n${pkg.signals.highest_spend_ads
          .map((a) => `  - €${a.spend} | "${a.headline ?? ''}"`)
          .join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const topAds = pkg.ads.meta.slice(0, maxAds);
  const adsBlock = topAds.length
    ? `=== META AD LIBRARY (${topAds.length} of ${pkg.ads.meta.length}) ===\n` +
      topAds
        .map((a, i) => {
          return [
            `--- Ad ${i + 1} [id=${a.id}] ---`,
            `Status: ${a.status}${a.start_date ? ` | Started: ${a.start_date}` : ''}${a.total_active_time ? ` | Runtime: ${Math.round(a.total_active_time / 86_400)}d` : ''}`,
            a.eu_total_spend ? `Spend: €${a.eu_total_spend}${a.eu_daily_spend ? ` (€${a.eu_daily_spend}/day)` : ''}` : '',
            a.eu_total_reach ? `Reach: ${a.eu_total_reach}` : '',
            a.funnel_type ? `Funnel: ${a.funnel_type}` : '',
            a.target_ages || a.target_gender ? `Targeting: ${a.target_ages ?? ''} ${a.target_gender ?? ''}`.trim() : '',
            a.target_locations?.length ? `Locations: ${a.target_locations.slice(0, 6).join(', ')}` : '',
            a.is_video ? `Format: video (${a.duration ?? '?'}s)` : a.is_image ? 'Format: image' : '',
            a.headline ? `Headline: ${a.headline}` : '',
            a.body_text ? `Body: ${a.body_text.slice(0, 1200)}` : a.content ? `Copy: ${a.content.slice(0, 1200)}` : '',
            a.cta_text ? `CTA: ${a.cta_text}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n')
    : '';

  const bestsellers = pkg.products.bestsellers.slice(0, 10);
  const latest = pkg.products.latest.slice(0, 10);
  const productsBlock =
    bestsellers.length || latest.length
      ? `=== PRODUCT CATALOG ===\n${
          bestsellers.length
            ? `Bestsellers:\n${bestsellers
                .map((p) => `  - ${p.title}${p.price ? ` (${typeof p.price === 'number' ? p.price : p.price?.amount ?? ''} ${typeof p.price === 'object' ? p.price?.currencyCode ?? '' : ''})` : ''}${p.description ? ` — ${p.description.slice(0, 180)}` : ''}`)
                .join('\n')}\n`
            : ''
        }${
          latest.length
            ? `Latest:\n${latest
                .map((p) => `  - ${p.title}${p.price ? ` (${typeof p.price === 'number' ? p.price : p.price?.amount ?? ''})` : ''}`)
                .join('\n')}`
            : ''
        }`
      : '';

  const tiktokBlock = pkg.ads.tiktok.length
    ? `=== TOP TIKTOK POSTS (engagement-ranked) ===\n${pkg.ads.tiktok
        .slice(0, 10)
        .map(
          (t, i) =>
            `${i + 1}. ${t.content?.slice(0, 200) ?? ''}${t.eu_total_reach ? ` | reach=${t.eu_total_reach}` : ''}`,
        )
        .join('\n')}`
    : '';

  const instaBlock = pkg.ads.instagram.length
    ? `=== TOP INSTAGRAM POSTS (engagement-ranked) ===\n${pkg.ads.instagram
        .slice(0, 10)
        .map((ig, i) => `${i + 1}. ${ig.content?.slice(0, 200) ?? ''}`)
        .join('\n')}`
    : '';

  return [brandBlock, signalsBlock, adsBlock, productsBlock, tiktokBlock, instaBlock].filter(Boolean).join('\n\n');
}
