// ============================================================
// PAWEN — Meta Ad Library Scraper
// Searches Meta Ad Library via Tavily for competitor ad copy.
// Returns structured ad data for injection into creative gates.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

interface MetaAdResult {
  advertiser: string;
  headline: string;
  body: string;
  cta: string;
  platform: string;
  url: string;
  startDate?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { query, niche, country, limit } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

    const TAVILY_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_KEY) {
      return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 500 });
    }

    // Search Meta Ad Library via Tavily
    const searchQueries = [
      `site:facebook.com/ads/library ${query} ${niche || ''}`,
      `Meta ads "${query}" ${niche || ''} ad copy example`,
      `Facebook ad library ${niche || ''} ${query} active ads`,
    ];

    const allResults: MetaAdResult[] = [];

    for (const sq of searchQueries.slice(0, 2)) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: TAVILY_KEY,
            query: sq,
            max_results: limit || 10,
            include_raw_content: true,
            search_depth: 'advanced',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const results = data.results || [];

          for (const r of results) {
            const ad = parseAdFromResult(r, query);
            if (ad) allResults.push(ad);
          }
        }
      } catch {
        // Continue with next query
      }
    }

    // Deduplicate by headline
    const seen = new Set<string>();
    const unique = allResults.filter(ad => {
      const key = ad.headline.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      ads: unique.slice(0, limit || 20),
      query,
      totalFound: unique.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

function parseAdFromResult(
  result: { title?: string; content?: string; raw_content?: string; url?: string },
  query: string,
): MetaAdResult | null {
  const content = result.raw_content || result.content || '';
  if (content.length < 50) return null;

  // Extract ad components from the content
  const lines = content.split('\n').filter((l: string) => l.trim().length > 10);

  // Try to extract structured ad data
  let headline = result.title || '';
  let body = '';
  let advertiser = '';
  let cta = 'Learn More';

  // Look for ad-like patterns
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 20 && trimmed.length < 150 && !headline) {
      headline = trimmed;
    } else if (trimmed.length > 100 && !body) {
      body = trimmed.slice(0, 500);
    }

    // CTA detection
    const ctaMatch = trimmed.match(/(?:Shop Now|Learn More|Sign Up|Get Started|Buy Now|Order Now|Subscribe|Download|Get Offer|Claim|Try Free)/i);
    if (ctaMatch) cta = ctaMatch[0];

    // Advertiser detection
    const adMatch = trimmed.match(/(?:by|from|©)\s+(.{3,40})/i);
    if (adMatch && !advertiser) advertiser = adMatch[1].trim();
  }

  if (!headline && !body) return null;

  return {
    advertiser: advertiser || 'Unknown',
    headline: headline.slice(0, 200),
    body: body.slice(0, 500),
    cta,
    platform: 'facebook',
    url: result.url || '',
  };
}
