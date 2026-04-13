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
    urls,           // string[] — competitor URLs to scrape
    mode,           // 'clone' | 'reverse'
    targetLanguage, // e.g. "Italian", "French"
    targetMarket,   // e.g. "Italy", "France"
  } = body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ message: 'At least one URL is required' }, { status: 400 });
  }
  if (!mode || !['clone', 'reverse'].includes(mode)) {
    return NextResponse.json({ message: 'mode must be "clone" or "reverse"' }, { status: 400 });
  }
  if (!targetLanguage || !targetMarket) {
    return NextResponse.json({ message: 'targetLanguage and targetMarket are required' }, { status: 400 });
  }

  // Step 1: Scrape all URLs
  const scrapedResults: Array<{ url: string; markdown: string }> = [];
  for (const url of urls.slice(0, 5)) { // max 5 URLs
    const result = await scrapeUrl(url, firecrawlKey);
    if (result && result.markdown.length > 100) {
      scrapedResults.push({ url, markdown: result.markdown });
    }
  }

  if (scrapedResults.length === 0) {
    return NextResponse.json({ message: 'Failed to scrape any of the provided URLs' }, { status: 400 });
  }

  // Combine scraped content (truncate if too long)
  const combinedContent = scrapedResults
    .map((s, i) => `=== PAGE ${i + 1}: ${s.url} ===\n${s.markdown}`)
    .join('\n\n---\n\n');

  const truncatedContent = combinedContent.slice(0, 120_000); // ~30k tokens

  // Step 2: Build prompts
  const systemPrompt = mode === 'clone'
    ? buildClonePrompt(targetLanguage, targetMarket)
    : buildReverseEngineerPrompt(targetLanguage, targetMarket);

  const userMessage = mode === 'clone'
    ? buildCloneUserMessage(truncatedContent, scrapedResults.map(s => s.url))
    : buildReverseUserMessage(truncatedContent, scrapedResults.map(s => s.url));

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
      [mode]: parsed,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: `Competitor intel error: ${message}` }, { status: 500 });
  }
}
