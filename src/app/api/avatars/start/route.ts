// ============================================================
// PAWEN — /api/avatars/start
// Kicks off a Gate 1 Avatar Excavation as a BACKGROUND JOB.
// Returns { jobId } immediately; the actual run continues
// server-side via Next.js `after()` so the user can close the
// tab and reconnect later to see the result.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { createJob } from '@/lib/jobs/db';
import { runAvatarJob } from '@/lib/jobs/avatarWorker';
import type { CoreAvatarInput, SourceConfig } from '@/lib/avatars/types';
import type { RedditDepth } from '@/lib/sources/reddit';
import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';

// Vercel Hobby caps Serverless Function duration at 300s, Pro/Ent at 800.
// We deploy on Hobby today so we ship with 300; upgrading the plan is a
// pure config change (bump this number, redeploy). On rich niches the
// excavation can take 8-12 min and will hit the cap — the stale-job
// watchdog (reapStaleJob) auto-fails them after 5 min of silence so the
// UI gets a clear error instead of polling forever.
export const maxDuration = 300;

interface StartBody {
  projectId: string;
  gateId?: string;            // defaults to 'gate1'
  core: CoreAvatarInput;
  config?: SourceConfig;
  redditDepth?: RedditDepth;
  reverseSeeds?: ReverseEngineeredFunnel | null;
}

function deriveBaseUrl(req: NextRequest): string {
  // Trust the Vercel-set production URL when present, otherwise fall back to
  // the request origin (works for preview deployments + local dev).
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  const protoHeader = req.headers.get('x-forwarded-proto') ?? 'https';
  const hostHeader = req.headers.get('host') ?? new URL(req.url).host;
  return `${protoHeader}://${hostHeader}`;
}

export async function POST(req: NextRequest) {
  const session = requireSession(req);
  if (session instanceof Response) return session;

  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.projectId || typeof body.projectId !== 'string') {
    return NextResponse.json({ ok: false, message: 'projectId is required' }, { status: 400 });
  }
  if (!body.core || !body.core.product || !body.core.niche) {
    return NextResponse.json(
      { ok: false, message: 'core { product, niche, surface_desire, language, market } is required' },
      { status: 400 },
    );
  }

  const gateId = body.gateId ?? 'gate1';
  const jobId = `job_${randomUUID()}`;

  // Capture session cookie value so the worker can authenticate against
  // internal /api/* calls (proxy.ts session gate). The cookie is held in
  // closure only — never persisted to the DB.
  const sessionCookieHeader = req.headers.get('cookie') ?? '';
  const baseUrl = deriveBaseUrl(req);

  await createJob({
    id: jobId,
    owner: session.user,
    projectId: body.projectId,
    gateId,
    type: 'avatar_excavation',
    payload: {
      core: body.core,
      config: body.config,
      redditDepth: body.redditDepth,
      reverseSeeds: body.reverseSeeds ?? null,
    },
  });

  await writeAudit(req, session.user, 'avatar.job.start', {
    jobId,
    projectId: body.projectId,
    niche: body.core.niche,
  });

  // Fire the worker AFTER the response is sent. `after()` keeps the function
  // alive for the configured maxDuration, so the run keeps going even though
  // the user already got their { jobId } back.
  after(async () => {
    try {
      await runAvatarJob({
        jobId,
        baseUrl,
        sessionCookie: sessionCookieHeader,
        core: body.core,
        config: body.config,
        redditDepth: body.redditDepth,
        reverseSeeds: body.reverseSeeds ?? null,
      });
    } catch (err) {
      console.error(`[avatars/start] worker for ${jobId} crashed:`, err);
    }
  });

  return NextResponse.json({ ok: true, jobId });
}
