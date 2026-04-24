// ============================================================
// PAWEN — /api/cron/meta-perf
//
// Phase U.3a — hourly/bi-hourly Meta Ads performance pull +
// drop detection + rerun-queue enqueue.
//
// Auth: `x-cron-secret` header must match CRON_SECRET env var.
// No session, no user — the cron service is the caller.
//
// Wiring (vercel.json cron):
//   { "path": "/api/cron/meta-perf", "schedule": "0 */2 * * *" }
// ============================================================

import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/client';
import { fetchMetaCampaignInsights, detectDrop } from '@/lib/meta-ads/perfPull';
import { isAutoRerunEnabled } from '@/lib/learning/autonomousMode';
import { writeAudit } from '@/lib/auth/audit';

export const maxDuration = 300;

// Lazy schema creation so first deploys don't need an out-of-band migration.
async function ensureSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ad_performance_snapshots (
      id            BIGSERIAL PRIMARY KEY,
      project_id    TEXT NOT NULL,
      campaign_id   TEXT NOT NULL,
      pulled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      window_preset TEXT NOT NULL,
      spend         NUMERIC,
      impressions   BIGINT,
      clicks        BIGINT,
      ctr           NUMERIC,
      cpa           NUMERIC,
      roas          NUMERIC,
      conversions   BIGINT,
      raw           JSONB
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ad_performance_snapshots_project_campaign_idx
    ON ad_performance_snapshots (project_id, campaign_id, pulled_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rerun_queue (
      id            BIGSERIAL PRIMARY KEY,
      project_id    TEXT NOT NULL,
      gate_id       TEXT NOT NULL,
      reason        TEXT NOT NULL,
      severity      TEXT NOT NULL,
      source        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      picked_at     TIMESTAMPTZ,
      claimed_by    TEXT
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS rerun_queue_project_status_idx
    ON rerun_queue (project_id, status, created_at DESC)
  `;
}

function boolEnv(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

export async function GET(req: Request) {
  // Auth: only the cron service (or a human with the secret) gets in.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, message: 'CRON_SECRET not configured' },
      { status: 500 },
    );
  }
  const got = req.headers.get('x-cron-secret') ?? '';
  // Vercel cron also sends an Authorization: Bearer CRON_SECRET header
  const bearerHeader = req.headers.get('authorization');
  const bearer = bearerHeader && bearerHeader.startsWith('Bearer ')
    ? bearerHeader.slice(7)
    : '';
  if (got !== expected && bearer !== expected) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 401 });
  }

  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: 'META_ACCESS_TOKEN not configured — cron skipped' },
      { status: 200 },
    );
  }

  await ensureSchema();
  const sql = getSql();

  // Iterate every project in the mirror that has metaCampaignIds[] in its data.
  type ProjectRow = { id: string; data: Record<string, unknown> & { metaCampaignIds?: string[]; needsRerun?: unknown } };
  const projects = (await sql`
    SELECT id, data FROM projects_mirror
    WHERE jsonb_typeof(data->'metaCampaignIds') = 'array'
      AND jsonb_array_length(data->'metaCampaignIds') > 0
  `) as ProjectRow[];

  const perProjectSummary: Array<{
    projectId: string;
    campaignId: string;
    severity: string;
    reason: string;
    enqueued: boolean;
  }> = [];

  for (const proj of projects) {
    const campaignIds = Array.isArray(proj.data.metaCampaignIds) ? proj.data.metaCampaignIds : [];
    for (const cid of campaignIds) {
      if (typeof cid !== 'string' || cid.length === 0) continue;

      const current = await fetchMetaCampaignInsights(cid, accessToken, 'yesterday');
      if (!current) continue;

      // Persist snapshot
      await sql`
        INSERT INTO ad_performance_snapshots
          (project_id, campaign_id, window_preset, spend, impressions, clicks, ctr, cpa, roas, conversions, raw)
        VALUES
          (${proj.id}, ${cid}, ${current.datePreset},
           ${current.spend}, ${current.impressions}, ${current.clicks},
           ${current.ctr}, ${current.cpa}, ${current.roas},
           ${current.conversions}, ${JSON.stringify(current)}::jsonb)
      `;

      // Get a baseline: the most recent snapshot before this one for same campaign
      const baselineRows = (await sql`
        SELECT spend, impressions, clicks, ctr, cpa, roas, conversions, raw
        FROM ad_performance_snapshots
        WHERE project_id = ${proj.id} AND campaign_id = ${cid}
        ORDER BY pulled_at DESC
        OFFSET 1 LIMIT 1
      `) as Array<{ spend: string; ctr: string; cpa: string; roas: string; raw: Record<string, unknown> }>;

      const baseline = baselineRows[0];
      if (!baseline) {
        perProjectSummary.push({
          projectId: proj.id,
          campaignId: cid,
          severity: 'no-baseline',
          reason: 'first snapshot — nothing to compare',
          enqueued: false,
        });
        continue;
      }

      const baselineSnap = {
        campaignId: cid,
        datePreset: 'baseline',
        spend: Number(baseline.spend) || 0,
        impressions: 0,
        clicks: 0,
        ctr: Number(baseline.ctr) || 0,
        cpc: 0,
        cpm: 0,
        frequency: 0,
        conversions: 0,
        conversionValue: 0,
        cpa: Number(baseline.cpa) || 0,
        roas: Number(baseline.roas) || 0,
        pulledAt: new Date(0).toISOString(),
      };

      const verdict = detectDrop(current, baselineSnap);

      let enqueued = false;
      if (verdict.severity === 'critical') {
        // Infer gate to rerun. MVP: always gate4 (hooks) — future can map by
        // which dimension dropped (hooks → gate4, creative → gate7/8, offer → gate6).
        const gateToRerun = 'gate4';
        const auto = isAutoRerunEnabled();
        const status = auto ? 'pending' : 'needs_human';

        // Cap: max 1 auto-rerun per (project, gate) per 24h.
        const recent = (await sql`
          SELECT id FROM rerun_queue
          WHERE project_id = ${proj.id}
            AND gate_id = ${gateToRerun}
            AND created_at > NOW() - INTERVAL '24 hours'
          LIMIT 1
        `) as Array<{ id: number }>;

        if (recent.length === 0) {
          await sql`
            INSERT INTO rerun_queue (project_id, gate_id, reason, severity, source, status)
            VALUES (${proj.id}, ${gateToRerun}, ${verdict.reason},
                    ${verdict.severity}, 'cron:meta-drop', ${status})
          `;
          enqueued = true;

          await writeAudit(req, 'cron', 'phase_u.rerun.enqueue', {
            projectId: proj.id,
            campaignId: cid,
            gateId: gateToRerun,
            severity: verdict.severity,
            reason: verdict.reason,
            status,
          });

          // Discord notif (best-effort)
          const webhook = process.env.DISCORD_WEBHOOK_URL;
          if (webhook) {
            const text = `⚠️ Phase U · Meta drop CRITICAL · project ${proj.id} · campaign ${cid} · ${verdict.reason} · queued ${status}`;
            fetch(webhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: text }),
            }).catch(() => { /* non-blocking */ });
          }
        }
      }

      perProjectSummary.push({
        projectId: proj.id,
        campaignId: cid,
        severity: verdict.severity,
        reason: verdict.reason,
        enqueued,
      });
    }
  }

  await writeAudit(req, 'cron', 'phase_u.meta.perf_pull', {
    projects: projects.length,
    snapshots: perProjectSummary.length,
    critical: perProjectSummary.filter(s => s.severity === 'critical').length,
  });

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    projects: projects.length,
    snapshots: perProjectSummary,
    autoRerun: boolEnv(process.env.AUTO_RERUN_ON_DROP),
  });
}
