// ============================================================
// PAWEN — Batch Pipeline Engine (Matrix Mode)
//
// Runs Gate 2→9 for N sub-avatars with bounded concurrency.
// Each SA uses its own recommended funnel (from sa.recommended_awareness_level)
// and its own market sophistication stage.
//
// Architecture:
//   - SA-level: concurrency-limited via BATCH_CONCURRENCY (default 1)
//     to stay under Anthropic tier-1 rate limits. G2 alone fires 6 Opus
//     calls per SA; running many SAs at once triggers /api/generate's
//     4× retry loop (~295s each) and hits a ~1180s cumulative timeout.
//   - Gate-level within one SA: sequential (each gate depends on prior ones)
//   - One SA's failure does not block the others (error captured per-worker).
//   - Each gate output is stored under ${projectId}:${gateId}:${saId}
//     (Gate 1 + Brand DNA are shared, keyed as ${projectId}:${gateId})
// ============================================================

import {
  GateId,
  GateOutput,
  Project,
  FunnelType,
  BatchSubAvatarRunStatus,
  AWARENESS_TO_FUNNEL,
} from '../types';
import { SubAvatarV2 } from '../avatars/types';
import { getGateConfig } from '../gates/registry';
import { runGate } from '../agents/runGate';
import { saveGateOutput, saveProject, getGateOutputsForSubAvatar } from '../store/db';
import { unlockNextGate } from '../store/project-utils';
import { captureFromApproval } from '../learning/capture';

// Default batch range. Users can narrow this (e.g. gate2→gate5) from the UI.
export const BATCH_GATES: GateId[] = ['gate2', 'gate3', 'gate4', 'gate5', 'gate6', 'gate7', 'gate8', 'gate9'];

// Normalize a user-supplied gate list: keep order, dedupe, strip anything outside
// BATCH_GATES. Guarantees downstream code always gets a valid per-SA gate list.
function sanitizeGates(gates?: GateId[]): GateId[] {
  if (!gates || gates.length === 0) return [...BATCH_GATES];
  const set = new Set(gates);
  return BATCH_GATES.filter(g => set.has(g));
}

// Auto-approve threshold matches single-SA auto-pipeline.
const AUTO_APPROVE_THRESHOLD = 80;

// Max sub-avatars running their gate pipeline at the same time.
// G2 alone fires 6 Opus calls (5 sub-agents + lead compile) with 20-32k
// maxTokens each. Two SAs in parallel = 12 concurrent Opus calls → blows
// Anthropic tier-1 output-token rate limits → /api/generate retries 4×
// with ~295s AbortSignal.timeout each → ~1180s cumulative timeout → gate
// fails with "operation was aborted due to timeout". Keep at 1 to stay
// within rate limits. Bump only if on a higher Anthropic tier.
const BATCH_CONCURRENCY = 1;

export interface BatchPipelineCallbacks {
  // Fires whenever the per-SA status map changes (start / gate done / failure).
  onStatusChange?: (statusMap: Record<string, BatchSubAvatarRunStatus>) => void;
  // Fires after each (SA, gate) completes — useful for live UI updates.
  onGateComplete?: (args: {
    subAvatarId: string;
    gateId: GateId;
    score: number | null;
    status: BatchSubAvatarRunStatus;
  }) => void;
  // Fires when project is updated (gate-status changes etc.).
  onProjectUpdate?: (project: Project) => void;
}

export interface BatchPipelineResult {
  project: Project;
  statusBySubAvatar: Record<string, BatchSubAvatarRunStatus>;
  totalSubAvatars: number;
  successfulSubAvatars: number;
  failedSubAvatars: number;
}

/**
 * Derive the funnel an SA should target (recommended_awareness_level → FunnelType).
 * Falls back to project.selectedFunnel, then 'problem_aware'.
 */
function deriveFunnelForSA(sa: SubAvatarV2, project: Project): FunnelType {
  if (sa.recommended_awareness_level) {
    const mapped = AWARENESS_TO_FUNNEL[sa.recommended_awareness_level];
    if (mapped) return mapped;
  }
  return project.selectedFunnel ?? 'problem_aware';
}

/**
 * Run the configured gate range for a single sub-avatar, sequentially.
 * Never throws — returns a terminal status via the passed accumulator.
 */
async function runSingleSAPipeline(
  project: Project,
  subAvatar: SubAvatarV2,
  funnel: FunnelType,
  plannedGates: GateId[],
  updateStatus: (next: BatchSubAvatarRunStatus) => void,
  onGateComplete?: BatchPipelineCallbacks['onGateComplete'],
): Promise<BatchSubAvatarRunStatus> {
  const saId = subAvatar.id;
  const completedGates: GateId[] = [];

  const now = () => new Date().toISOString();
  const baseStatus: BatchSubAvatarRunStatus = {
    subAvatarId: saId,
    subAvatarNickname: subAvatar.nickname || subAvatar.name,
    funnel,
    sophisticationStage: subAvatar.market_sophistication?.stage,
    plannedGates,
    currentGate: null,
    completedGates,
    stoppedAt: null,
    reason: null,
    startedAt: now(),
    updatedAt: now(),
    status: 'running',
  };
  updateStatus(baseStatus);

  for (const gateId of plannedGates) {
    // Skip gates already approved for this SA — lets user resume mid-batch.
    // We only skip if there's already a per-SA gate output in status 'approved'.
    const existing = await getGateOutputsForSubAvatar(project.id, saId);
    const existingForGate = existing[gateId];
    if (existingForGate && existingForGate.status === 'approved') {
      completedGates.push(gateId);
      continue;
    }

    // Build previousOutputs from this SA's history (per-SA for gates 2-9, shared for gate1/brand-dna).
    const prevMap = await getGateOutputsForSubAvatar(project.id, saId);
    const previousOutputs: Record<string, unknown> = {};
    for (const [gId, out] of Object.entries(prevMap)) {
      if (gId !== gateId) previousOutputs[gId] = out.data;
    }

    const status: BatchSubAvatarRunStatus = {
      ...baseStatus,
      currentGate: gateId,
      completedGates: [...completedGates],
      updatedAt: now(),
    };
    updateStatus(status);

    try {
      const config = getGateConfig(gateId, project);
      const result = await runGate({
        gateId,
        projectId: project.id,
        project,
        config,
        previousGateOutputs: previousOutputs,
        maxReviewIterations: 3,
        subAvatarIdOverride: saId,
        funnelOverride: funnel,
      });

      const gateOutput: GateOutput = {
        gateId,
        projectId: project.id,
        subAvatarId: saId,
        status: result.status === 'error' ? 'pending_decisions' : result.status,
        data: result.parsedOutput,
        generationLog: result.generationLog,
        reviewResult: result.reviewResult,
        congruenceResult: result.congruenceResult,
        humanDecisions: {},
        checkpoint: null,
        createdAt: now(),
        updatedAt: now(),
      };
      await saveGateOutput(gateOutput);

      const score = result.reviewResult?.percentage ?? 0;

      if (result.status === 'error') {
        // Pull the real error out of generationLog so the UI shows the root
        // cause instead of "runGate returned error status". runGate's catch
        // block writes it as the last entry with agent='generator', iteration=0.
        const errLog = [...(result.generationLog ?? [])]
          .reverse()
          .find(e => e.agent === 'generator' && e.iteration === 0 && e.input_summary === 'Error');
        const rootCause = errLog?.output_summary ?? 'runGate returned error status (no detail)';
        const terminal: BatchSubAvatarRunStatus = {
          ...status,
          stoppedAt: gateId,
          reason: `${gateId}: ${rootCause}`,
          status: 'failed',
          updatedAt: now(),
        };
        updateStatus(terminal);
        onGateComplete?.({ subAvatarId: saId, gateId, score: null, status: terminal });
        return terminal;
      }

      // Auto-approve high scorers; leave low scorers as pending_decisions
      // so the user can review per-SA after the batch completes.
      if (score >= AUTO_APPROVE_THRESHOLD) {
        captureFromApproval({ project, gateId, gateOutput }).catch(() => {});
        const approved: GateOutput = { ...gateOutput, status: 'approved' };
        await saveGateOutput(approved);
      }

      completedGates.push(gateId);
      const done: BatchSubAvatarRunStatus = {
        ...status,
        completedGates: [...completedGates],
        currentGate: null,
        updatedAt: now(),
      };
      updateStatus(done);
      onGateComplete?.({ subAvatarId: saId, gateId, score, status: done });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      const terminal: BatchSubAvatarRunStatus = {
        ...status,
        stoppedAt: gateId,
        reason: `${gateId} threw: ${msg}`,
        status: 'failed',
        updatedAt: now(),
      };
      updateStatus(terminal);
      onGateComplete?.({ subAvatarId: saId, gateId, score: null, status: terminal });
      return terminal;
    }
  }

  const completed: BatchSubAvatarRunStatus = {
    ...baseStatus,
    completedGates,
    currentGate: null,
    updatedAt: now(),
    status: 'completed',
  };
  updateStatus(completed);
  return completed;
}

/**
 * Precondition check: Gate 1 must be approved AND Brand DNA must be locked,
 * OR the user must have explicitly acknowledged running without Brand DNA.
 */
export function canStartBatchPipeline(
  project: Project,
  subAvatarIds: string[],
): { ok: boolean; reason?: string } {
  if (project.gateStatuses.gate1 !== 'approved' && project.gateStatuses.gate1 !== 'pending_review') {
    return { ok: false, reason: 'Gate 1 (Avatar Excavation) must be completed first' };
  }
  if (!project.brandDNA?.locked) {
    return { ok: false, reason: 'Brand DNA must be locked before running the batch pipeline' };
  }
  if (subAvatarIds.length === 0) {
    return { ok: false, reason: 'No sub-avatars selected for batch' };
  }
  const available = project.avatarRunResult?.sub_avatars ?? [];
  const missing = subAvatarIds.filter(id => !available.some(sa => sa.id === id));
  if (missing.length > 0) {
    return { ok: false, reason: `Sub-avatars not found in Gate 1 result: ${missing.join(', ')}` };
  }
  return { ok: true };
}

/**
 * Run the full batch pipeline for N sub-avatars in parallel.
 * Each SA runs Gate 2→9 sequentially, independently of the others.
 * Failures in one SA do NOT stop the others (Promise.allSettled).
 */
export async function runBatchPipeline(
  project: Project,
  subAvatarIds: string[],
  callbacks: BatchPipelineCallbacks = {},
  gates?: GateId[],
): Promise<BatchPipelineResult> {
  const plannedGates = sanitizeGates(gates);
  const subAvatars = project.avatarRunResult?.sub_avatars ?? [];
  const queue = subAvatarIds
    .map(id => subAvatars.find(sa => sa.id === id))
    .filter((sa): sa is SubAvatarV2 => !!sa);

  // Initialize status map — all SAs start queued, mutations below flip them to running.
  const statusMap: Record<string, BatchSubAvatarRunStatus> = {};
  for (const sa of queue) {
    const funnel = deriveFunnelForSA(sa, project);
    statusMap[sa.id] = {
      subAvatarId: sa.id,
      subAvatarNickname: sa.nickname || sa.name,
      funnel,
      sophisticationStage: sa.market_sophistication?.stage,
      plannedGates,
      currentGate: null,
      completedGates: [],
      stoppedAt: null,
      reason: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'queued',
    };
  }

  // Persist initial status so the UI can render the grid even while nothing
  // has moved yet.
  let currentProject: Project = {
    ...project,
    batchSubAvatarIds: subAvatarIds,
    batchRunStatus: { ...statusMap },
  };
  await saveProject(currentProject);
  callbacks.onProjectUpdate?.(currentProject);
  callbacks.onStatusChange?.({ ...statusMap });

  // Debounced persist: status can tick many times per second. Coalesce writes
  // so we don't thrash IndexedDB with saveProject on every sub-step.
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePersist = () => {
    if (persistTimer) return;
    persistTimer = setTimeout(async () => {
      persistTimer = null;
      currentProject = { ...currentProject, batchRunStatus: { ...statusMap } };
      await saveProject(currentProject);
      callbacks.onProjectUpdate?.(currentProject);
    }, 1000);
  };

  // Run SA pipelines with bounded concurrency. Running many SAs at once
  // through G2 blows Anthropic's output-token rate limits (see BATCH_CONCURRENCY
  // comment). We walk the queue and only keep BATCH_CONCURRENCY promises
  // in-flight at any time.
  const results: PromiseSettledResult<BatchSubAvatarRunStatus>[] = new Array(queue.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= queue.length) return;
      const sa = queue[idx];
      const funnel = deriveFunnelForSA(sa, project);
      try {
        const value = await runSingleSAPipeline(
          currentProject,
          sa,
          funnel,
          plannedGates,
          (next) => {
            statusMap[sa.id] = next;
            callbacks.onStatusChange?.({ ...statusMap });
            schedulePersist();
          },
          callbacks.onGateComplete,
        );
        results[idx] = { status: 'fulfilled', value };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  };
  const workerCount = Math.min(BATCH_CONCURRENCY, queue.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  // Cancel any pending debounced persist, then persist final state immediately.
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  // Unlock the next gate on the project based on what every SA completed.
  // Strategy: a gate is considered "available" if any SA reached it.
  const completedByAny = new Set<GateId>();
  for (const status of Object.values(statusMap)) {
    for (const g of status.completedGates) completedByAny.add(g);
  }
  // Walk the planned gate range in order: every gate before the furthest-completed
  // one is marked 'approved' on the project-level gateStatuses (this mirrors
  // the single-SA auto-pipeline behavior).
  let nextGateStatuses = { ...currentProject.gateStatuses };
  for (const g of plannedGates) {
    if (completedByAny.has(g)) {
      nextGateStatuses = { ...nextGateStatuses, [g]: 'approved' };
    }
  }
  currentProject = {
    ...currentProject,
    gateStatuses: nextGateStatuses,
    batchRunStatus: { ...statusMap },
    updatedAt: new Date().toISOString(),
  };
  // Unlock whichever gate comes after the last completed one.
  const lastCompleted = plannedGates.filter(g => completedByAny.has(g)).pop();
  if (lastCompleted) {
    currentProject = unlockNextGate(currentProject, lastCompleted);
  }
  await saveProject(currentProject);
  callbacks.onProjectUpdate?.(currentProject);
  callbacks.onStatusChange?.({ ...statusMap });

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'completed').length;
  const failed = queue.length - successful;

  return {
    project: currentProject,
    statusBySubAvatar: statusMap,
    totalSubAvatars: queue.length,
    successfulSubAvatars: successful,
    failedSubAvatars: failed,
  };
}
