// ============================================================
// PAWEN — /api/video/animate
// Wraps fal.ai video models (Kling v2 / Kling 2.5-turbo / Veo 3)
// with image-to-video. Uses fal's queue API and polls until ready
// or until we approach the 300s Vercel function limit.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

export const maxDuration = 300;

const FAL_QUEUE = 'https://queue.fal.run';

const MODEL_MAP: Record<string, string> = {
  'kling-2-5-turbo': 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  'kling-2-master': 'fal-ai/kling-video/v2/master/image-to-video',
  'veo-3': 'fal-ai/veo3/image-to-video',
};

type AnimateBody = {
  model?: string;              // kling-2-5-turbo | kling-2-master | veo-3
  imageUrl: string;            // starting image URL
  endingImageUrl?: string;     // optional ending frame (kling supports this)
  prompt: string;              // animation prompt
  negativePrompt?: string;
  durationSeconds?: 5 | 10;    // 5 or 10
  aspectRatio?: '9:16' | '16:9' | '1:1';
  cfgScale?: number;           // kling guidance
};

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.FAL_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: 'FAL_AI_API_KEY not configured' }, { status: 500 });

  let body: AnimateBody;
  try {
    body = (await req.json()) as AnimateBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.imageUrl || !body.prompt) {
    return NextResponse.json({ message: 'imageUrl and prompt are required' }, { status: 400 });
  }

  const modelKey = body.model ?? 'kling-2-5-turbo';
  const endpoint = MODEL_MAP[modelKey];
  if (!endpoint) {
    return NextResponse.json(
      { message: `Unknown video model: ${modelKey}. Options: ${Object.keys(MODEL_MAP).join(', ')}` },
      { status: 400 },
    );
  }

  // Build model-specific payload. Kling and Veo accept slightly different fields.
  const isKling = modelKey.startsWith('kling');
  const duration = body.durationSeconds ?? 5;
  const aspect = body.aspectRatio ?? '9:16';

  const payload: Record<string, unknown> = {
    prompt: body.prompt,
    image_url: body.imageUrl,
  };
  if (isKling) {
    payload.duration = String(duration);          // kling expects "5" or "10" as string
    payload.aspect_ratio = aspect;
    if (body.endingImageUrl) payload.tail_image_url = body.endingImageUrl;
    if (body.cfgScale != null) payload.cfg_scale = body.cfgScale;
    if (body.negativePrompt) payload.negative_prompt = body.negativePrompt;
  } else {
    // Veo 3
    payload.duration = duration;
    payload.aspect_ratio = aspect;
    if (body.negativePrompt) payload.negative_prompt = body.negativePrompt;
  }

  try {
    // 1. Submit to queue
    const submit = await fetch(`${FAL_QUEUE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!submit.ok) {
      const err = await submit.json().catch(() => ({}));
      return NextResponse.json(
        { message: err.detail || err.message || `fal submit ${submit.status}`, details: err },
        { status: submit.status },
      );
    }
    const { request_id, status_url, response_url } = (await submit.json()) as {
      request_id: string;
      status_url?: string;
      response_url?: string;
    };
    const statusUrl = status_url ?? `${FAL_QUEUE}/${endpoint}/requests/${request_id}/status`;
    const resultUrl = response_url ?? `${FAL_QUEUE}/${endpoint}/requests/${request_id}`;

    // 2. Poll. Budget: ~270s (leave 30s headroom for Vercel 300s cap).
    const start = Date.now();
    const budgetMs = 270_000;
    let delay = 3_000;
    while (Date.now() - start < budgetMs) {
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.2, 8_000);
      const statusRes = await fetch(statusUrl, {
        headers: { Authorization: `Key ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!statusRes.ok) continue;
      const statusData = (await statusRes.json()) as { status?: string };
      const s = (statusData.status ?? '').toUpperCase();
      if (s === 'COMPLETED' || s === 'OK') break;
      if (s === 'FAILED' || s === 'ERROR') {
        return NextResponse.json(
          { message: 'fal job failed', request_id, details: statusData },
          { status: 502 },
        );
      }
    }

    // 3. Fetch result
    const resultRes = await fetch(resultUrl, {
      headers: { Authorization: `Key ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resultRes.ok) {
      return NextResponse.json(
        {
          message: 'Video not ready in time — poll later',
          request_id,
          status_url: statusUrl,
          response_url: resultUrl,
        },
        { status: 504 },
      );
    }
    const result = (await resultRes.json()) as Record<string, unknown>;

    // fal returns { video: { url } } or { video_url } depending on model
    const video = (result.video as { url?: string } | undefined)?.url ?? (result.video_url as string | undefined);
    const seed = result.seed as number | undefined;

    return NextResponse.json({
      ok: true,
      model: modelKey,
      video_url: video,
      seed,
      raw: result,
      request_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fal animate failed';
    return NextResponse.json({ message }, { status: 500 });
  }
}

// Optional GET to poll an existing request_id (client-side resume after timeout)
export async function GET(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.FAL_AI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: 'FAL_AI_API_KEY not configured' }, { status: 500 });

  const requestId = req.nextUrl.searchParams.get('request_id');
  const modelKey = req.nextUrl.searchParams.get('model') ?? 'kling-2-5-turbo';
  const endpoint = MODEL_MAP[modelKey];
  if (!requestId || !endpoint) {
    return NextResponse.json({ message: 'request_id and valid model required' }, { status: 400 });
  }

  try {
    const resultRes = await fetch(`${FAL_QUEUE}/${endpoint}/requests/${requestId}`, {
      headers: { Authorization: `Key ${apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resultRes.ok) {
      const statusRes = await fetch(`${FAL_QUEUE}/${endpoint}/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      const st = await statusRes.json().catch(() => ({}));
      return NextResponse.json({ ok: false, status: st, ready: false });
    }
    const result = (await resultRes.json()) as Record<string, unknown>;
    const video = (result.video as { url?: string } | undefined)?.url ?? (result.video_url as string | undefined);
    return NextResponse.json({ ok: true, ready: !!video, video_url: video, raw: result });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'poll failed' },
      { status: 500 },
    );
  }
}
