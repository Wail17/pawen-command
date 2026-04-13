// ============================================================
// PAWEN — /api/imagegen — fal.ai Proxy
// Supports: Nano Banana Pro, FLUX.2 Pro, Imagen 4 Fast
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/session';

const FAL_API_URL = 'https://queue.fal.run';

// Available fal.ai models — add new ones here
const FAL_MODELS: Record<string, string> = {
  'nano-banana-pro': 'fal-ai/nano-banana-pro',
  'flux-2-pro': 'fal-ai/flux-pro/v1.1',
  'imagen-4-fast': 'fal-ai/imagen4/preview/image-generation',
};

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  const apiKey = process.env.FAL_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: 'FAL_AI_API_KEY not configured' }, { status: 500 });
  }

  const {
    model = 'flux-2-pro',
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

  const modelEndpoint = FAL_MODELS[model];
  if (!modelEndpoint) {
    return NextResponse.json(
      { message: `Unknown model: ${model}. Available: ${Object.keys(FAL_MODELS).join(', ')}` },
      { status: 400 }
    );
  }

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
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.detail || 'fal.ai error' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      images: data.images ?? [],
      seed: data.seed,
      model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
