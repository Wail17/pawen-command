// ============================================================
// PAWEN — /api/cron/team-standup   (Phase V external trigger)
//
// External cron endpoint (cron-job.org, EasyCron, GitHub Action…)
// to fire an auto standup on the most-stale project. Auth: x-cron-secret
// matching CRON_SECRET. Idempotent thanks to the 6h cooldown.
//
// Optional ?projectId=X to force a specific project.
// ============================================================

import { NextResponse } from 'next/server';
import { writeAudit } from '@/lib/auth/audit';
import { runAutoStandup, fireStandupForProject } from '@/lib/conversations/autoStandup';
import { getSql } from '@/lib/db/client';

export const maxDuration = 240;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ ok: false, message: 'CRON_SECRET not configured' }, { status: 500 });
  const got = req.headers.get('x-cron-secret') ?? '';
  const bearer = req.headers.get('authorization')?.startsWith('Bearer ')
    ? req.headers.get('authorization')!.slice(7)
    : '';
  if (got !== expected && bearer !== expected) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 401 });
  }

  const url = new URL(req.url);
  const forceProjectId = url.searchParams.get('projectId');

  if (forceProjectId) {
    // Look up the project + run
    const sql = getSql();
    type Row = { id: string; name: string; data: Record<string, unknown> };
    const rows = (await sql`SELECT id, name, data FROM projects_mirror WHERE id = ${forceProjectId} LIMIT 1`) as Row[];
    const r = rows[0];
    if (!r) return NextResponse.json({ ok: false, message: 'project not found' }, { status: 404 });
    const data = (r.data ?? {}) as Record<string, unknown>;
    const result = await fireStandupForProject({
      projectId: r.id,
      projectName: r.name ?? 'untitled',
      niche: typeof data.niche === 'string' ? data.niche : '',
      hoursSinceLastConv: 0,
    }, 'cron-external');
    await writeAudit(req, 'cron', 'phase_v.conversation.start', { source: 'external-cron', projectId: r.id, forced: true, ...result });
    return NextResponse.json({ ok: true, forced: true, result });
  }

  const out = await runAutoStandup('cron-external');
  await writeAudit(req, 'cron', 'phase_v.conversation.start', { source: 'external-cron', auto: true, picked: out?.project?.projectId ?? null });
  return NextResponse.json({ ok: true, ...out });
}
