// ============================================================
// PAWEN — /api/facebook — Facebook Posts & Groups Scraper
//
// Uses Apify's `apify/facebook-posts-scraper` actor to pull posts
// + top comments from public Facebook pages and groups. Marcus's
// discovery plan provides explicit start URLs (pages/groups) when
// they're known, and text queries for Tavily-based discovery when
// they aren't.
//
// REALITY CHECK:
//   - Only PUBLIC groups/pages work. Private groups need session
//     cookies which we don't ship.
//   - Facebook rate-limits aggressively; Apify handles retry/proxy
//     but runs can take 2-4 min for 200 posts.
//   - Expect 10-20% empty runs on niche queries where the relevant
//     groups are all private.
//
// MODES:
//   { mode: "urls", startUrls: ["https://facebook.com/groups/xxx"],
//     resultsLimit: 30, maxComments: 30 }
//     → direct scrape of known pages/groups
//
// Requires APIFY_TOKEN in env. Returns 503 if missing — callers
// must degrade gracefully.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

const APIFY_ACTOR_ID = 'apify~facebook-posts-scraper';
const APIFY_SYNC_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items`;

export const maxDuration = 300;

interface ApifyFacebookPost {
  postId?: string;
  url?: string;
  text?: string;
  time?: string;
  user?: {
    name?: string;
    id?: string;
    profileUrl?: string;
  };
  pageName?: string;
  groupName?: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  comments?: Array<{
    text?: string;
    profileName?: string;
    commentUrl?: string;
    date?: string;
  }>;
  topComments?: Array<{
    text?: string;
    name?: string;
  }>;
}

interface FacebookPost {
  url: string;
  text: string;
  author: string;
  pageOrGroup: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string | null;
  comments: string[];
}

interface RequestBody {
  startUrls?: string[];
  resultsLimit?: number;
  maxComments?: number;
}

function sanitize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizePost(raw: ApifyFacebookPost, maxComments: number): FacebookPost | null {
  const url = raw.url?.trim();
  if (!url) return null;
  const commentsRaw = Array.isArray(raw.comments)
    ? raw.comments
    : Array.isArray(raw.topComments)
    ? raw.topComments
    : [];
  const comments = commentsRaw
    .map((c) => (typeof c?.text === 'string' ? sanitize(c.text) : ''))
    .filter((t) => t.length > 5)
    .slice(0, maxComments);
  const text = sanitize(raw.text ?? '');
  // Skip posts that are pure image with no text AND no comments
  if (!text && comments.length === 0) return null;
  return {
    url,
    text,
    author: raw.user?.name ?? '',
    pageOrGroup: raw.groupName ?? raw.pageName ?? '',
    likeCount: raw.likesCount ?? 0,
    commentCount: raw.commentsCount ?? comments.length,
    shareCount: raw.sharesCount ?? 0,
    createdAt: raw.time ?? null,
    comments,
  };
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: 'APIFY_TOKEN not configured — Facebook scraping unavailable' },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const startUrls = (body.startUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /facebook\.com/i.test(u));

  if (startUrls.length === 0) {
    return NextResponse.json(
      { error: 'startUrls required (facebook.com page or group URLs)' },
      { status: 400 },
    );
  }

  const resultsLimit = Math.max(1, Math.min(body.resultsLimit ?? 25, 100));
  const maxComments = Math.max(0, Math.min(body.maxComments ?? 20, 100));

  const actorInput: Record<string, unknown> = {
    startUrls: startUrls.map((url) => ({ url })),
    resultsLimit,
    // The actor's fields for comment scraping (varies by version)
    maxComments,
    // Prefer posts-only output over profile dumps
    resultsType: 'posts',
  };

  try {
    const res = await fetch(
      `${APIFY_SYNC_URL}?token=${encodeURIComponent(token)}&timeout=240&format=json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
        signal: AbortSignal.timeout(260_000),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        {
          error: `Apify call failed: ${res.status} ${res.statusText}`,
          detail: errText.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const items = (await res.json()) as unknown;
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Apify returned non-array dataset' },
        { status: 502 },
      );
    }

    const posts = (items as ApifyFacebookPost[])
      .map((it) => normalizePost(it, maxComments))
      .filter((p): p is FacebookPost => p !== null);

    return NextResponse.json({
      urlsUsed: startUrls,
      posts,
      postCount: posts.length,
      totalComments: posts.reduce((sum, p) => sum + p.comments.length, 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Apify error';
    return NextResponse.json(
      { error: `Facebook scrape failed: ${msg}` },
      { status: 502 },
    );
  }
}
