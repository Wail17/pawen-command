// ============================================================
// PAWEN — Auto-Pipeline Engine
// One-click run from any gate through Gate 9.
// Chains gate runs, auto-approves high-scoring outputs,
// stops when human decisions are needed.
// ============================================================

import { GateId, GateOutput, Project } from '../types';
import { getGateConfig } from '../gates/registry';
import { runGate, RunGateResult } from '../agents/runGate';
import { saveGateOutput, getGateOutput, getAllGateOutputs, saveProject } from '../store/db';
import { unlockNextGate, ALL_GATES } from '../store/project-utils';
import { captureFromApproval } from '../learning/capture';

// Gates that can be auto-run (brand-dna and gate1 are manual)
const AUTO_RUNNABLE: GateId[] = ['gate2', 'gate3', 'gate4', 'gate5', 'gate6', 'gate7', 'gate8', 'gate9'];

// Score threshold for auto-approval (director score >= this → auto-approve)
const AUTO_APPROVE_THRESHOLD = 80;

export interface AutoPipelineState {
  isRunning: boolean;
  currentGate: GateId | null;
  completedGates: GateId[];
  stoppedAt: GateId | null;
  stopReason: string | null;
  totalGates: number;
  status: string;
}

export interface AutoPipelineCallbacks {
  onStateChange: (state: AutoPipelineState) => void;
  onGateComplete: (gateId: GateId, result: RunGateResult) => void;
  onProjectUpdate: (project: Project) => void;
}

/**
 * Determine which gates still need to run.
 * Skips: gate1 (manual), brand-dna (manual), already approved gates.
 */
export function getPendingAutoGates(project: Project): GateId[] {
  return AUTO_RUNNABLE.filter(gateId => {
    const status = project.gateStatuses[gateId];
    return status !== 'approved';
  });
}

/**
 * Check if auto-pipeline can start.
 * Requires: gate1 approved, brand-dna approved (locked).
 */
export function canStartAutoPipeline(project: Project): { ok: boolean; reason?: string } {
  if (project.gateStatuses.gate1 !== 'approved') {
    return { ok: false, reason: 'Gate 1 (Avatar Excavation) must be completed first' };
  }
  if (!project.brandDNA?.locked) {
    return { ok: false, reason: 'Brand DNA must be locked first' };
  }
  const pending = getPendingAutoGates(project);
  if (pending.length === 0) {
    return { ok: false, reason: 'All gates already completed' };
  }
  return { ok: true };
}

/**
 * Run the auto-pipeline from the first pending gate to gate 9.
 * Auto-approves gates scoring >= threshold.
 * Stops when: score too low, error, or all gates done.
 */
export async function runAutoPipeline(
  project: Project,
  callbacks: AutoPipelineCallbacks,
): Promise<{ project: Project; stoppedAt: GateId | null; reason: string | null }> {
  let currentProject = { ...project };
  const pendingGates = getPendingAutoGates(currentProject);
  const completedGates: GateId[] = [];

  const updateState = (partial: Partial<AutoPipelineState>) => {
    callbacks.onStateChange({
      isRunning: true,
      currentGate: null,
      completedGates,
      stoppedAt: null,
      stopReason: null,
      totalGates: pendingGates.length,
      status: 'Running...',
      ...partial,
    });
  };

  for (const gateId of pendingGates) {
    updateState({
      currentGate: gateId,
      status: `Running ${gateId.replace('gate', 'Gate ')}...`,
    });

    // Ensure gate is accessible
    if (currentProject.gateStatuses[gateId] === 'locked') {
      currentProject = {
        ...currentProject,
        gateStatuses: { ...currentProject.gateStatuses, [gateId]: 'available' },
      };
      await saveProject(currentProject);
      callbacks.onProjectUpdate(currentProject);
    }

    // Gather previous gate outputs
    const allOutputs = await getAllGateOutputs(currentProject.id);
    const previousOutputs: Record<string, unknown> = {};
    for (const o of allOutputs) {
      if (o.gateId !== gateId) {
        previousOutputs[o.gateId] = o.data;
      }
    }

    const config = getGateConfig(gateId);

    try {
      const result = await runGate({
        gateId,
        projectId: currentProject.id,
        project: currentProject,
        config,
        previousGateOutputs: previousOutputs,
        maxReviewIterations: 3,
        onStatusChange: (status) => {
          const labels: Record<string, string> = {
            running_sub_agents: 'Sub-agents working...',
            manager_review: 'Manager reviewing...',
            manager_revision: 'Manager revision...',
            generating: 'Lead agent compiling...',
            director_review: 'Director reviewing...',
            director_revision: 'Director revision...',
          };
          if (status.startsWith('sub_agent:')) {
            updateState({ status: `${gateId}: ${status.slice(10)}` });
          } else {
            updateState({ status: `${gateId}: ${labels[status] || status}` });
          }
        },
      });

      // Save gate output
      const gateOutput: GateOutput = {
        gateId,
        projectId: currentProject.id,
        status: result.status === 'error' ? 'pending_decisions' : result.status,
        data: result.parsedOutput,
        generationLog: result.generationLog,
        reviewResult: result.reviewResult,
        congruenceResult: result.congruenceResult,
        humanDecisions: {},
        checkpoint: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveGateOutput(gateOutput);

      callbacks.onGateComplete(gateId, result);

      // Check if auto-approve
      const score = result.reviewResult?.percentage ?? 0;

      if (score >= AUTO_APPROVE_THRESHOLD && result.status !== 'error') {
        // Auto-approve: capture gold, unlock next gate
        captureFromApproval({
          project: currentProject,
          gateId,
          gateOutput,
        }).catch(() => {});

        currentProject = unlockNextGate(
          { ...currentProject, gateStatuses: { ...currentProject.gateStatuses, [gateId]: 'approved' } },
          gateId,
        );
        await saveProject(currentProject);
        callbacks.onProjectUpdate(currentProject);
        completedGates.push(gateId);
      } else {
        // Score too low — stop for human review
        currentProject = {
          ...currentProject,
          gateStatuses: { ...currentProject.gateStatuses, [gateId]: 'pending_review' },
        };
        await saveProject(currentProject);
        callbacks.onProjectUpdate(currentProject);

        const reason = score > 0
          ? `${gateId} scored ${score}% (need ${AUTO_APPROVE_THRESHOLD}%) — needs human review`
          : `${gateId} needs human review`;

        updateState({
          isRunning: false,
          stoppedAt: gateId,
          stopReason: reason,
          status: reason,
        });

        return { project: currentProject, stoppedAt: gateId, reason };
      }
    } catch (error) {
      const reason = `${gateId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      updateState({
        isRunning: false,
        stoppedAt: gateId,
        stopReason: reason,
        status: reason,
      });

      return { project: currentProject, stoppedAt: gateId, reason };
    }
  }

  // All gates completed!
  updateState({
    isRunning: false,
    currentGate: null,
    stoppedAt: null,
    stopReason: null,
    status: 'All gates completed!',
  });

  return { project: currentProject, stoppedAt: null, reason: null };
}
