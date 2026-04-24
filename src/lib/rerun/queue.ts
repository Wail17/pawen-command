// ============================================================
// PAWEN — Phase U.3b — Rerun queue client helpers
// ============================================================

import { isAutonomousModeEnabled, isAutoRerunEnabled } from '../learning/autonomousMode';

export interface RerunRow {
  id: number;
  projectId: string;
  gateId: string;
  reason: string;
  severity: 'info' | 'warn' | 'critical';
  source: string;
  status: 'pending' | 'needs_human' | 'claimed' | 'done' | 'cancelled';
  createdAt: string;
}

export async function fetchPendingRerunsForProject(projectId: string): Promise<RerunRow[]> {
  const res = await fetch(`/api/rerun/pending?projectId=${encodeURIComponent(projectId)}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) return [];
  const data = await res.json() as { ok: boolean; rows?: RerunRow[] };
  return data.ok && Array.isArray(data.rows) ? data.rows : [];
}

export async function claimRerun(id: number): Promise<RerunRow | null> {
  const res = await fetch('/api/rerun/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { ok: boolean; claimed?: RerunRow | null };
  return data.ok ? (data.claimed ?? null) : null;
}

export async function markRerunDone(id: number, status: 'done' | 'cancelled' = 'done'): Promise<void> {
  try {
    await fetch('/api/rerun/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id, status }),
    });
  } catch { /* best-effort */ }
}

/**
 * Should Léa auto-approve this pending rerun? Per Q-003: yes iff
 * AUTO_RERUN_ON_DROP is enabled AND the project has shown a gate review
 * score ≥ 80 historically (proxied here by autonomous-mode flag; a stricter
 * check would pull per-project avgScore, deferred).
 */
export function leaShouldAutoClaim(row: RerunRow): boolean {
  if (!isAutonomousModeEnabled()) return false;
  if (!isAutoRerunEnabled()) return false;
  if (row.status !== 'pending') return false;
  // Only auto-claim CRITICAL — WARN/INFO waits for human.
  return row.severity === 'critical';
}
