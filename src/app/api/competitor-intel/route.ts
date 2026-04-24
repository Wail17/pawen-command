// ============================================================
// PAWEN — /api/competitor-intel — Gate 1.1
// Scrapes competitor funnel(s) + Claude Opus analysis
// Two modes: clone (translate) or reverse (extract strategy)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';
import {
  buildClonePrompt,
  buildReverseEngineerPrompt,
  buildCloneUserMessage,
  buildReverseUserMessage,
} from '@/lib/competitor/prompts';
import { fetchBrandIntel, serializeIntelForPrompt } from '@/lib/brandsearch/fullIntel';

export const maxDuration = 300;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v2/scrape';

async function scrapeUrl(url: string, firecrawlKey: string): Promise<{ markdown: string; metadata: Record<string, unknown> } | null> {
  try {
    const res = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: false, // we want the FULL page for funnel analysis
      }),
      // Hard per-URL cap so a single stuck Firecrawl request can't eat the
      // whole 300s function budget before Claude even starts.
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      markdown: data.data?.markdown ?? '',
      metadata: data.data?.metadata ?? {},
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;

  if (!anthropicKey) return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  if (!firecrawlKey) return NextResponse.json({ message: 'FIRECRAWL_API_KEY not configured' }, { status: 500 });

  const body = await req.json();
  const {
    urls,            // string[] — competitor URLs to scrape (optional if brandDomain is provided)
    mode,            // 'clone' | 'reverse'
    targetLanguage,  // e.g. "Italian", "French"
    targetMarket,    // e.g. "Italy", "France"
    brandDomain,     // optional — if provided, pulls full BrandSearch intel (ads, products, signals)
    includeSocial,   // optional — pull top TikTok + Instagram posts too
    groundingAvatar, // optional — reverse mode only: pre-built sub-avatar brief to map onto
  } = body as {
    urls?: string[];
    mode?: string;
    targetLanguage?: string;
    targetMarket?: string;
    brandDomain?: string;
    includeSocial?: boolean;
    groundingAvatar?: string;
  };

  const hasUrls = Array.isArray(urls) && urls.length > 0;
  const hasBrand = typeof brandDomain === 'string' && brandDomain.trim().length > 0;
  if (!hasUrls && !hasBrand) {
    return NextResponse.json({ message: 'Provide at least one URL or a brandDomain' }, { status: 400 });
  }
  if (!mode || !['clone', 'reverse'].includes(mode)) {
    return NextResponse.json({ message: 'mode must be "clone" or "reverse"' }, { status: 400 });
  }
  if (!targetLanguage || !targetMarket) {
    return NextResponse.json({ message: 'targetLanguage and targetMarket are required' }, { status: 400 });
  }

  // Step 1 (1a + 1b in parallel): Scrape URLs AND pull BrandSearch intel
  // simultaneously. Previously these ran sequentially — BrandSearch alone
  // can take 30-60s, and stacking it after Firecrawl scrapes wasted budget.
  const bsKey = process.env.BRANDSEARCH_API_KEY;

  const scrapeTask = async (): Promise<Array<{ url: string; markdown: string }>> => {
    if (!hasUrls) return [];
    const urlsToScrape = (urls as string[]).slice(0, 5);
    const settled = await Promise.all(
      urlsToScrape.map(async (url) => {
        const result = await scrapeUrl(url, firecrawlKey);
        return result && result.markdown.length > 100 ? { url, markdown: result.markdown } : null;
      }),
    );
    return settled.filter((s): s is { url: string; markdown: string } => s !== null);
  };

  const brandTask = async (): Promise<Awaited<ReturnType<typeof fetchBrandIntel>> | null> => {
    if (!hasBrand || !bsKey) return null;
    try {
      return await fetchBrandIntel(brandDomain as string, bsKey, {
        metaAdLimit: 60,
        includeSocial: !!includeSocial,
      });
    } catch (e) {
      console.warn('[competitor-intel] BrandSearch intel fetch failed:', e);
      return null;
    }
  };

  const [scrapedResults, brandIntelPackage] = await Promise.all([scrapeTask(), brandTask()]);
  const brandIntelBlock = brandIntelPackage
    ? serializeIntelForPrompt(brandIntelPackage, { maxAds: 30 })
    : '';

  if (scrapedResults.length === 0 && !brandIntelBlock) {
    return NextResponse.json(
      { message: 'No usable content: scraping failed and BrandSearch returned nothing' },
      { status: 400 },
    );
  }

  // Combine scraped content + BrandSearch intel
  const scrapedCombined = scrapedResults
    .map((s, i) => `=== PAGE ${i + 1}: ${s.url} ===\n${s.markdown}`)
    .join('\n\n---\n\n');
  const combinedContent = [
    brandIntelBlock ? `=== BRANDSEARCH STRUCTURED INTEL ===\n${brandIntelBlock}` : '',
    scrapedCombined,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');

  const truncatedContent = combinedContent.slice(0, 160_000); // richer seed, higher cap

  // Step 2: Build prompts
  const trimmedGrounding = typeof groundingAvatar === 'string' ? groundingAvatar.trim() : '';
  const groundingForPrompt = mode === 'reverse' && trimmedGrounding.length > 0 ? trimmedGrounding : undefined;

  const systemPrompt = mode === 'clone'
    ? buildClonePrompt(targetLanguage, targetMarket)
    : buildReverseEngineerPrompt(targetLanguage, targetMarket, groundingForPrompt);

  const userMessage = mode === 'clone'
    ? buildCloneUserMessage(truncatedContent, scrapedResults.map(s => s.url))
    : buildReverseUserMessage(truncatedContent, scrapedResults.map(s => s.url), groundingForPrompt);

  // Step 3: Call Claude Opus for deep analysis
  const requestBody = {
    model: 'claude-opus-4-6',
    max_tokens: 16384,
    temperature: 0.4,
    system: [{
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: userMessage }],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': anthropicKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'prompt-caching-2024-07-31',
  };

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(280_000),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.error?.message || 'Anthropic API error', details: error },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Parse JSON from Claude's response
    let parsed: Record<string, unknown>;
    try {
      // Strip markdown fencing if present
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parsing fails, return raw content
      return NextResponse.json({
        mode,
        urls_scraped: scrapedResults.map(s => s.url),
        scraped_at: new Date().toISOString(),
        raw_content: content,
        parse_error: true,
      });
    }

    return NextResponse.json({
      mode,
      urls_scraped: scrapedResults.map(s => s.url),
      scraped_at: new Date().toISOString(),
      brand_intel: brandIntelPackage
        ? {
            domain: brandIntelPackage.domain,
            meta_ads_count: brandIntelPackage.ads.meta.length,
            tiktok_count: brandIntelPackage.ads.tiktok.length,
            instagram_count: brandIntelPackage.ads.instagram.length,
            bestsellers_count: brandIntelPackage.products.bestsellers.length,
            signals: brandIntelPackage.signals,
            errors: brandIntelPackage.errors,
          }
        : null,
      [mode as string]: parsed,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: `Competitor intel error: ${message}` }, { status: 500 });
  }
}
