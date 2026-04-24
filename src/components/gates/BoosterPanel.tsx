'use client';

// ============================================================
// PAWEN — BoosterPanel
//
// Per-sub-avatar feedback loop. User picks a depth (3 / 5 / 10
// cycles). Each cycle is a background deep-dive that sees prior
// cycles + is instructed to find angles the prior cycles missed.
//
// When all cycles complete, a "Re-run Gates 4-9" button appears
// that runs the batch pipeline for JUST this sub-avatar, so the
// boosted insights propagate into the creative work.
//
// Guards:
//   - Brand DNA must be locked before re-running creative gates
//   - Only one booster active per SA at a time
//   - Abort support via AbortController (cancel button)
// ============================================================

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Project, BatchSubAvatarRunStatus, GateId } from '@/lib/types';
import type { CoreAvatarInput, SubAvatarV2, DeepDiveResult } from '@/lib/avatars/types';
import { runBooster, type BoosterProgress } from '@/lib/avatars/booster';
import { appendDeepDive } from '@/lib/avatars/enrich';
import { runBatchPipeline, canStartBatchPipeline } from '@/lib/pipeline/batchPipeline';
import { saveProject, getGateOutputsForSubAvatar } from '@/lib/store/db';

const DEPTH_OPTIONS = [3, 5, 10] as const;
const CREATIVE_GATES: GateId[] = ['gate4', 'gate5', 'gate6', 'gate7', 'gate8', 'gate9'];

interface BoosterPanelProps {
  project: Project;
  core: CoreAvatarInput;
  subAvatar: SubAvatarV2;
  onUpdateSubAvatar: (updated: SubAvatarV2) => Promise<void>;
  onProjectChange: (project: Project) => void;
}

export function BoosterPanel({
  project,
  core,
  subAvatar,
  onUpdateSubAvatar,
  onProjectChange,
}: BoosterPanelProps) {
  const [depth, setDepth] = useState<number>(5);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BoosterProgress | null>(null);
  const [producedDives, setProducedDives] = useState<DeepDiveResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reRunning, setReRunning] = useState(false);
  const [reRunStatuses, setReRunStatuses] = useState<Record<string, BatchSubAvatarRunStatus>>({});
  const [reRunError, setReRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const brandDNALocked = !!project.brandDNA?.locked;
  const saRef = useRef(subAvatar);
  saRef.current = subAvatar;

  const totalInsights = useMemo(() => {
    return producedDives.reduce(
      (acc, d) => ({
        verbatims: acc.verbatims + (d.new_verbatims?.length ?? 0),
        fears: acc.fears + (d.hidden_fears?.length ?? 0),
        contradictions: acc.contradictions + (d.contradictions?.length ?? 0),
        triggers: acc.triggers + (d.sharper_triggers?.length ?? 0),
        objections: acc.objections + (d.buying_objections?.length ?? 0),
        segments: acc.segments + (d.micro_segments?.length ?? 0),
      }),
      { verbatims: 0, fears: 0, contradictions: 0, triggers: 0, objections: 0, segments: 0 },
    );
  }, [producedDives]);

  const handleStart = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setProgress(null);
    setProducedDives([]);
    abortRef.current = new AbortController();

    try {
      const dives = await runBooster({
        projectId: project.id,
        core,
        subAvatar: saRef.current,
        depth,
        signal: abortRef.current.signal,
        callbacks: {
          onCycleStart: (cycle, total) => {
            setProgress({ cycle, totalCycles: total, phase: 'starting', message: `Cycle ${cycle}/${total} starting…`, percent: 0 });
          },
          onProgress: (p) => setProgress(p),
          onCycleComplete: async (_cycle, dive) => {
            // Append dive to the sub-avatar IMMEDIATELY so later cycles
            // (and the UI) see it — saRef.current is always the latest.
            const next = appendDeepDive(saRef.current, dive);
            saRef.current = next;
            await onUpdateSubAvatar(next);
            setProducedDives((prev) => [...prev, dive]);
          },
          onError: (cycle, msg) => {
            setError(`Cycle ${cycle}: ${msg}`);
          },
        },
      });
      setProducedDives(dives);
    } catch (err) {
      console.error('[BoosterPanel] Booster crashed:', err);
      if (!abortRef.current?.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Booster failed');
      }
    } finally {
      setRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }, [running, project.id, core, depth, onUpdateSubAvatar]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setProgress(null);
  }, []);

  const handleReRunCreative = useCallback(async () => {
    if (reRunning) return;
    if (!brandDNALocked) {
      setReRunError('Lock Brand DNA before re-running creative gates.');
      return;
    }

    const ids = [subAvatar.id];
    const check = canStartBatchPipeline(
      { ...project, gateStatuses: { ...project.gateStatuses, gate1: 'approved' } },
      ids,
    );
    if (!check.ok) {
      setReRunError(check.reason ?? 'Cannot start re-run.');
      return;
    }

    // Preflight: gate4 needs gate2+gate3 context. If this SA has never run
    // those upstream gates, re-running creative gates will fail.
    const prev = await getGateOutputsForSubAvatar(project.id, subAvatar.id);
    const missingUpstream: string[] = [];
    if (!prev.gate2) missingUpstream.push('gate2');
    if (!prev.gate3) missingUpstream.push('gate3');
    if (missingUpstream.length > 0) {
      setReRunError(
        `This sub-avatar has never run ${missingUpstream.join(' + ')}. Run the full Matrix pipeline (Gate 2→9) first, then re-run with Booster.`,
      );
      return;
    }

    setReRunError(null);
    setReRunning(true);
    setReRunStatuses({});

    // Ensure Gate 1 is marked approved and that this SA is in focus.
    const launchProject: Project = {
      ...project,
      selectedSubAvatarId: subAvatar.id,
      batchSubAvatarIds: ids,
      batchRunStatus: {},
      gateStatuses: { ...project.gateStatuses, gate1: 'approved' },
    };
    await saveProject(launchProject);
    onProjectChange(launchProject);

    try {
      await runBatchPipeline(launchProject, ids, {
        onStatusChange: (map) => setReRunStatuses({ ...map }),
        onProjectUpdate: (p) => onProjectChange(p),
      }, CREATIVE_GATES);
    } catch (err) {
      console.error('[BoosterPanel] Re-run Gates 4→9 crashed:', err);
      setReRunError(err instanceof Error ? err.message : 'Re-run failed');
    } finally {
      setReRunning(false);
    }
  }, [reRunning, brandDNALocked, project, subAvatar.id, onProjectChange]);

  const reRunStatus = reRunStatuses[subAvatar.id];
  const reRunDone = reRunStatus?.completedGates?.length ?? 0;
  const reRunTotal = reRunStatus?.plannedGates?.length ?? CREATIVE_GATES.length;
  const reRunPercent = reRunTotal > 0 ? Math.round((reRunDone / reRunTotal) * 100) : 0;
  const priorDiveCount = subAvatar.deep_dives?.length ?? 0;

  return (
    <div className="rounded-xl border border-orange-500/40 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-orange-300 flex items-center gap-2">
            <span>⚡</span> Booster — feedback loop
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            Each cycle = 1 deep-dive that sees the prior cycles and goes deeper.
            Prior dives on this SA: <span className="text-text-primary font-semibold">{priorDiveCount}</span>
          </div>
        </div>
        {!running && (
          <div className="flex items-center gap-1.5">
            {DEPTH_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                  depth === d
                    ? 'bg-orange-500 text-black'
                    : 'bg-bg-input text-text-muted hover:text-text-primary border border-border'
                }`}
              >
                {d}×
              </button>
            ))}
          </div>
        )}
      </div>

      {!running && producedDives.length === 0 && (
        <button
          onClick={handleStart}
          className="w-full px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-bold text-sm transition-colors"
        >
          🚀 Launch {depth}-cycle Booster
        </button>
      )}

      {running && (
        <div className="space-y-2">
          {progress && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-orange-300 font-semibold">
                  Cycle {progress.cycle}/{progress.totalCycles} — {progress.phase}
                </span>
                <span className="text-text-muted">{progress.percent}%</span>
              </div>
              <div className="h-2 bg-bg-input rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="text-xs text-text-muted truncate">{progress.message}</div>
            </>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-text-muted">
              Produced so far: <span className="text-text-primary font-semibold">{producedDives.length}</span> dives
            </div>
            <button
              onClick={handleCancel}
              className="px-3 py-1 rounded-md text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-2 text-xs rounded border border-red-500/40 bg-red-500/10 text-red-300">
          {error}
        </div>
      )}

      {!running && producedDives.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-emerald-300">
            ✓ Booster complete — {producedDives.length} new dive{producedDives.length > 1 ? 's' : ''} appended
          </div>
          <div className="grid grid-cols-3 gap-2">
            <InsightTile label="+Verbatims" value={totalInsights.verbatims} />
            <InsightTile label="+Hidden fears" value={totalInsights.fears} />
            <InsightTile label="+Triggers" value={totalInsights.triggers} />
            <InsightTile label="+Contradictions" value={totalInsights.contradictions} />
            <InsightTile label="+Objections" value={totalInsights.objections} />
            <InsightTile label="+Micro-segments" value={totalInsights.segments} />
          </div>

          <div className="pt-2 border-t border-orange-500/20 space-y-2">
            <div className="text-xs text-text-muted">
              Re-run creative gates (4→9) for <span className="text-text-primary font-semibold">{subAvatar.nickname}</span> to
              propagate the new signal into hooks, copy, concepts, and images.
            </div>
            {!brandDNALocked && (
              <div className="p-2 text-xs rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
                ⚠ Lock Brand DNA before re-running creative gates.
              </div>
            )}
            {reRunError && (
              <div className="p-2 text-xs rounded border border-red-500/40 bg-red-500/10 text-red-300">
                {reRunError}
              </div>
            )}
            {reRunning && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-orange-300 font-semibold">
                    {reRunStatus?.currentGate ? `Running ${reRunStatus.currentGate}` : 'Starting…'}
                  </span>
                  <span className="text-text-muted">{reRunDone}/{reRunTotal}</span>
                </div>
                <div className="h-2 bg-bg-input rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${reRunPercent}%` }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={handleReRunCreative}
              disabled={reRunning || !brandDNALocked}
              className="w-full px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition-colors"
            >
              {reRunning ? `🔄 Re-running ${reRunStatus?.currentGate ?? '…'}` : '🔄 Re-run Gates 4→9 for this sub-avatar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-bg-input border border-border p-2 text-center">
      <div className="text-lg font-bold text-orange-300">{value}</div>
      <div className="text-[10px] text-text-muted uppercase tracking-wide">{label}</div>
    </div>
  );
}
