'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, GateOutput, GateId } from '@/lib/types';
import { getProject, getGateOutput, getAllGateOutputs, saveGateOutput, saveProject } from '@/lib/store/db';
import { GATE_LABELS, ALL_GATES, canAccessGate, unlockNextGate } from '@/lib/store/project-utils';
import Pipeline from '@/components/ui/Pipeline';
import GateView from '@/components/gates/GateView';
import Gate1AvatarExcavation from '@/components/gates/Gate1AvatarExcavation';
import GateContextBar from '@/components/gates/GateContextBar';
import SmartGateOutput from '@/components/gates/SmartGateOutput';
import { runGate, runCongruenceCheck } from '@/lib/agents/runGate';
import { getGateConfig, getGateSubAgentNames } from '@/lib/gates/registry';
import { learnFromRejection } from '@/lib/agents/memory';
import { getPersonaForGate } from '@/lib/agents/personas';
import { captureFromPick, captureFromApproval, captureRejection } from '@/lib/learning/capture';
import StaticAdStudio from '@/components/gates/StaticAdStudio';
import Gate2DeepDiveView from '@/components/gates/Gate2DeepDiveView';
import ReferenceAdsUploader from '@/components/gates/ReferenceAdsUploader';
import { demoGateData, demoGate1, demoBrandDNA } from '@/lib/gates/demoData';

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
  const [variants, setVariants] = useState<Record<string, unknown>[]>([]);
  const [activeVariant, setActiveVariant] = useState(0);
  const [generatingVariant, setGeneratingVariant] = useState(false);
  const [upstreamData, setUpstreamData] = useState<{ gate4?: Record<string, unknown>; gate6?: Record<string, unknown> }>({});

  const loadData = useCallback(async () => {
    const p = await getProject(projectId);
    if (!p) { router.push('/'); return; }
    if (!canAccessGate(p, gateId)) { router.push(`/project/${projectId}`); return; }
    setProject(p);

    const existing = await getGateOutput(projectId, gateId);
    if (existing) setOutput(existing);

    if (gateId === 'gate7' || gateId === 'gate8') {
      const [g4, g6] = await Promise.all([
        getGateOutput(projectId, 'gate4' as GateId),
        getGateOutput(projectId, 'gate6' as GateId),
      ]);
      setUpstreamData({
        gate4: g4?.data as Record<string, unknown> | undefined,
        gate6: g6?.data as Record<string, unknown> | undefined,
      });
    }

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

    // Capture gold outputs from approved gate (adaptive learning)
    if (output) {
      captureFromApproval({ project, gateId, gateOutput: output }).catch(() => {});
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

    // Capture rejection signal (adaptive learning)
    captureRejection({ gateId, reason: rejectReason.trim() }).catch(() => {});

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

  // Persist interactive picks / notes back into the gate output so
  // downstream gates and re-runs can see them.
  // Also captures new ★ picks as gold outputs for adaptive learning.
  const handleDecisionsChange = useCallback(
    async (nextDecisions: Record<string, unknown>) => {
      if (!output) return;

      // Detect new picks and capture as gold outputs
      if (project) {
        const oldPicked = ((output.humanDecisions as Record<string, unknown>)?.picked ?? {}) as Record<string, string[]>;
        const newPicked = ((nextDecisions?.picked ?? {}) as Record<string, string[]>);

        for (const [path, items] of Object.entries(newPicked)) {
          const oldItems = oldPicked[path] ?? [];
          const added = (items as string[]).filter(i => !oldItems.includes(i));
          for (const idx of added) {
            const content = resolveContentAtPath(output.data, path, idx);
            if (content && content.length > 20) {
              captureFromPick({
                project,
                gateId,
                sectionPath: path,
                content,
              }).catch(() => {});
            }
          }
        }
      }

      const updated: GateOutput = {
        ...output,
        humanDecisions: nextDecisions,
        updatedAt: new Date().toISOString(),
      };
      setOutput(updated);
      await saveGateOutput(updated);
    },
    [output, project, gateId],
  );

  // Generate a creative variant of the current output
  const handleGenerateVariant = useCallback(async () => {
    if (!project || !output) return;
    setGeneratingVariant(true);

    const config = getGateConfig(gateId);
    const allOutputs = await getAllGateOutputs(projectId);
    const previousOutputs: Record<string, unknown> = {};
    for (const o of allOutputs) {
      if (o.gateId !== gateId) previousOutputs[o.gateId] = o.data;
    }

    try {
      const result = await runGate({
        gateId,
        projectId,
        project,
        config,
        previousGateOutputs: previousOutputs,
        maxReviewIterations: 2,
        onStreamChunk: (chunk) => setStreamingText((prev) => prev + chunk),
        onStatusChange: (status) => setStatusText(`Variant: ${status}`),
      });

      if (result.parsedOutput && Object.keys(result.parsedOutput).length > 0) {
        // Add original as first variant if not already tracked
        if (variants.length === 0 && output.data) {
          setVariants([output.data, result.parsedOutput]);
        } else {
          setVariants(prev => [...prev, result.parsedOutput]);
        }
        setActiveVariant(variants.length === 0 ? 1 : variants.length);
      }
    } catch (error) {
      console.error('Variant generation error:', error);
    } finally {
      setGeneratingVariant(false);
      setStreamingText('');
      setStatusText('');
    }
  }, [project, output, gateId, projectId, variants]);

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

  const handleLoadDemo = useCallback(async () => {
    if (!project) return;

    const demoData = demoGateData(gateId);
    if (!demoData || Object.keys(demoData).length === 0) return;

    const gateOutput: GateOutput = {
      gateId,
      projectId,
      status: 'pending_decisions',
      data: demoData,
      generationLog: [{
        timestamp: new Date().toISOString(),
        agent: 'lead',
        model: 'demo-data',
        iteration: 1,
        input_summary: 'Demo data loaded',
        output_summary: 'Realistic mock data for UI preview (product: Slapen)',
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
  }, [project, gateId, projectId]);

  const handleLoadDemoGate1 = useCallback(async () => {
    if (!project) return;

    const avatarResult = demoGate1();
    const brandDNA = demoBrandDNA();

    // Persist GateOutput for Gate 1 so downstream gates can find it
    const now = new Date().toISOString();
    const gate1Output: GateOutput = {
      gateId: 'gate1',
      projectId,
      status: 'pending_decisions',
      data: avatarResult as unknown as Record<string, unknown>,
      generationLog: [{
        timestamp: now,
        agent: 'lead',
        model: 'demo-data',
        iteration: 1,
        input_summary: 'Demo data loaded',
        output_summary: '3 sub-avatars (Slapen sleep supplement demo)',
      }],
      reviewResult: null,
      congruenceResult: null,
      humanDecisions: {},
      checkpoint: null,
      createdAt: now,
      updatedAt: now,
    };
    await saveGateOutput(gate1Output);

    // Also persist Brand DNA gate output
    const brandDnaOutput: GateOutput = {
      gateId: 'brand-dna',
      projectId,
      status: 'approved',
      data: brandDNA as unknown as Record<string, unknown>,
      generationLog: [{
        timestamp: now,
        agent: 'lead',
        model: 'demo-data',
        iteration: 1,
        input_summary: 'Demo Brand DNA',
        output_summary: 'Slapen brand identity locked',
      }],
      reviewResult: null,
      congruenceResult: null,
      humanDecisions: {},
      checkpoint: null,
      createdAt: now,
      updatedAt: now,
    };
    await saveGateOutput(brandDnaOutput);

    const updatedProject = {
      ...project,
      avatarRunResult: avatarResult,
      brandDNA: { ...brandDNA, locked: true },
      gateStatuses: {
        ...project.gateStatuses,
        gate1: 'approved' as const,
        'brand-dna': 'approved' as const,
        gate2: 'available' as const,
      },
    };
    await saveProject(updatedProject);
    setProject(updatedProject);
  }, [project, projectId]);

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  const config = getGateConfig(gateId);
  const subAgentNames = getGateSubAgentNames(gateId);

  // Resolve actual content at a section path + item index (for ★ pick capture)
  function resolveContentAtPath(
    data: Record<string, unknown>,
    sectionPath: string,
    itemIndex: string,
  ): string | null {
    const section = data[sectionPath];
    const idx = parseInt(itemIndex, 10);
    if (Array.isArray(section) && !isNaN(idx) && idx < section.length) {
      const item = section[idx];
      return typeof item === 'string' ? item : JSON.stringify(item);
    }
    return null;
  }

  // Gate 1 = Avatar Excavation. It uses a fully custom pipeline
  // (src/lib/avatars/runAvatarExcavation.ts) and a dedicated UI,
  // bypassing the generic GateView / runGate flow entirely.
  if (gateId === 'gate1') {
    return (
      <div className="min-h-screen bg-bg-primary flex">
        <Pipeline project={project} activeGate={gateId} />
        <Gate1AvatarExcavation project={project} onProjectChange={setProject} onLoadDemo={handleLoadDemoGate1} />
      </div>
    );
  }

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
        onLoadDemo={handleLoadDemo}
        hasCongruenceCheck={config.hasCongruenceCheck}
        brandDNAStatus={
          !project.brandDNA ? 'missing' : project.brandDNA.locked ? 'locked' : 'unlocked'
        }
        projectId={projectId}
        contextBar={
          <GateContextBar project={project} onProjectChange={setProject} />
        }
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

        {/* Reference Ads uploader — Gate 7 only, before running */}
        {gateId === 'gate7' && !isGenerating && (
          <div className="mb-4">
            <ReferenceAdsUploader
              project={project}
              onProjectChange={async (p) => {
                setProject(p);
                await saveProject(p);
              }}
            />
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

        {/* Variant controls */}
        {output && output.data && !isGenerating && (
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={handleGenerateVariant}
              disabled={generatingVariant || variants.length >= 4}
              className="px-3 py-1.5 border border-accent-teal/50 text-accent-teal rounded-lg text-xs hover:bg-accent-teal/10 disabled:opacity-40"
            >
              {generatingVariant ? 'Generating...' : `+ Variant (${variants.length > 0 ? variants.length : 1}/4)`}
            </button>
            {variants.length > 1 && (
              <div className="flex gap-1">
                {variants.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveVariant(i)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      activeVariant === i
                        ? 'bg-accent-orange text-white'
                        : 'bg-bg-card border border-border text-text-secondary hover:border-accent-orange'
                    }`}
                  >
                    {i === 0 ? 'Original' : `V${i}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gate output display — dedicated views for gate2/gate7/gate8, SmartGateOutput for others */}
        {output && output.data && (gateId === 'gate7' || gateId === 'gate8') && (
          <StaticAdStudio
            data={variants.length > 1 ? (variants[activeVariant] || output.data) : output.data}
            humanDecisions={output.humanDecisions ?? {}}
            onDecisionsChange={handleDecisionsChange}
            gate4Data={upstreamData.gate4}
            gate6Data={upstreamData.gate6}
          />
        )}
        {output && output.data && gateId === 'gate2' && (
          <Gate2DeepDiveView
            data={variants.length > 1 ? (variants[activeVariant] || output.data) : output.data}
            reviewResult={output.reviewResult}
            sourceLanguage={project.targetLanguage}
            humanDecisions={output.humanDecisions ?? {}}
            onDecisionsChange={handleDecisionsChange}
          />
        )}
        {output && output.data && gateId !== 'gate2' && gateId !== 'gate7' && gateId !== 'gate8' && (
          <SmartGateOutput
            data={variants.length > 1 ? (variants[activeVariant] || output.data) : output.data}
            humanDecisions={output.humanDecisions ?? {}}
            onDecisionsChange={handleDecisionsChange}
            sourceLanguage={project.targetLanguage}
          />
        )}
      </GateView>
    </div>
  );
}

function getNextGateId(current: GateId): GateId | null {
  const idx = ALL_GATES.indexOf(current);
  return idx < ALL_GATES.length - 1 ? ALL_GATES[idx + 1] : null;
}
