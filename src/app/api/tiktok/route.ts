// ============================================================
// PAWEN — /api/tiktok — TikTok Organic Comments Scraper
//
// Uses Apify's `clockworks/free-tiktok-scraper` actor to pull
// real video data + organic comments for hashtags or search queries.
// This is the only reliable way to get TikTok voice-of-customer —
// Firecrawl/Tavily fall over on TikTok's SPA.
//
// MODES:
//   { mode: "search", queries: ["keto diet fail"], maxVideos: 20,
//     maxComments: 50, language: "fr-FR" }
//     → returns { videos: [{ url, caption, playCount, comments[] }] }
//
//   { mode: "hashtag", hashtags: ["ketolife"], maxVideos: 20,
//     maxComments: 50 }
//     → same shape
//
// Requires APIFY_TOKEN in env. If missing, returns 503 — callers
// should degrade gracefully (TikTok is never the sole source).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

// Apify run-sync-get-dataset-items: starts a run, waits for it to finish,
// returns the dataset items directly. Max wait is controlled by `timeout`
// (seconds) — we cap at 240s to stay inside our 5-minute function budget.
const APIFY_ACTOR_ID = 'clockworks~free-tiktok-scraper';
const APIFY_SYNC_URL = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items`;

// Fluid compute — give the Apify run enough headroom. Most runs finish
// in 60-120s but hashtag scrapes with comments can push 3-4 min.
export const maxDuration = 300;

interface ApifyVideoItem {
  id?: string;
  webVideoUrl?: string;
  text?: string;              // caption
  createTimeISO?: string;
  playCount?: number;
  diggCount?: number;         // likes
  commentCount?: number;
  shareCount?: number;
  authorMeta?: {
    name?: string;
    nickName?: string;
  };
  hashtags?: Array<{ name?: string }>;
  // The free-tiktok-scraper does NOT embed comments on the video object.
  // Instead it stores comments for each video in a separate dataset and
  // gives us a pre-signed URL here. We fetch each URL to get real comments.
  commentsDatasetUrl?: string;
}

interface ApifyCommentItem {
  text?: string;
  diggCount?: number;
  createTimeISO?: string;
  uniqueId?: string;
}

interface TikTokVideo {
  url: string;
  caption: string;
  author: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string | null;
  hashtags: string[];
  comments: string[];
}

interface RequestBody {
  mode: 'search' | 'hashtag';
  queries?: string[];
  hashtags?: string[];
  maxVideos?: number;
  maxComments?: number;
  language?: string;
}

function sanitizeCommentText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

async function fetchCommentsDataset(
  datasetUrl: string,
  maxComments: number,
  token: string,
): Promise<string[]> {
  try {
    // The URL includes a signed read token, but we append ?token=X as a
    // belt-and-suspenders fallback in case the signature expires mid-run.
    const sep = datasetUrl.includes('?') ? '&' : '?';
    const url = `${datasetUrl}${sep}token=${encodeURIComponent(token)}&limit=${maxComments}&clean=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return [];
    const items = (await res.json()) as unknown;
    if (!Array.isArray(items)) return [];
    return (items as ApifyCommentItem[])
      .map((c) => (typeof c?.text === 'string' ? sanitizeCommentText(c.text) : ''))
      .filter((t) => t.length > 5)
      .slice(0, maxComments);
  } catch {
    return [];
  }
}

async function normalizeVideo(
  raw: ApifyVideoItem,
  maxComments: number,
  token: string,
): Promise<TikTokVideo | null> {
  const url = raw.webVideoUrl?.trim();
  if (!url) return null;
  const comments =
    maxComments > 0 && raw.commentsDatasetUrl
      ? await fetchCommentsDataset(raw.commentsDatasetUrl, maxComments, token)
      : [];
  return {
    url,
    caption: sanitizeCommentText(raw.text ?? ''),
    author: raw.authorMeta?.nickName ?? raw.authorMeta?.name ?? '',
    playCount: raw.playCount ?? 0,
    likeCount: raw.diggCount ?? 0,
    commentCount: raw.commentCount ?? comments.length,
    createdAt: raw.createTimeISO ?? null,
    hashtags: (raw.hashtags ?? [])
      .map((h) => (h?.name ? `#${h.name}` : ''))
      .filter(Boolean),
    comments,
  };
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: 'APIFY_TOKEN not configured — TikTok scraping unavailable' },
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
  const maxVideos = Math.max(1, Math.min(body.maxVideos ?? 20, 60));
  const maxComments = Math.max(0, Math.min(body.maxComments ?? 40, 100));

  // Build actor input per clockworks/free-tiktok-scraper schema.
  // The actor accepts searchQueries OR hashtags — we pick the right field
  // based on mode. shouldDownloadCovers etc. default to false (we only
  // need text, not media).
  const searchQueries = (body.queries ?? []).map((q) => q.trim()).filter(Boolean);
  const hashtags = (body.hashtags ?? [])
    .map((h) => h.trim().replace(/^#/, ''))
    .filter(Boolean);

  if (mode === 'search' && searchQueries.length === 0) {
    return NextResponse.json({ error: 'queries required in search mode' }, { status: 400 });
  }
  if (mode === 'hashtag' && hashtags.length === 0) {
    return NextResponse.json({ error: 'hashtags required in hashtag mode' }, { status: 400 });
  }

  const actorInput: Record<string, unknown> = {
    resultsPerPage: maxVideos,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
    // Comments are the whole point of this scraper:
    profileScrapeSections: ['videos'],
    excludePinnedPosts: false,
    maxProfilesPerQuery: 10,
  };

  if (mode === 'search') {
    actorInput.searchQueries = searchQueries;
    actorInput.searchSection = '';
  } else {
    actorInput.hashtags = hashtags;
  }

  // Some actor versions take commentsPerPost directly, others pipe through
  // a nested scraper. Set both to be safe.
  actorInput.commentsPerPost = maxComments;
  actorInput.shouldScrapeComments = maxComments > 0;

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

    const items = (await res.json()) as ApifyVideoItem[];
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Apify returned non-array dataset' },
        { status: 502 },
      );
    }

    // Normalize in parallel — each call fires a side fetch to its video's
    // comments dataset URL. Cap concurrency at 10 to avoid hammering Apify.
    const normalized: (TikTokVideo | null)[] = [];
    const batchSize = 10;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((it) => normalizeVideo(it, maxComments, token)),
      );
      normalized.push(...results);
    }
    const videos = normalized.filter((v): v is TikTokVideo => v !== null);

    return NextResponse.json({
      mode,
      queriesUsed: mode === 'search' ? searchQueries : hashtags,
      videos,
      videoCount: videos.length,
      totalComments: videos.reduce((sum, v) => sum + v.comments.length, 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown Apify error';
    return NextResponse.json(
      { error: `TikTok scrape failed: ${msg}` },
      { status: 502 },
    );
  }
}
