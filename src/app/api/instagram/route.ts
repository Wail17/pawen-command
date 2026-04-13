// ============================================================
// PAWEN — /api/instagram — Instagram Hashtag Post Scraper
//
// Uses `scrapesmith/instagram-hashtag-scraper` — the only actor
// we've found that actually returns real hashtag posts end-to-end.
// We tested `apify/instagram-scraper`, `apify/instagram-hashtag-
// scraper`, `easyapi/*`, `burbn/*` — all either return "no_items",
// off-topic matches, or empty dataset. Scrapesmith reliably pulls
// 100+ posts per hashtag with real captions on-topic.
//
// Note: captions only — no nested comments. Instagram captions
// ARE voice-of-customer for hashtag communities (they're where
// people self-describe). Downstream analyzer treats caption as
// the verbatim text.
//
// MODES:
//   { mode: "hashtag", hashtags: ["dietamediterranea"], resultsLimit: 25 }
//     → returns { posts: [{ url, caption, likes, ...}] }
//
//   { mode: "search", queries: ["ansia lavoro"], resultsLimit: 25 }
//     → treated as hashtags (query words → tags)
//
// Requires APIFY_TOKEN in env. Returns 503 if missing.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

const APIFY_ACTOR_ID = 'scrapesmith~instagram-hashtag-scraper';
const APIFY_SYNC_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items`;

export const maxDuration = 300;

// scrapesmith/instagram-hashtag-scraper returns posts in this shape.
interface ApifyInstagramPost {
  id?: string;
  shortCode?: string;
  url?: string;
  displayUrl?: string;
  caption?: string;
  hashtags?: string[];
  mentions?: string[];
  ownerUsername?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  type?: string;
  inputUrl?: string;
}

interface InstagramPost {
  url: string;
  caption: string;
  author: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string | null;
  hashtags: string[];
  comments: string[];
}

interface RequestBody {
  mode: 'search' | 'hashtag';
  queries?: string[];
  hashtags?: string[];
  resultsLimit?: number;
  maxComments?: number;
  language?: string;
}

function sanitize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizePost(raw: ApifyInstagramPost): InstagramPost | null {
  const url = raw.url ?? (raw.shortCode ? `https://www.instagram.com/p/${raw.shortCode}/` : null);
  if (!url) return null;
  const caption = sanitize(raw.caption ?? '');
  if (!caption) return null;
  return {
    url,
    caption,
    author: raw.ownerUsername ?? '',
    likeCount: raw.likesCount ?? 0,
    commentCount: raw.commentsCount ?? 0,
    viewCount: raw.videoViewCount ?? raw.videoPlayCount ?? 0,
    createdAt: raw.timestamp ?? null,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags.slice(0, 15) : [],
    comments: [],
  };
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: 'APIFY_TOKEN not configured — Instagram scraping unavailable' },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const mode = body.mode === 'hashtag' ? 'hashtag' : 'search';
  const resultsLimit = Math.max(1, Math.min(body.resultsLimit ?? 25, 100));

  // In either mode we feed a list of hashtag strings into scrapesmith's
  // `hashtags` input. In search mode we tokenize the queries into single
  // words and use the most-informative ones as tags (Instagram users
  // cluster under topical hashtags, not full phrases).
  const hashtagInput: string[] =
    mode === 'hashtag'
      ? (body.hashtags ?? []).map((h) => h.trim().replace(/^#/, '')).filter(Boolean)
      : (body.queries ?? [])
          .flatMap((q) =>
            q
              .trim()
              .toLowerCase()
              .replace(/[^\p{L}\p{N}\s]/gu, '')
              .split(/\s+/)
              .filter((w) => w.length >= 4),
          )
          .slice(0, 6);

  if (hashtagInput.length === 0) {
    return NextResponse.json(
      { error: mode === 'hashtag' ? 'hashtags required' : 'queries required' },
      { status: 400 },
    );
  }

  const actorInput = {
    hashtags: hashtagInput,
    resultsLimit,
  };

  try {
    const res = await fetch(
      `${APIFY_SYNC_URL}?token=${encodeURIComponent(token)}&timeout=240&format=json&memory=1024`,
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

    const dedupedByUrl = new Map<string, InstagramPost>();
    for (const raw of items as ApifyInstagramPost[]) {
      const normalized = normalizePost(raw);
      if (normalized && !dedupedByUrl.has(normalized.url)) {
        dedupedByUrl.set(normalized.url, normalized);
      }
    }

    const posts = Array.from(dedupedByUrl.values());

    return NextResponse.json({
      mode,
      queriesUsed: hashtagInput,
      posts,
      postCount: posts.length,
      totalComments: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Apify error';
    return NextResponse.json(
      { error: `Instagram scrape failed: ${msg}` },
      { status: 502 },
    );
  }
}
