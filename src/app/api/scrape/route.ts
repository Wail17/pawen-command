// ============================================================
// PAWEN — /api/scrape — Firecrawl Proxy
// URL → Clean Markdown
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'FIRECRAWL_API_KEY not configured' }, { status: 500 });
  }

  const { url } = await req.json();
  if (!url) {
    return NextResponse.json({ message: 'URL is required' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.message || 'Firecrawl error' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      markdown: data.data?.markdown ?? '',
      metadata: data.data?.metadata ?? {},
      url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
