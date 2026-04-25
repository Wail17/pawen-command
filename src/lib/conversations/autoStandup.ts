// ============================================================
// PAWEN — Auto-standup orchestrator (server-side)
//
// Picks the most-stale project (recently touched but no system convo
// in 24h) and fires a Léa-led standup. Used by:
//   - Meta-perf cron (daily piggyback)
//   - /api/cron/team-standup (external scheduler)
//   - Manual admin trigger
//
// Honors the 6h cooldown inside startSystemConversation, so even
// if multiple triggers race, only one convo lands.
// ============================================================

import 'server-only';
import { getSql } from '../db/client';
import { startSystemConversation } from './systemStart';
import { isConversationsEnabled } from '../learning/autonomousMode';

interface StaleProject {
  projectId: string;
  projectName: string;
  niche: string;
  hoursSinceLastConv: number;
}

export async function pickStaleProject(): Promise<StaleProject | null> {
  try {
    const sql = getSql();
    type Row = { id: string; name: string; data: Record<string, unknown>; last_conv: string | null };
    // Active in last 14 days, no system conversation in 24h.
    const rows = (await sql`
      SELECT
        p.id,
        p.name,
        p.data,
        (SELECT MAX(c.created_at)
         FROM conversations_mirror c
         WHERE c.project_id = p.id AND c.initiator = 'system') AS last_conv
      FROM projects_mirror p
      WHERE p.updated_at > NOW() - INTERVAL '14 days'
      ORDER BY p.updated_at DESC
      LIMIT 30
    `) as Row[];

    const now = Date.now();
    for (const r of rows) {
      const lastConvMs = r.last_conv ? new Date(r.last_conv).getTime() : 0;
      const hoursSince = lastConvMs ? (now - lastConvMs) / 3600_000 : 9999;
      if (hoursSince >= 24) {
        const data = (r.data ?? {}) as Record<string, unknown>;
        return {
          projectId: r.id,
          projectName: r.name ?? 'untitled',
          niche: typeof data.niche === 'string' ? data.niche : '',
          hoursSinceLastConv: Math.round(hoursSince),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function fireStandupForProject(p: StaleProject, source: 'cron-meta' | 'cron-external' | 'login-checkin' | 'manual'): Promise<{ created: boolean; conversationId?: string; skipped?: string }> {
  const opening = `Team — quick autonomous standup on ${p.projectName}${p.niche ? ` (${p.niche})` : ''}. ` +
    `Last team activity here was ${p.hoursSinceLastConv}h ago. ` +
    `What's the unresolved decision? What's the next concrete move? ` +
    `Each agent: ONE sentence on your area. I'll close with the priority list.`;

  const result = await startSystemConversation({
    projectId: p.projectId,
    trigger: source === 'login-checkin' ? 'IDLE_CHECKIN' : 'STANDUP',
    topic: `Auto standup · ${p.projectName}`,
    openingMessage: opening,
    maxChainLength: 4,
  });
  return result;
}

/**
 * Combined: pick + fire. Returns null when conversations are disabled,
 * no stale project found, or the cooldown swallowed it.
 */
export async function runAutoStandup(source: 'cron-meta' | 'cron-external' | 'login-checkin' | 'manual'): Promise<{ ranAt: string; project?: StaleProject; result?: Awaited<ReturnType<typeof fireStandupForProject>> } | null> {
  if (!isConversationsEnabled()) return null;
  const p = await pickStaleProject();
  if (!p) return { ranAt: new Date().toISOString() };
  const result = await fireStandupForProject(p, source);
  return { ranAt: new Date().toISOString(), project: p, result };
}
