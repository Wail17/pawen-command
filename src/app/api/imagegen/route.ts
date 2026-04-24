// ============================================================
// PAWEN — /api/imagegen — fal.ai Proxy
// Supports: Nano Banana Pro, FLUX.2 Pro, Imagen 4 Fast
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

const FAL_API_URL = 'https://queue.fal.run';

export const maxDuration = 300;

async function pollQueueResult(statusUrl: string, responseUrl: string, apiKey: string, maxMs = 180_000): Promise<Record<string, unknown>> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`Status poll failed: ${r.status}`);
    const s = await r.json();
    if (s.status === 'COMPLETED') {
      const finalRes = await fetch(responseUrl, {
        headers: { Authorization: `Key ${apiKey}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (!finalRes.ok) throw new Error(`Result fetch failed: ${finalRes.status}`);
      return finalRes.json();
    }
    if (s.status === 'FAILED') throw new Error(`fal.ai job failed: ${JSON.stringify(s)}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('fal.ai job timed out after 3 min');
}

// LOCKED: Nano Banana Pro is the ONLY image model. All other models disabled.
const FAL_MODELS: Record<string, string> = {
  'nano-banana-pro': 'fal-ai/nano-banana-pro',
};
const FORCED_MODEL = 'nano-banana-pro';

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.FAL_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'FAL_AI_API_KEY not configured' }, { status: 500 });
  }

  const {
    prompt,
    negativePrompt = '',
    width = 1024,
    height = 1024,
    guidanceScale = 10,
    numImages = 1,
    imageUrl,           // reference image URL
    imageWeight = 1.0,  // reference image weight
  } = await req.json();

  if (!prompt) {
    return NextResponse.json({ message: 'Prompt is required' }, { status: 400 });
  }

  const model = FORCED_MODEL;
  const modelEndpoint = FAL_MODELS[model];

  const requestBody: Record<string, unknown> = {
    prompt,
    negative_prompt: negativePrompt,
    image_size: { width, height },
    guidance_scale: guidanceScale,
    num_images: numImages,
    output_format: 'png',
    enable_safety_checker: false,
  };

  // Add reference image if provided
  if (imageUrl) {
    requestBody.image_url = imageUrl;
    requestBody.strength = imageWeight;
  }

  try {
    const response = await fetch(`${FAL_API_URL}/${modelEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.detail || 'fal.ai error' },
        { status: response.status }
      );
    }

    const queueResp = await response.json();
    // Queue submit returns { request_id, status_url, response_url } — poll until done
    if (!queueResp.status_url || !queueResp.response_url) {
      // sync response (some models don't queue) — return directly
      return NextResponse.json({
        images: queueResp.images ?? [],
        seed: queueResp.seed,
        model,
      });
    }

    const data = await pollQueueResult(queueResp.status_url, queueResp.response_url, apiKey);
    return NextResponse.json({
      images: (data.images as Record<string, unknown>[]) ?? [],
      seed: data.seed,
      model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
