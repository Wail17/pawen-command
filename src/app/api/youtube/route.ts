// ============================================================
// PAWEN — /api/youtube — YouTube Data API v3 proxy
// Fetches real video search results + comment threads.
// Requires YOUTUBE_API_KEY env var (free tier = 10,000 units/day).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 60;

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YTSearchItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
  };
}

interface YTCommentThread {
  snippet: {
    topLevelComment: {
      snippet: {
        textDisplay: string;
        likeCount: number;
        publishedAt: string;
        authorDisplayName: string;
      };
    };
    totalReplyCount: number;
  };
  replies?: {
    comments: Array<{
      snippet: {
        textDisplay: string;
        likeCount: number;
        authorDisplayName: string;
      };
    }>;
  };
}

interface YTVideoStats {
  id: string;
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: 'YOUTUBE_API_KEY not configured' },
      { status: 500 },
    );
  }

  const body = await req.json();
  const { mode, query, videoId, maxResults = 10, language = 'en' } = body;

  try {
    if (mode === 'search') {
      // Search for videos matching query
      const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: String(Math.min(maxResults, 50)),
        relevanceLanguage: language.slice(0, 2),
        order: 'relevance',
        key: apiKey,
      });

      const res = await fetch(`${YT_API_BASE}/search?${params}`, {
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json(
          { message: err.error?.message || 'YouTube search failed', status: res.status },
          { status: res.status },
        );
      }

      const data = await res.json();
      const items = (data.items || []) as YTSearchItem[];

      const videos = items
        .filter((i) => i.id.videoId)
        .map((i) => ({
          videoId: i.id.videoId!,
          title: i.snippet.title,
          description: i.snippet.description,
          channel: i.snippet.channelTitle,
          publishedAt: i.snippet.publishedAt,
        }));

      // Fetch stats for all videos in one batch call
      if (videos.length > 0) {
        const statsParams = new URLSearchParams({
          part: 'statistics',
          id: videos.map((v) => v.videoId).join(','),
          key: apiKey,
        });
        const statsRes = await fetch(`${YT_API_BASE}/videos?${statsParams}`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          const statsMap = new Map<string, YTVideoStats['statistics']>();
          for (const item of (statsData.items || []) as YTVideoStats[]) {
            statsMap.set(item.id, item.statistics);
          }
          for (const v of videos) {
            const s = statsMap.get(v.videoId);
            if (s) {
              Object.assign(v, {
                viewCount: parseInt(s.viewCount || '0'),
                likeCount: parseInt(s.likeCount || '0'),
                commentCount: parseInt(s.commentCount || '0'),
              });
            }
          }
        }
      }

      return NextResponse.json({ videos });
    }

    if (mode === 'comments') {
      // Fetch comment threads for a specific video
      const allComments: Array<{
        text: string;
        likes: number;
        author: string;
        publishedAt: string;
        replies: Array<{ text: string; likes: number; author: string }>;
      }> = [];

      let pageToken: string | undefined;
      let pages = 0;
      const maxPages = 3; // Up to 300 comments (100 per page)

      while (pages < maxPages) {
        const params = new URLSearchParams({
          part: 'snippet,replies',
          videoId,
          maxResults: '100',
          order: 'relevance',
          textFormat: 'plainText',
          key: apiKey,
        });
        if (pageToken) params.set('pageToken', pageToken);

        const res = await fetch(`${YT_API_BASE}/commentThreads?${params}`, {
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
          // Comments disabled or error — not fatal
          if (pages === 0) {
            const err = await res.json().catch(() => ({}));
            return NextResponse.json({
              comments: [],
              error: err.error?.message || 'Comments unavailable',
            });
          }
          break;
        }

        const data = await res.json();
        const threads = (data.items || []) as YTCommentThread[];

        for (const thread of threads) {
          const top = thread.snippet.topLevelComment.snippet;
          const replies = (thread.replies?.comments || []).map((r) => ({
            text: stripHtml(r.snippet.textDisplay),
            likes: r.snippet.likeCount,
            author: r.snippet.authorDisplayName,
          }));

          allComments.push({
            text: stripHtml(top.textDisplay),
            likes: top.likeCount,
            author: top.authorDisplayName,
            publishedAt: top.publishedAt,
            replies,
          });
        }

        pageToken = data.nextPageToken;
        if (!pageToken) break;
        pages++;
      }

      return NextResponse.json({
        comments: allComments,
        totalFetched: allComments.length,
      });
    }

    return NextResponse.json({ message: 'Invalid mode. Use "search" or "comments".' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

function stripHtml(text: string): string {
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
}
