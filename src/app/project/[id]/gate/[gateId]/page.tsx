'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, GateOutput, GateId } from '@/lib/types';
import { getProject, getGateOutput, getAllGateOutputs, saveGateOutput, saveProject } from '@/lib/store/db';
import { GATE_LABELS, ALL_GATES, canAccessGate, unlockNextGate } from '@/lib/store/project-utils';
import Pipeline from '@/components/ui/Pipeline';
import GateView from '@/components/gates/GateView';
import { runGate, runCongruenceCheck } from '@/lib/agents/runGate';
import { getGateConfig, getGateSubAgentNames } from '@/lib/gates/registry';
import { learnFromRejection } from '@/lib/agents/memory';
import { getPersonaForGate } from '@/lib/agents/personas';

export default function GatePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const gateId = params.gateId as GateId;

  const [project, setProject] = useState<Project | null>(null);
  const [output, setOutput] = useState<GateOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [statusText, setStatusText] = useState('');
  const [inputMode, setInputMode] = useState<'ai' | 'manual'>('ai');
  const [manualText, setManualText] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    const p = await getProject(projectId);
    if (!p) { router.push('/'); return; }
    if (!canAccessGate(p, gateId)) { router.push(`/project/${projectId}`); return; }
    setProject(p);

    const existing = await getGateOutput(projectId, gateId);
    if (existing) setOutput(existing);
    setLoading(false);
  }, [projectId, gateId, router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setIsGenerating(true);
    setStreamingText('');
    setStatusText('Initializing...');

    const config = getGateConfig(gateId);
    const allOutputs = await getAllGateOutputs(projectId);
    const previousOutputs: Record<string, unknown> = {};
    for (const o of allOutputs) {
      if (o.gateId !== gateId) {
        previousOutputs[o.gateId] = o.data;
      }
    }

    try {
      const result = await runGate({
        gateId,
        projectId,
        project,
        config,
        previousGateOutputs: previousOutputs,
        maxReviewIterations: 3,
        onStreamChunk: (chunk) => setStreamingText((prev) => prev + chunk),
        onStatusChange: (status) => {
          const statusLabels: Record<string, string> = {
            running_sub_agents: 'Sub-agents working...',
            manager_review: 'Manager reviewing sub-agent work...',
            manager_revision: 'Manager sent work back for revision...',
            generating: 'Lead agent compiling...',
            director_review: 'Léa (Director) reviewing final output...',
            director_revision: 'Léa requested changes — revising...',
            reviewing: 'Quality review...',
            regenerating: 'Improving with feedback...',
            congruence_check: 'Brand congruence check...',
            realigning: 'Re-aligning with Brand DNA...',
          };
          // Handle dynamic status: "sub_agent:Name" or "revision:Name"
          if (status.startsWith('sub_agent:')) {
            setStatusText(`Working: ${status.slice(10)}`);
          } else if (status.startsWith('revision:')) {
            setStatusText(`Revising: ${status.slice(9)} (manager feedback)`);
          } else {
            setStatusText(statusLabels[status] || status);
          }
        },
      });

      const gateOutput: GateOutput = {
        gateId,
        projectId,
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
      setOutput(gateOutput);

      // Update project status
      const updatedProject = {
        ...project,
        gateStatuses: { ...project.gateStatuses, [gateId]: 'pending_review' as const },
      };
      await saveProject(updatedProject);
      setProject(updatedProject);
    } catch (error) {
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
      setStatusText('');
    }
  }, [project, gateId, projectId]);

  const handleApprove = useCallback(async () => {
    if (!project || !output) return;

    // Run congruence check if applicable
    if (project.brandDNA?.locked && getGateConfig(gateId).hasCongruenceCheck) {
      setIsGenerating(true);
      setStatusText('Brand congruence check...');
      const allOutputs = await getAllGateOutputs(projectId);
      const previousOutputs: Record<string, unknown> = {};
      for (const o of allOutputs) {
        if (o.gateId !== gateId) previousOutputs[o.gateId] = o.data;
      }

      const config = getGateConfig(gateId);
      const congruenceResult = await runCongruenceCheck({
        gateId,
        content: JSON.stringify(output.data),
        brandDNA: project.brandDNA,
        congruencePrompt: config.congruencePrompt || '',
        previousGateOutputs: previousOutputs,
        onStatusChange: (status) => setStatusText(status),
      });

      const updatedOutput = {
        ...output,
        congruenceResult: congruenceResult.congruenceResult,
        generationLog: [...output.generationLog, ...congruenceResult.log],
        status: 'approved' as const,
      };
      await saveGateOutput(updatedOutput);
      setOutput(updatedOutput);
      setIsGenerating(false);
      setStatusText('');
    }

    // Unlock next gate
    const updatedProject = unlockNextGate(
      { ...project, gateStatuses: { ...project.gateStatuses, [gateId]: 'approved' } },
      gateId,
    );
    await saveProject(updatedProject);
    setProject(updatedProject);

    // Navigate to next gate or project page
    const nextGate = getNextGateId(gateId);
    if (nextGate) {
      if (nextGate === 'brand-dna') {
        router.push(`/project/${projectId}/brand-dna`);
      } else {
        router.push(`/project/${projectId}/gate/${nextGate}`);
      }
    } else {
      router.push(`/project/${projectId}`);
    }
  }, [project, output, gateId, projectId, router]);

  const handleReject = useCallback(async () => {
    if (!project || !rejectReason.trim()) return;

    const persona = getPersonaForGate(gateId);
    await learnFromRejection({
      agentId: persona.id,
      projectId,
      gateId,
      rejectionReason: rejectReason.trim(),
      projectContext: `${project.name} — ${project.targetMarket}`,
    });

    // Reset gate status to available so it can be re-run
    const updatedProject = {
      ...project,
      gateStatuses: { ...project.gateStatuses, [gateId]: 'available' as const },
    };
    await saveProject(updatedProject);
    setProject(updatedProject);
    setOutput(null);
    setShowRejectModal(false);
    setRejectReason('');
  }, [project, gateId, projectId, rejectReason]);

  const handleManualSubmit = useCallback(async () => {
    if (!project || !manualText.trim()) return;

    let parsedData: Record<string, unknown>;
    try {
      parsedData = JSON.parse(manualText);
    } catch {
      parsedData = { rawContent: manualText };
    }

    const gateOutput: GateOutput = {
      gateId,
      projectId,
      status: 'pending_decisions',
      data: parsedData,
      generationLog: [{
        timestamp: new Date().toISOString(),
        agent: 'generator',
        model: 'manual',
        iteration: 1,
        input_summary: 'Manual input',
        output_summary: 'User provided manual input',
      }],
      reviewResult: null,
      congruenceResult: null,
      humanDecisions: {},
      checkpoint: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveGateOutput(gateOutput);
    setOutput(gateOutput);

    const updatedProject = {
      ...project,
      gateStatuses: { ...project.gateStatuses, [gateId]: 'pending_review' as const },
    };
    await saveProject(updatedProject);
    setProject(updatedProject);
  }, [project, manualText, gateId, projectId]);

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  const config = getGateConfig(gateId);
  const subAgentNames = getGateSubAgentNames(gateId);

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <Pipeline project={project} activeGate={gateId} />

      <GateView
        gateId={gateId}
        title={GATE_LABELS[gateId]}
        description={config.description}
        output={output}
        isGenerating={isGenerating}
        streamingText={streamingText}
        inputMode={inputMode}
        onInputModeChange={setInputMode}
        onGenerate={handleGenerate}
        onRegenerate={handleGenerate}
        onApprove={handleApprove}
        manualInput={
          <div className="space-y-3">
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={12}
              placeholder="Paste your data here (JSON or plain text)..."
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary text-sm font-mono focus:outline-none focus:border-accent-teal resize-y"
            />
            <button
              onClick={handleManualSubmit}
              className="px-6 py-2.5 bg-accent-teal text-white font-semibold rounded-lg hover:bg-accent-teal-hover text-sm"
            >
              Submit Manual Input
            </button>
          </div>
        }
      >
        {/* Sub-agent info */}
        {subAgentNames.length > 0 && !output && !isGenerating && (
          <div className="mb-4 p-3 bg-bg-card border border-border rounded-lg">
            <p className="text-xs text-text-muted mb-2">This gate uses {subAgentNames.length} specialist agents:</p>
            <div className="flex flex-wrap gap-1.5">
              {subAgentNames.map((name) => (
                <span key={name} className="text-xs px-2 py-0.5 bg-bg-primary border border-border rounded text-text-secondary">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Status display during generation */}
        {isGenerating && statusText && (
          <div className="mb-4 p-3 bg-accent-orange/10 border border-accent-orange/30 rounded-lg">
            <p className="text-sm text-accent-orange font-medium">{statusText}</p>
          </div>
        )}

        {/* Reject button — teaches agents what NOT to do */}
        {output && output.status === 'pending_decisions' && !isGenerating && (
          <div className="mb-4">
            <button
              onClick={() => setShowRejectModal(true)}
              className="px-4 py-2 border border-error/50 text-error rounded-lg hover:bg-error/10 text-sm"
            >
              Reject &amp; Teach Agent
            </button>
          </div>
        )}

        {/* Rejection modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-bg-card border border-border rounded-xl w-full max-w-lg">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text-primary">Why are you rejecting this?</h3>
                <p className="text-xs text-text-muted mt-1">
                  The agent will learn from your feedback and NEVER repeat this mistake.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  placeholder="Explain what's wrong and what you expected instead..."
                  className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-error resize-y"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                    className="flex-1 py-2.5 border border-border rounded-lg text-text-secondary hover:text-text-primary text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!rejectReason.trim()}
                    className="flex-1 py-2.5 bg-error text-white font-semibold rounded-lg hover:bg-error/80 text-sm disabled:opacity-50"
                  >
                    Reject &amp; Teach
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gate output display */}
        {output && output.data && (
          <div className="space-y-4">
            <div className="p-4 bg-bg-card border border-border rounded-xl">
              <h3 className="text-sm font-semibold text-text-secondary mb-2">Output</h3>
              <pre className="text-xs text-text-primary whitespace-pre-wrap font-mono max-h-[600px] overflow-y-auto">
                {typeof output.data === 'object'
                  ? JSON.stringify(output.data, null, 2)
                  : String(output.data)}
              </pre>
            </div>
          </div>
        )}
      </GateView>
    </div>
  );
}

function getNextGateId(current: GateId): GateId | null {
  const idx = ALL_GATES.indexOf(current);
  return idx < ALL_GATES.length - 1 ? ALL_GATES[idx + 1] : null;
}
