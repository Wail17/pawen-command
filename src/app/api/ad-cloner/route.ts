// ============================================================
// PAWEN — /api/ad-cloner — Gate 1.1: Ad Cloner
//
// Step 1 (scrape): Scrapes Meta Ad Library for a brand via Apify
//   → Returns all unique ads (image_url, headline, body, cta)
//
// Step 2 (translate): Sends original images + copy to Claude (vision)
//   → Claude analyzes each image, translates copy, and generates
//     structured Nano Banana Pro prompts (layered prompt engineering)
//
// Step 3 (generate): Sends NB Pro prompt + original image to fal.ai
//   → nano-banana-pro/edit (img2img) → nano-banana-pro (txt2img)
//   → Nano Banana Pro ONLY — no fallbacks
//
// Each step is a separate POST call so the UI can show progress.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import {
  ADVISOR_TOOL,
  shouldUseAdvisor,
  withAdvisorHint,
  composeBetaHeader,
} from '@/lib/ai/advisor';

export const maxDuration = 300;

const CLONER_MODEL = 'claude-sonnet-4-6';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0/ads_archive';

const APIFY_ACTOR_ID = 'apify~facebook-ads-scraper';
const APIFY_SYNC_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items`;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const body = await req.json();
  const { step } = body;

  switch (step) {
    case 'scrape': return handleScrape(body);
    case 'translate': return handleTranslate(body);
    case 'generate': return handleGenerate(body);
    default:
      return NextResponse.json({ message: 'Invalid step. Use: scrape, translate, generate' }, { status: 400 });
  }
}

// ── STEP 1: SCRAPE META AD LIBRARY ─────────────────────────

interface ScrapedAd {
  id: string;
  page_name: string;
  headline: string;
  body: string;
  cta: string;
  image_url: string;
  link_url: string;
  platform: string;
  start_date: string;
  status: string;
}

async function handleScrape(body: Record<string, unknown>) {
  // Priority 1: Meta Ad Library API (direct, free, structured)
  const metaToken = process.env.META_ACCESS_TOKEN;
  if (metaToken) {
    try {
      return await handleScrapeMetaAPI(body, metaToken);
    } catch (err) {
      console.error('Meta API failed, trying fallbacks:', err);
    }
  }

  // Priority 2: Apify scraper
  const apifyToken = process.env.APIFY_TOKEN?.trim();
  if (apifyToken) {
    try {
      return await handleScrapeApify(body, apifyToken);
    } catch (err) {
      console.error('Apify failed, trying Firecrawl:', err);
    }
  }

  // Priority 3: Firecrawl fallback
  return handleScrapeFallback(body);
}

// ── META AD LIBRARY API (direct) ──────────────────────────

async function handleScrapeMetaAPI(body: Record<string, unknown>, metaToken: string) {
  const { adLibraryUrl, brandName, country, limit } = body;

  // Parse search terms + country from URL or inputs
  let searchTerms = (brandName as string) || '';
  let countryCode = (country as string) || 'ALL';
  let searchPageIds: string | undefined;

  if (adLibraryUrl) {
    try {
      const url = new URL(adLibraryUrl as string);
      searchTerms = url.searchParams.get('q') || searchTerms;
      countryCode = url.searchParams.get('country') || countryCode;
      const pageId = url.searchParams.get('view_all_page_id');
      if (pageId) searchPageIds = pageId;
    } catch {
      // Not a valid URL, treat as brand name
      searchTerms = (adLibraryUrl as string) || searchTerms;
    }
  }

  if (!searchTerms && !searchPageIds) {
    return NextResponse.json({ message: 'Brand name or Ad Library URL required' }, { status: 400 });
  }

  // Build Meta API params
  const params = new URLSearchParams({
    access_token: metaToken,
    ad_reached_countries: JSON.stringify([countryCode]),
    ad_active_status: 'ACTIVE',
    ad_type: 'ALL',
    fields: [
      'id', 'ad_creative_bodies', 'ad_creative_link_titles',
      'ad_creative_link_captions', 'ad_creative_link_descriptions',
      'ad_snapshot_url', 'page_name', 'ad_delivery_start_time',
      'publisher_platforms',
    ].join(','),
    limit: String(Math.min(Number(limit) || 50, 100)),
  });

  if (searchPageIds) {
    params.set('search_page_ids', JSON.stringify([searchPageIds]));
  } else {
    params.set('search_terms', searchTerms);
  }

  const response = await fetch(`${META_GRAPH_URL}?${params}`);

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Meta API request failed');
  }

  const data = await response.json();
  let allItems = data.data || [];

  // Paginate to get more results
  const maxItems = Math.min(Number(limit) || 50, 100);
  let nextUrl = data.paging?.next;

  while (nextUrl && allItems.length < maxItems) {
    const nextRes = await fetch(nextUrl);
    if (!nextRes.ok) break;
    const nextData = await nextRes.json();
    allItems = [...allItems, ...(nextData.data || [])];
    nextUrl = nextData.paging?.next;
  }

  // Build ads from structured API data
  const ads: ScrapedAd[] = [];
  const snapshotUrls: string[] = [];
  const seenKeys = new Set<string>();

  for (const item of allItems) {
    const headline = (item.ad_creative_link_titles || [])[0] || '';
    const bodyText = (item.ad_creative_bodies || [])[0] || '';
    const caption = (item.ad_creative_link_captions || [])[0] || '';
    const description = (item.ad_creative_link_descriptions || [])[0] || '';

    if (!headline && !bodyText) continue;

    // Deduplicate by headline+body
    const dedupeKey = `${headline}|${bodyText}`.toLowerCase().trim();
    if (dedupeKey.length > 1 && seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    ads.push({
      id: item.id || `ad-${ads.length}`,
      page_name: item.page_name || 'Unknown',
      headline: headline.slice(0, 300),
      body: bodyText.slice(0, 1000),
      cta: caption || description || 'Learn More',
      image_url: '', // Will be extracted from snapshot
      link_url: '',
      platform: (item.publisher_platforms || ['facebook'])[0],
      start_date: item.ad_delivery_start_time || '',
      status: 'active',
    });

    // Store snapshot URL for image extraction
    snapshotUrls.push(item.ad_snapshot_url || '');
  }

  // Extract images from snapshot URLs (parallel batches of 10)
  const BATCH_SIZE = 10;
  for (let i = 0; i < ads.length; i += BATCH_SIZE) {
    const batch = ads.slice(i, i + BATCH_SIZE);
    const batchSnapshots = snapshotUrls.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (ad, j) => {
      const snapshotUrl = batchSnapshots[j];
      if (!snapshotUrl) return;
      const imgUrl = await extractImageFromSnapshot(snapshotUrl);
      if (imgUrl) ad.image_url = imgUrl;
    }));
  }

  return NextResponse.json({
    ads,
    total: ads.length,
    brand: searchTerms || 'Unknown',
    source: 'meta_api',
  });
}

// Extract the creative image URL from a Meta Ad snapshot page
async function extractImageFromSnapshot(snapshotUrl: string): Promise<string | null> {
  try {
    const res = await fetch(snapshotUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Pattern 1: Facebook CDN images (scontent)
    const scontentMatches = html.match(/https:\/\/scontent[a-z0-9.-]*\.fbcdn\.net\/[^"'\s)\\]+/g);
    if (scontentMatches) {
      // Pick the largest image (usually has dimensions in URL) — skip tiny icons/pixels
      const filtered = scontentMatches.filter(u =>
        !u.includes('_s.') && !u.includes('_t.') && !u.includes('1x1')
      );
      if (filtered.length > 0) return filtered[0].replace(/\\u0026/g, '&').replace(/\\/g, '');
    }

    // Pattern 2: External CDN image (external.xx.fbcdn.net)
    const externalMatches = html.match(/https:\/\/external[a-z0-9.-]*\.fbcdn\.net\/[^"'\s)\\]+/g);
    if (externalMatches && externalMatches.length > 0) {
      return externalMatches[0].replace(/\\u0026/g, '&').replace(/\\/g, '');
    }

    // Pattern 3: Generic large images in <img> tags
    const imgSrcMatches = html.match(/<img[^>]+src="(https?:\/\/[^"]+)"/g);
    if (imgSrcMatches) {
      for (const match of imgSrcMatches) {
        const src = match.match(/src="([^"]+)"/)?.[1];
        if (src && !src.includes('pixel') && !src.includes('tracking') && !src.includes('1x1') && !src.includes('emoji')) {
          return src;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── APIFY SCRAPER (fallback #1) ───────────────────────────

async function handleScrapeApify(body: Record<string, unknown>, apifyToken: string) {
  const { adLibraryUrl, brandName, country, limit } = body;

  const input: Record<string, unknown> = {
    startUrls: adLibraryUrl
      ? [{ url: adLibraryUrl as string }]
      : [],
    searchQuery: brandName || '',
    countryCode: country || 'ALL',
    adType: 'all',
    maxItems: Math.min(Number(limit) || 500, 500),
  };

  if (!adLibraryUrl && brandName) {
    input.startUrls = [{
      url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(brandName as string)}`,
    }];
  }

  const response = await fetch(`${APIFY_SYNC_URL}?token=${apifyToken}&timeout=280`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Apify error: ${err}`);
  }

  const items = await response.json();
  const ads: ScrapedAd[] = [];
  const seenKeys = new Set<string>();

  for (const item of (Array.isArray(items) ? items : [])) {
    // Apify returns data in snapshot.cards[] structure
    const snapshot = item.snapshot || {};
    const cards = snapshot.cards || [];
    const card = cards[0] || {};
    const pageName = snapshot.pageName || item.page_name || item.pageInfo?.page?.name || 'Unknown';

    // Extract text — try card fields, then snapshot-level, then top-level fallbacks
    const headline = card.title || snapshot.title || item.ad_creative_link_title || item.title || '';
    const rawBody = card.body || snapshot.body?.markup?.__html || '';
    // Strip HTML tags from body markup
    const bodyText = rawBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      || item.ad_creative_body || item.body || '';
    const cta = card.ctaText || snapshot.ctaText || item.ad_creative_link_caption || 'Learn More';
    const linkUrl = card.linkUrl || snapshot.linkUrl || item.ad_creative_link_url || '';

    // Extract image — try card, then snapshot.images[], then top-level
    const snapshotImages = snapshot.images || [];
    const firstSnapshotImg = snapshotImages[0] || {};
    const imgUrl = card.originalImageUrl || card.resizedImageUrl
      || firstSnapshotImg.originalImageUrl || firstSnapshotImg.resizedImageUrl
      || snapshot.image_url || item.image_url || item.ad_creative_link_image || '';

    // Extract video — try card, then snapshot.videos[]
    const snapshotVideos = snapshot.videos || [];
    const firstVideo = snapshotVideos[0] || {};
    const videoUrl = card.videoHdUrl || card.videoSdUrl
      || firstVideo.videoHdUrl || firstVideo.videoSdUrl || '';

    // Deduplicate by image URL (different creatives = different ads, even if same text)
    // Fall back to headline+body only if no image
    const dedupeKey = imgUrl || videoUrl || `text:${headline}|${bodyText}`.toLowerCase().trim();
    if (dedupeKey.length > 1 && seenKeys.has(dedupeKey)) continue;
    if (dedupeKey.length > 1) seenKeys.add(dedupeKey);

    // Skip empty ads
    if (!headline && !bodyText && !imgUrl && !videoUrl) continue;

    ads.push({
      id: item.adArchiveID || item.adArchiveId || item.id || `ad-${ads.length}`,
      page_name: pageName,
      headline: headline.slice(0, 300),
      body: bodyText.slice(0, 1000),
      cta,
      image_url: imgUrl || videoUrl,
      link_url: linkUrl,
      platform: item.publisher_platform || 'facebook',
      start_date: item.startDateFormatted || item.ad_delivery_start_time || '',
      status: 'active',
    });
  }

  return NextResponse.json({
    ads,
    total: ads.length,
    brand: (brandName as string) || 'Unknown',
    source: 'apify',
  });
}

// ── FIRECRAWL SCRAPER (fallback #2) ───────────────────────
async function handleScrapeFallback(body: Record<string, unknown>) {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    return NextResponse.json({ message: 'No APIFY_TOKEN or FIRECRAWL_API_KEY configured' }, { status: 500 });
  }

  const brandName = (body.brandName as string) || '';
  const adLibraryUrl = body.adLibraryUrl as string;

  // Strategy 1: Try direct Meta Ad Library scrape with JS rendering
  // Strategy 2: If that fails, search Google for the brand's ads and scrape results
  let markdown = '';

  // Try direct Meta Ad Library URL
  const directUrl = adLibraryUrl || `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(brandName)}`;

  try {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({
        url: directUrl,
        formats: ['markdown'],
        onlyMainContent: false,
        waitFor: 5000, // Wait 5s for JS to render
        timeout: 30000,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      markdown = data.data?.markdown || '';
    }
  } catch {
    // Silent fail, try next strategy
  }

  // If direct scrape got too little content, try Google search for the brand's Meta ads
  if (markdown.length < 500) {
    try {
      const searchQuery = `site:facebook.com/ads/library "${brandName}" ads`;
      const searchRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=20`,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const searchMarkdown = searchData.data?.markdown || '';
        markdown = markdown + '\n\n--- GOOGLE RESULTS ---\n\n' + searchMarkdown;
      }
    } catch {
      // Silent fail
    }
  }

  // If still nothing, try scraping the brand's Facebook page for ad context
  if (markdown.length < 300 && brandName) {
    try {
      const fbPageRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url: `https://www.facebook.com/${encodeURIComponent(brandName)}`,
          formats: ['markdown'],
          onlyMainContent: false,
          waitFor: 3000,
        }),
      });

      if (fbPageRes.ok) {
        const fbData = await fbPageRes.json();
        markdown = markdown + '\n\n--- FACEBOOK PAGE ---\n\n' + (fbData.data?.markdown || '');
      }
    } catch {
      // Silent fail
    }
  }

  if (markdown.length < 100) {
    return NextResponse.json({
      message: `Could not scrape ads for "${brandName}". Meta Ad Library blocks automated scraping. Try providing a direct Ad Library URL, or set up META_ACCESS_TOKEN for the official API.`,
    }, { status: 500 });
  }

  // Parse ads from scraped content using Claude
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const parseAdvisorEnabled = shouldUseAdvisor(CLONER_MODEL);
    const parseRequestBody: Record<string, unknown> = {
      model: CLONER_MODEL,
      max_tokens: 8192,
      temperature: 0.2,
      system: [{
        type: 'text',
        text: withAdvisorHint(
          'You extract ads from Meta Ad Library scrapes into strict JSON. Return only the JSON array, no prose.',
          CLONER_MODEL,
        ),
      }],
      messages: [{
        role: 'user',
        content: `Extract all unique ads from this Meta Ad Library scrape. For each ad, extract: headline, body text, CTA, image URL (if any), advertiser name.

Return a JSON array (return [] if no ads found):
[{"id":"ad-1","page_name":"Brand","headline":"...","body":"...","cta":"...","image_url":"...","link_url":"","platform":"facebook","start_date":"","status":"active"}]

Content:
${markdown.slice(0, 60000)}`,
      }],
    };
    if (parseAdvisorEnabled) parseRequestBody.tools = [ADVISOR_TOOL];

    const parseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    };
    const parseBeta = composeBetaHeader({ caching: false, advisor: parseAdvisorEnabled });
    if (parseBeta) parseHeaders['anthropic-beta'] = parseBeta;

    const parseResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: parseHeaders,
      body: JSON.stringify(parseRequestBody),
    });

    if (!parseResponse.ok) {
      return NextResponse.json({ message: 'Failed to parse ads' }, { status: 500 });
    }

    const parseData = await parseResponse.json();
    const content = parseData.content?.[0]?.text || '[]';

    let ads: ScrapedAd[] = [];
    try {
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
      ads = JSON.parse(cleaned);
    } catch {
      ads = [];
    }

    // Deduplicate
    const seen = new Set<string>();
    ads = ads.filter(ad => {
      const key = `${ad.headline}|${ad.image_url}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      ads,
      total: ads.length,
      brand: (body.brandName as string) || 'Unknown',
      fallback: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: `Fallback scrape error: ${message}` }, { status: 500 });
  }
}

// ── STEP 2: TRANSLATE ADS + GENERATE NANO BANANA PRO PROMPTS ─

// Nano Banana Pro prompt engineering guide — 2 modes:
// 1. EDIT mode (img2img): focused text replacement instruction (with strength ~0.3 = preserve 70% original)
// 2. RECREATE mode (txt2img fallback): full scene description with translated text
const NANO_BANANA_GUIDE = `You are an expert ad cloning specialist. Your job is to create EXACT 1:1 copies of competitor ads where ONLY the text changes to a new language. The visual design, layout, colors, product, and composition must remain PIXEL-PERFECT identical.

=== MODE 1: EDIT PROMPT (for img2img — nano-banana-pro/edit) ===
This prompt is sent WITH the original image. The AI model SEES the original image.
Goal: Replace ONLY text overlays. Everything else stays IDENTICAL.

STRUCTURE YOUR EDIT PROMPT LIKE THIS:
1. Start with: "Edit this image to replace the text only. Keep everything else exactly the same."
2. For EACH piece of text visible in the image, write:
   - "Replace the text [describe position: top/center/bottom, left/right] that says '[ORIGINAL TEXT]' with \"TRANSLATED TEXT\" — same font style, same size, same color, same position."
3. List ALL text overlays — headlines, subheadlines, CTA buttons, fine print, watermarks.
4. End with: "Do not change any visual elements. Keep identical: background, product, person, colors, layout, lighting, shadows, gradients, logos, icons. Only the text content changes."

EXAMPLE EDIT PROMPT:
"Edit this image to replace the text only. Keep everything else exactly the same. Replace the large white headline at the top that says 'Your Dog Deserves Better' with \"Uw hond verdient beter\" — same bold white font, same size, same center position. Replace the orange CTA button text 'Shop Now' with \"Koop nu\" — same button style and color. Replace the small text at the bottom 'Free Shipping' with \"Gratis verzending\". Do not change any visual elements. Keep identical: background, product, dog photo, colors, layout, lighting, shadows, gradients, logos."

=== MODE 2: RECREATE PROMPT (for txt2img — used when no original image or edit fails) ===
Full scene description in LAYERS to recreate the ad from scratch:
1. Core Idea: "A professional marketing advertisement for [product/brand]"
2. Subject: exact description of what's shown (product, person, animal, object)
3. Environment: background, setting, colors, gradients
4. Lighting/Camera: lighting direction, quality, camera angle
5. Text Rendering: EVERY piece of text in double quotes with exact position, font style, size, color
6. Style: photorealistic/illustrated/flat design, color palette
7. Micro-details: shadows, reflections, texture, grain

EXAMPLE RECREATE PROMPT:
"A professional marketing advertisement with a dark green gradient background. A golden retriever dog sits in the center, looking at the camera with bright eyes. On the left, a premium supplement bottle with a clean white label. Large bold white text at the top displaying \"Uw hond verdient beter\" in modern sans-serif font. Below in smaller white text \"Natuurlijk supplement voor hondenlanglevigheid\". An orange rounded button at the bottom with white text \"Koop nu\". Clean, modern, professional advertising photography style. Soft studio lighting from upper left. Sharp product focus."

=== CRITICAL RULES ===
- ALL text in the generated image MUST be in the TARGET LANGUAGE
- ALL text MUST be wrapped in double quotes in the prompt
- Be EXHAUSTIVE: list EVERY piece of text visible in the original image
- For edit_prompt: be MINIMAL on visual description, MAXIMUM on text specification
- For recreate_prompt: describe the EXACT visual composition you see, don't interpret or improve
- Match the EXACT font style (bold/light/italic), size (large/medium/small), color, and position
- NEVER leave any original-language text untranslated`;

// Download image and convert to base64 for reliable Claude vision
async function downloadImageAsBase64(url: string): Promise<{ mediaType: string; data: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 5 * 1024 * 1024) return null; // Skip >5MB
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return { mediaType: contentType.split(';')[0], data: base64 };
  } catch {
    return null;
  }
}

async function handleTranslate(body: Record<string, unknown>) {
  const { ads, targetLanguage } = body;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const adList = ads as ScrapedAd[];
  if (!adList || !Array.isArray(adList) || adList.length === 0) {
    return NextResponse.json({ message: 'No ads to translate' }, { status: 400 });
  }

  // Download images in parallel (max 10) for Claude vision analysis
  const imagePromises = adList.slice(0, 10).map(ad =>
    ad.image_url && ad.image_url.startsWith('http')
      ? downloadImageAsBase64(ad.image_url)
      : Promise.resolve(null)
  );
  const images = await Promise.all(imagePromises);

  // Build multimodal message content: image + text for each ad
  const messageContent: Array<Record<string, unknown>> = [];

  for (let i = 0; i < adList.length; i++) {
    const ad = adList[i];
    const imgData = i < images.length ? images[i] : null;

    // Add image block if we have it
    if (imgData) {
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imgData.mediaType,
          data: imgData.data,
        },
      });
    }

    messageContent.push({
      type: 'text',
      text: `--- AD "${ad.id}" ---\nHeadline: ${ad.headline}\nBody: ${ad.body}\nCTA: ${ad.cta}${imgData ? '\n[Image above — analyze its visual composition, colors, layout, style, and any text overlays]' : '\n[No image available — generate prompt based on text only]'}`,
    });
  }

  messageContent.push({
    type: 'text',
    text: `Translate all ${adList.length} ads above to ${targetLanguage}.

For each ad:
1. CAREFULLY analyze the image — identify EVERY piece of text visible (headlines, subheadlines, CTA buttons, fine print, product labels, etc.)
2. Translate ALL text to ${targetLanguage}
3. Generate TWO Nano Banana Pro prompts following the guide

Return a JSON array:
[{
  "id": "the-exact-ad-id",
  "translated_headline": "translated headline in ${targetLanguage}",
  "translated_body": "translated body in ${targetLanguage}",
  "translated_cta": "translated CTA in ${targetLanguage}",
  "text_map": [
    {"original": "original text 1", "translated": "translated text 1", "position": "top-center", "style": "bold white large"},
    {"original": "original text 2", "translated": "translated text 2", "position": "bottom-center", "style": "medium orange button"}
  ],
  "edit_prompt": "Edit this image to replace the text only. Keep everything else exactly the same. Replace the [position] text '[original]' with \"translated\" — same font, size, color, position. [repeat for ALL text]. Do not change any visual elements. Keep identical: background, product, colors, layout, lighting, shadows, gradients, logos, icons. Only the text content changes.",
  "recreate_prompt": "Full 7-layer scene description with ALL text in ${targetLanguage} in double quotes. Core idea + Subject + Environment + Lighting + Text (each piece in quotes with position/style) + Style + Micro-details.",
  "negative_prompt": "blurry, distorted text, low quality, jpeg artifacts, watermark, bad anatomy, wrong language text, misspelled text, illegible text, different layout, changed composition, altered colors, modified background"
}]

CRITICAL INSTRUCTIONS:
- edit_prompt MUST start with "Edit this image to replace the text only. Keep everything else exactly the same."
- edit_prompt MUST list EVERY visible text piece with its exact replacement. Use the format: Replace the [position] text '[original]' with "translated" — same font, size, color, position.
- edit_prompt MUST end with "Do not change any visual elements."
- recreate_prompt: describe what you SEE in the image, don't improve or reinterpret. All text in ${targetLanguage} in double quotes.
- text_map: exhaustive list of ALL text in the image with position and style info.
- Both prompts MUST be flat English strings with ${targetLanguage} text in double quotes for rendering.
- NEVER skip any text — even small fine print or watermark text must be listed.`,
  });

  const translateAdvisorEnabled = shouldUseAdvisor(CLONER_MODEL);
  const translateRequestBody: Record<string, unknown> = {
    model: CLONER_MODEL,
    max_tokens: 16384,
    temperature: 0.3,
    system: [{
      type: 'text',
      text: withAdvisorHint(NANO_BANANA_GUIDE, CLONER_MODEL),
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{
      role: 'user',
      content: messageContent,
    }],
  };
  if (translateAdvisorEnabled) translateRequestBody.tools = [ADVISOR_TOOL];

  const translateHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': anthropicKey,
    'anthropic-version': '2023-06-01',
  };
  const translateBeta = composeBetaHeader({ caching: true, advisor: translateAdvisorEnabled });
  if (translateBeta) translateHeaders['anthropic-beta'] = translateBeta;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: translateHeaders,
    body: JSON.stringify(translateRequestBody),
  });

  if (!response.ok) {
    const err = await response.json();
    return NextResponse.json({ message: err.error?.message || 'Translation failed' }, { status: 500 });
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '[]';

  let translations;
  try {
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
    translations = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ message: 'Failed to parse translations', raw: content }, { status: 500 });
  }

  return NextResponse.json({ translations });
}

// ── STEP 3: GENERATE IMAGE VIA NANO BANANA PRO ──────────────

async function handleGenerate(body: Record<string, unknown>) {
  const { editPrompt, recreatePrompt, nanoBananaPrompt, imageDescription, originalImageUrl, negativePrompt, width, height, strength } = body;

  const falKey = process.env.FAL_AI_API_KEY;
  if (!falKey) {
    return NextResponse.json({ message: 'FAL_AI_API_KEY not configured' }, { status: 500 });
  }

  // edit_prompt = focused text replacement (for img2img with original)
  // recreate_prompt = full scene description (for txt2img from scratch)
  const editP = (editPrompt as string) || (nanoBananaPrompt as string) || '';
  const recreateP = (recreatePrompt as string) || (imageDescription as string) || editP;

  if (!editP && !recreateP) {
    return NextResponse.json({ message: 'prompt is required' }, { status: 400 });
  }

  const negPrompt = (negativePrompt as string) ||
    'blurry, distorted text, low quality, jpeg artifacts, watermark, signature, cropped, out of frame, ugly, deformed hands, extra limbs, disfigured, bad anatomy, grain, noise, mutation, bad proportions, wrong language text, misspelled text, different layout, changed composition, altered colors, modified background';

  // Strength controls how much of the original image is preserved (0 = keep all, 1 = full regen)
  // Default 0.35 = keep 65% of original — ideal for text-only changes
  const imgStrength = Math.max(0.1, Math.min(0.95, Number(strength) || 0.35));

  // Model cascade — uses fal.run (synchronous endpoint):
  // 1. nano-banana-pro/edit (img2img — BEST: keeps original, changes text only)
  // 2. nano-banana-pro (txt2img — recreates from description)
  // ONLY Nano Banana Pro — no fallbacks
  const FAL_SYNC_URL = 'https://fal.run';

  const modelAttempts: Array<{
    id: string;
    label: string;
    useImage: boolean;
    buildBody: () => Record<string, unknown>;
  }> = [
    {
      id: 'fal-ai/nano-banana-pro/edit',
      label: 'NanoBanana Pro Edit (img2img)',
      useImage: true,
      buildBody: () => ({
        prompt: editP,
        image_url: originalImageUrl,
        negative_prompt: negPrompt,
        strength: imgStrength,
        guidance_scale: 5.5, // Lower = more faithful to original image
        num_images: 1,
        output_format: 'png',
      }),
    },
    {
      id: 'fal-ai/nano-banana-pro',
      label: 'NanoBanana Pro (txt2img)',
      useImage: false,
      buildBody: () => ({
        prompt: recreateP,
        negative_prompt: negPrompt,
        guidance_scale: 7.5,
        num_images: 1,
        image_size: { width: Number(width) || 1080, height: Number(height) || 1080 },
        output_format: 'png',
      }),
    },
  ];

  const errors: string[] = [];

  for (const attempt of modelAttempts) {
    // Skip img2img models if no original image
    if (attempt.useImage && !originalImageUrl) continue;

    try {
      const reqBody = attempt.buildBody();
      console.log(`[ad-cloner] Trying ${attempt.id}...`);

      const response = await fetch(`${FAL_SYNC_URL}/${attempt.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${falKey}`,
        },
        body: JSON.stringify(reqBody),
      });

      const responseText = await response.text();
      console.log(`[ad-cloner] ${attempt.id} status=${response.status} body=${responseText.slice(0, 300)}`);

      if (response.ok) {
        let data;
        try { data = JSON.parse(responseText); } catch { data = {}; }
        const images = data.images || [];
        if (images.length > 0) {
          return NextResponse.json({ images, model: attempt.id, modelLabel: attempt.label });
        }
        // Model returned OK but no images — might be a queue response
        errors.push(`${attempt.id}: OK but no images in response: ${responseText.slice(0, 150)}`);
      } else {
        errors.push(`${attempt.id} (${response.status}): ${responseText.slice(0, 200)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${attempt.id}: ${msg}`);
      console.error(`[ad-cloner] ${attempt.id} error:`, msg);
    }
  }

  return NextResponse.json({
    message: `All image generation models failed`,
    errors,
  }, { status: 500 });
}
