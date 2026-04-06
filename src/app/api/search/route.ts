// ============================================================
// PAWEN — /api/search — Tavily Proxy
// Web search optimized for LLM consumption
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'TAVILY_API_KEY not configured' }, { status: 500 });
  }

  const { query, maxResults = 10, searchDepth = 'advanced' } = await req.json();
  if (!query) {
    return NextResponse.json({ message: 'Query is required' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: searchDepth,
        include_raw_content: false,
        include_answer: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.message || 'Tavily error' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      answer: data.answer ?? '',
      results: data.results ?? [],
      query,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
