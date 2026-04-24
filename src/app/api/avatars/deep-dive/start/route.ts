// ============================================================
// PAWEN — /api/avatars/deep-dive/start
// Background-job version of /api/avatars/deep-dive. Returns
// { jobId } immediately; the actual Opus call runs server-side
// via Next.js `after()` so the user can close the tab and come
// back later to see the result.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/auth/audit';
import { createJob } from '@/lib/jobs/db';
import { runDeepDiveJob } from '@/lib/jobs/deepDiveWorker';
import type { CoreAvatarInput, DeepDiveResult, SubAvatarV2 } from '@/lib/avatars/types';

// Hobby plan caps Vercel functions at 300s. Opus deep-dive with
// max_tokens=10000 + 7-dimension prompt regularly takes 100-220s.
export const maxDuration = 300;

interface StartBody {
  projectId: string;
  gateId?: string;
  core: CoreAvatarInput;
  subAvatar: SubAvatarV2;
  focus?: string | null;
  priorDives?: DeepDiveResult[];
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
  if (!body.core || !body.subAvatar) {
    return NextResponse.json(
      { ok: false, message: 'core and subAvatar are required' },
      { status: 400 },
    );
  }

  const gateId = body.gateId ?? 'gate1';
  const jobId = `job_${randomUUID()}`;
  const focus = body.focus?.trim() || null;
  const priorDives = Array.isArray(body.priorDives) ? body.priorDives : [];

  await createJob({
    id: jobId,
    owner: session.user,
    projectId: body.projectId,
    gateId,
    type: 'deep_dive',
    payload: {
      subAvatarId: body.subAvatar.id,
      subAvatarNickname: body.subAvatar.nickname,
      focus,
      priorDiveCount: priorDives.length,
    },
  });

  await writeAudit(req, session.user, 'avatar.deepdive.generate', {
    jobId,
    projectId: body.projectId,
    subAvatarId: body.subAvatar.id,
    focus,
    priorDives: priorDives.length,
    background: true,
  });

  // Fire the worker AFTER the response is sent. `after()` keeps the
  // function alive for maxDuration, so the run continues even though
  // the user already got their { jobId } back.
  after(async () => {
    try {
      await runDeepDiveJob({
        jobId,
        core: body.core,
        subAvatar: body.subAvatar,
        focus,
        priorDives,
      });
    } catch (err) {
      console.error(`[deep-dive/start] worker for ${jobId} crashed:`, err);
    }
  });

  return NextResponse.json({ ok: true, jobId });
}
