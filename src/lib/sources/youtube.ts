// ============================================================
// PAWEN — YouTube Source Fetcher (v2 — YouTube Data API v3)
//
// Strategy:
//   1. Primary: /api/youtube → YouTube Data API v3
//      Search for relevant videos → fetch REAL comment threads
//      (up to 300 comments per video, sorted by relevance).
//   2. Fallback: if YOUTUBE_API_KEY is not set, fall back to
//      Tavily + Firecrawl (title+description only, no comments).
//
// Comments are folded into RawSourceItem as a "--- COMMENTS ---"
// block, same format as Reddit/TikTok so analyzers treat them
// identically.
// ============================================================

import { RawSourceData, SourceDiscoveryPlan } from '../avatars/types';
import { scrapeMany, webSearch, toRawItem, languageModifier } from './common';

export interface YoutubeFetchOptions {
  maxVideos?: number;     // default 16
  maxCommentsPerVideo?: number; // default 100
}

interface YTVideo {
  videoId: string;
  title: string;
  description: string;
  channel: string;
  publishedAt: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

interface YTComment {
  text: string;
  likes: number;
  author: string;
  publishedAt: string;
  replies: Array<{ text: string; likes: number; author: string }>;
}

async function searchYouTube(
  query: string,
  language: string,
  maxResults: number,
): Promise<YTVideo[]> {
  try {
    const res = await fetch('/api/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'search',
        query,
        maxResults,
        language,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.videos) ? data.videos : [];
  } catch {
    return [];
  }
}

async function fetchComments(videoId: string): Promise<YTComment[]> {
  try {
    const res = await fetch('/api/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'comments', videoId }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.comments) ? data.comments : [];
  } catch {
    return [];
  }
}

function renderVideo(video: YTVideo, comments: YTComment[]): string {
  const stats = [
    video.viewCount ? `${video.viewCount.toLocaleString()} views` : '',
    video.likeCount ? `${video.likeCount.toLocaleString()} likes` : '',
    video.commentCount ? `${video.commentCount.toLocaleString()} comments` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const head = [
    `TITLE: ${video.title}`,
    `CHANNEL: ${video.channel}`,
    stats ? `STATS: ${stats}` : '',
    video.description ? `DESCRIPTION: ${video.description.slice(0, 500)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (comments.length === 0) return head;

  // Render comments + their replies
  const commentLines: string[] = [];
  for (const c of comments) {
    const likeBadge = c.likes > 0 ? ` [${c.likes} likes]` : '';
    commentLines.push(`• ${c.text}${likeBadge}`);
    for (const r of c.replies) {
      const rLikes = r.likes > 0 ? ` [${r.likes} likes]` : '';
      commentLines.push(`  ↳ ${r.text}${rLikes}`);
    }
  }

  return `${head}\n\n--- COMMENTS (${comments.length}) ---\n${commentLines.join('\n')}`;
}

export async function fetchYoutube(
  plan: SourceDiscoveryPlan['youtube'],
  language: string,
  options: YoutubeFetchOptions = {},
): Promise<RawSourceData> {
  const start = Date.now();
  const maxVideos = options.maxVideos ?? 16;
  const queries = plan.video_queries.slice(0, 8);
  const queriesUsed: string[] = [];

  // ============================================================
  // PRIMARY PATH — YouTube Data API v3 (real comments)
  // ============================================================
  const dedupedByVideoId = new Map<string, YTVideo>();

  for (const q of queries) {
    queriesUsed.push(q);
    const videos = await searchYouTube(q, language, Math.ceil(maxVideos / queries.length) + 2);
    for (const v of videos) {
      if (!dedupedByVideoId.has(v.videoId)) {
        dedupedByVideoId.set(v.videoId, v);
      }
    }
  }

  if (dedupedByVideoId.size > 0) {
    const videoList = Array.from(dedupedByVideoId.values()).slice(0, maxVideos);

    // Fetch comments for all videos in parallel (capped concurrency)
    const commentResults = await fetchCommentsParallel(
      videoList.map((v) => v.videoId),
      3,
    );

    const items = videoList.map((video) => {
      const comments = commentResults.get(video.videoId) || [];
      const commentTexts = comments.map((c) => c.text);
      // Add reply texts too
      for (const c of comments) {
        for (const r of c.replies) {
          commentTexts.push(r.text);
        }
      }

      return toRawItem(
        'youtube',
        `https://youtube.com/watch?v=${video.videoId}`,
        renderVideo(video, comments),
        {
          title: video.title,
          comments: commentTexts,
          metadata: {
            channel: video.channel,
            view_count: video.viewCount,
            like_count: video.likeCount,
            comment_count: video.commentCount,
            comments_scraped: comments.length,
            published_at: video.publishedAt,
            via: 'youtube-api',
          },
        },
      );
    });

    return {
      source: 'youtube',
      queries: queriesUsed,
      items,
      itemCount: items.length,
      fetchDurationMs: Date.now() - start,
    };
  }

  // ============================================================
  // FALLBACK PATH — Tavily + Firecrawl (no comments, best-effort)
  // ============================================================
  const langMod = languageModifier(language);
  const videoUrls = new Set<string>();

  for (const q of queries) {
    const searchQuery = `site:youtube.com ${q} ${langMod}`.trim();
    queriesUsed.push(`fallback: ${searchQuery}`);
    const result = await webSearch(searchQuery, { maxResults: 8 });
    if (!result) continue;
    for (const r of result.results) {
      if (r.url.includes('youtube.com/watch') || r.url.includes('youtu.be/')) {
        videoUrls.add(r.url);
      }
    }
  }

  const urlList = Array.from(videoUrls).slice(0, maxVideos);
  const scraped = await scrapeMany(urlList, 4);

  const items = scraped.map((page) =>
    toRawItem('youtube', page.url, page.markdown, {
      title: (page.metadata.title as string) ?? undefined,
      metadata: { ...page.metadata, via: 'firecrawl-fallback' },
    }),
  );

  return {
    source: 'youtube',
    queries: queriesUsed,
    items,
    itemCount: items.length,
    fetchDurationMs: Date.now() - start,
    error:
      items.length === 0
        ? 'YouTube: API unavailable (no YOUTUBE_API_KEY?) and Firecrawl fallback returned nothing.'
        : undefined,
  };
}

// Concurrency-limited parallel comment fetcher
async function fetchCommentsParallel(
  videoIds: string[],
  concurrency: number,
): Promise<Map<string, YTComment[]>> {
  const results = new Map<string, YTComment[]>();
  const queue = [...videoIds];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      const comments = await fetchComments(id);
      results.set(id, comments);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, videoIds.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}
