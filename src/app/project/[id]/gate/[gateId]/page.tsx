'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, GateOutput, GateId } from '@/lib/types';
import { getProject, getGateOutput, getAllGateOutputs, saveGateOutput, saveProject, restoreProject, restoreGateOutput } from '@/lib/store/db';
import { fetchBootstrap } from '@/lib/store/serverMirror';
import { GATE_LABELS, ALL_GATES, canAccessGate, unlockNextGate } from '@/lib/store/project-utils';
import Pipeline from '@/components/ui/Pipeline';
import GateView from '@/components/gates/GateView';
import Gate1AvatarExcavation from '@/components/gates/Gate1AvatarExcavation';
import GateContextBar from '@/components/gates/GateContextBar';
import Gate5FormatSelector from '@/components/gates/Gate5FormatSelector';
import Gate6FormatSelector from '@/components/gates/Gate6FormatSelector';
import GateGenerationConfigPanel from '@/components/gates/GateGenerationConfigPanel';
import SmartGateOutput from '@/components/gates/SmartGateOutput';
import GateCostBadge from '@/components/gates/GateCostBadge';
import { runGate, runCongruenceCheck } from '@/lib/agents/runGate';
import { getGateConfig, getGateSubAgentNames } from '@/lib/gates/registry';
import { learnFromRejection } from '@/lib/agents/memory';
import { getPersonaForGate } from '@/lib/agents/personas';
import { captureFromPick, captureFromApproval, captureRejection } from '@/lib/learning/capture';
import StaticAdStudio from '@/components/gates/StaticAdStudio';
import Gate2DeepDiveView from '@/components/gates/Gate2DeepDiveView';
import MechanismView from '@/components/gates/MechanismView';
import CopyArsenalView from '@/components/gates/CopyArsenalView';
import Gate5FormatView from '@/components/gates/Gate5FormatView';
import CreativeStudio from '@/components/gates/CreativeStudio';
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
  const [upstreamData, setUpstreamData] = useState<{ gate4?: Record<string, unknown>; gate6?: Record<string, unknown>; gate7?: Record<string, unknown> }>({});
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    // Hydrate from server mirror if local is missing this project or this gate output.
    // Deep links (e.g. someone pastes /project/X/gate/gate5) bypass the home page
    // bootstrap, so without this the user sees "empty" even when server has the data.
    let p = await getProject(projectId);
    // Matrix Mode: pick the right per-SA output based on project.selectedSubAvatarId.
    const sa = p?.selectedSubAvatarId;
    let existing = p ? await getGateOutput(projectId, gateId, sa) : undefined;

    if (!p || !existing) {
      const boot = await fetchBootstrap();
      if (boot) {
        const serverProject = boot.projects.find((sp) => sp && typeof sp === 'object' && (sp as { id?: string }).id === projectId);
        if (serverProject) await restoreProject(serverProject as Project);
        for (const g of boot.gateOutputs) {
          if (g && typeof g === 'object' && (g as { projectId?: string }).projectId === projectId) {
            await restoreGateOutput(g);
          }
        }
        p = await getProject(projectId);
        const sa2 = p?.selectedSubAvatarId;
        existing = p ? await getGateOutput(projectId, gateId, sa2) : undefined;
      }
    }

    if (!p) { router.push('/'); return; }
    if (!canAccessGate(p, gateId)) { router.push(`/project/${projectId}`); return; }
    setProject(p);
    // Clear stale output before applying new — switching SAs shouldn't show the
    // prior SA's content if the new one hasn't been generated yet.
    setOutput(existing ?? null);

    if (gateId === 'gate7' || gateId === 'gate8') {
      const saX = p.selectedSubAvatarId;
      const [g4, g6, g7] = await Promise.all([
        getGateOutput(projectId, 'gate4' as GateId, saX),
        getGateOutput(projectId, 'gate6' as GateId, saX),
        getGateOutput(projectId, 'gate7' as GateId, saX),
      ]);
      setUpstreamData({
        gate4: g4?.data as Record<string, unknown> | undefined,
        gate6: g6?.data as Record<string, unknown> | undefined,
        gate7: g7?.data as Record<string, unknown> | undefined,
      });
    }

    setLoading(false);
  }, [projectId, gateId, router]);

  useEffect(() => { loadData(); }, [loadData]);

  // Re-run loadData whenever the selected sub-avatar changes (Matrix tab click).
  // This swaps the displayed output + upstream data without a page nav.
  useEffect(() => {
    if (!project?.selectedSubAvatarId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.selectedSubAvatarId]);

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setIsGenerating(true);
    setStreamingText('');
    setStatusText('Initializing...');
    setGenerateError(null);

    const config = getGateConfig(gateId, project ?? undefined);
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

      // Merge sub-agent outputs into data as fallback — if lead compiler truncates,
      // raw sub-agent content is still accessible under `_sub_agents`.
      const mergedData: Record<string, unknown> = { ...(result.parsedOutput as Record<string, unknown>) };
      if (result.subAgentOutputs && Object.keys(result.subAgentOutputs).length > 0) {
        mergedData._sub_agents = result.subAgentOutputs;
      }

      const gateOutput: GateOutput = {
        gateId,
        projectId,
        status: result.status === 'error' ? 'pending_decisions' : result.status,
        data: mergedData,
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
      // Surface the error to the user instead of failing silently. Previously
      // a crashed runGate (timeout, missing env, bad JSON) left the button
      // spinning then returned with no feedback — the user thought
      // "Regenerate doesn't work". Now we display the message inline.
      setGenerateError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGenerating(false);
      setStatusText('');
    }
  }, [project, gateId, projectId]);

  const handleApprove = useCallback(async (skipCongruence: boolean = false) => {
    if (!project || !output) return;

    // Run congruence check if applicable — but ONLY if not already attempted.
    // Non-blocking: if it fails or times out, we still approve and move on.
    // No realign loop here (maxIterations: 1) — user already saw the director score
    // and chose to approve. Don't burn Opus credits on a 2nd realign pass.
    const needsCongruence =
      !skipCongruence &&
      project.brandDNA?.locked &&
      getGateConfig(gateId, project ?? undefined).hasCongruenceCheck &&
      !output.congruenceResult;

    if (needsCongruence) {
      setIsGenerating(true);
      setStatusText('Brand congruence check (1 pass, non-blocking)...');
      try {
        const allOutputs = await getAllGateOutputs(projectId);
        const previousOutputs: Record<string, unknown> = {};
        for (const o of allOutputs) {
          if (o.gateId !== gateId) previousOutputs[o.gateId] = o.data;
        }

        const config = getGateConfig(gateId, project ?? undefined);
        const congruenceResult = await runCongruenceCheck({
          gateId,
          content: JSON.stringify(output.data),
          brandDNA: project.brandDNA!,
          congruencePrompt: config.congruencePrompt || '',
          previousGateOutputs: previousOutputs,
          maxIterations: 1, // single pass — no realign loop on approve
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
      } catch (err) {
        console.error('Congruence check failed — approving anyway:', err);
        // Don't block approve on congruence failure
      } finally {
        setIsGenerating(false);
        setStatusText('');
      }
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
      // Auto-create a shell GateOutput if none exists (Creative Studio can
      // run on Gate 7 before any runGate cycle — persist anyway).
      if (!output) {
        if (!project) return;
        const shell: GateOutput = {
          projectId,
          gateId,
          status: 'approved',
          data: {},
          humanDecisions: nextDecisions,
          generationLog: [],
          reviewResult: null,
          congruenceResult: null,
          checkpoint: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setOutput(shell);
        await saveGateOutput(shell);
        return;
      }

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

    const config = getGateConfig(gateId, project ?? undefined);
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

  const [appendingHooks, setAppendingHooks] = useState(false);
  const handleAppendHooks = useCallback(async (count: number) => {
    if (!project || !output || gateId !== 'gate4') return;
    setAppendingHooks(true);
    try {
      const { extractJSON } = await import('@/lib/util/extractJson');
      const existingHookTexts: string[] = [];
      const data = output.data as Record<string, unknown>;
      const hookBank = (data?.hook_bank ?? {}) as Record<string, unknown>;
      const hookMatrix = Array.isArray(hookBank.hook_matrix) ? hookBank.hook_matrix : [];
      for (const g of hookMatrix as Array<Record<string, unknown>>) {
        const hooks = Array.isArray(g.hooks) ? g.hooks : [];
        for (const h of hooks as Array<Record<string, unknown>>) {
          const t = (h.hook as string) || (h.hook_text as string) || (h.text as string) || '';
          if (t) existingHookTexts.push(t);
        }
      }
      const hd = (output.humanDecisions ?? {}) as Record<string, unknown>;
      const existingWaves = Array.isArray(hd.additional_hook_waves) ? hd.additional_hook_waves : [];
      for (const w of existingWaves as Array<Record<string, unknown>>) {
        const hooks = Array.isArray(w.hooks) ? w.hooks : [];
        for (const h of hooks as Array<Record<string, unknown>>) {
          const t = (h.hook as string) || (h.hook_text as string) || (h.text as string) || '';
          if (t) existingHookTexts.push(t);
        }
      }

      const gate2 = await getGateOutput(projectId, 'gate2');
      const gate3 = await getGateOutput(projectId, 'gate3');
      const subAvatarId = project.selectedSubAvatarId;
      const funnel = project.selectedFunnel || 'problem_aware';

      const systemPrompt = `You are an elite scroll-stopping hook architect for a $100M/year direct response brand. Generate NEW hooks that do NOT repeat any hook already in the existing set.

PRODUCT: ${project.name}
TARGET MARKET: ${project.targetMarket}
TARGET LANGUAGE: ${project.targetLanguage}
AWARENESS LEVEL: ${funnel}
SELECTED SUB-AVATAR ID: ${subAvatarId || 'n/a'}

Use the 7 ZAK formulas (question, statement, story, statistic, contradiction, curiosity, identity). Mix reptilian triggers and attention hierarchy levels. Every hook must sound like a real person, not an ad.`;

      const userMessage = `Generate EXACTLY ${count} NEW hooks for the selected sub-avatar. They must be DIFFERENT from the existing hooks listed below.

=== EXISTING HOOKS (DO NOT REPEAT OR PARAPHRASE) ===
${existingHookTexts.slice(0, 200).map((t, i) => `${i + 1}. ${t}`).join('\n')}

=== CONTEXT ===
Gate 2 (avatar): ${JSON.stringify(gate2?.data ?? {}).slice(0, 6000)}
Gate 3 (mechanism): ${JSON.stringify(gate3?.data ?? {}).slice(0, 3000)}

Output valid JSON wrapped in \`\`\`json:
{
  "hooks": [
    { "id": "w-h001", "formula": "question|statement|story|statistic|contradiction|curiosity|identity", "hook": "...", "hook_target_lang": "...", "rationale": "1 sentence" }
  ]
}

Exactly ${count} hooks. No duplicates with the existing set.`;

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          systemPrompt,
          userMessage,
          temperature: 0.9,
          maxTokens: 8000,
        }),
      });
      if (!res.ok) throw new Error(`generate failed ${res.status}`);
      const json = await res.json();
      const content = (json.content as string) || '';
      const parsed = extractJSON<{ hooks?: unknown[] }>(content);
      const newHooks = Array.isArray(parsed?.hooks) ? parsed!.hooks : [];
      if (newHooks.length === 0) {
        alert('No new hooks returned — try again.');
        return;
      }

      const newWave = {
        generatedAt: new Date().toISOString(),
        count: newHooks.length,
        hooks: newHooks,
      };
      const nextDecisions = {
        ...hd,
        additional_hook_waves: [...(existingWaves as unknown[]), newWave],
      };
      const updated: GateOutput = {
        ...output,
        humanDecisions: nextDecisions,
        updatedAt: new Date().toISOString(),
      };
      setOutput(updated);
      await saveGateOutput(updated);
    } catch (err) {
      console.error('append hooks error', err);
      alert('Failed to append hooks. Check console.');
    } finally {
      setAppendingHooks(false);
    }
  }, [project, output, gateId, projectId]);

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

  const config = getGateConfig(gateId, project ?? undefined);
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

      {generateError && (
        <div className="fixed top-4 right-4 z-50 max-w-md p-4 bg-red-500/10 border border-red-500/40 rounded-lg shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-red-400 mb-1">
                Generation failed
              </div>
              <div className="text-xs text-text-secondary whitespace-pre-wrap">{generateError}</div>
            </div>
            <button
              onClick={() => setGenerateError(null)}
              className="text-text-muted hover:text-text-primary text-lg leading-none"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

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
        project={project}
        contextBar={
          <>
            <GateContextBar project={project} onProjectChange={setProject} />
            {gateId === 'gate5' && (
              <Gate5FormatSelector project={project} onProjectChange={setProject} />
            )}
            {gateId === 'gate6' && (
              <Gate6FormatSelector project={project} onProjectChange={setProject} />
            )}
            {!(gateId === 'gate6' && project.selectedAdScriptFormat === 'skipped') && (
              <GateGenerationConfigPanel gateId={gateId} project={project} onSaved={setProject} />
            )}
          </>
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
          <div className="mb-4 p-3 bg-bg-card border border-border rounded-xl flex items-center gap-3">
            <button
              onClick={handleGenerateVariant}
              disabled={generatingVariant || variants.length >= 4}
              className="px-4 py-2 bg-accent-teal text-white rounded-lg text-sm font-semibold hover:bg-accent-teal-hover disabled:opacity-40 transition-colors"
            >
              {generatingVariant ? 'Generating variant...' : `+ New Variant (${variants.length > 0 ? variants.length : 1}/4)`}
            </button>
            <span className="text-xs text-text-muted">Generate an alternate version with different creative angles</span>
            {variants.length > 1 && (
              <div className="flex gap-1 ml-auto">
                {variants.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveVariant(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeVariant === i
                        ? 'bg-accent-orange text-white'
                        : 'bg-bg-primary border border-border text-text-secondary hover:border-accent-orange'
                    }`}
                  >
                    {i === 0 ? 'Original' : `V${i}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {output && output.generationLog && output.generationLog.length > 0 && (
          <GateCostBadge
            log={output.generationLog}
            gateLabel={GATE_LABELS[gateId] ?? gateId}
          />
        )}

        {/* Gate 7 — Creative Studio (SOP-driven: Niche DR / Big Brand / Native) */}
        {gateId === 'gate7' && (
          <CreativeStudio
            project={project}
            existingData={output?.data as Record<string, unknown> | undefined}
            humanDecisions={output?.humanDecisions ?? {}}
            onDecisionsChange={handleDecisionsChange}
          />
        )}
        {/* Gate 8 — Image generation via existing StaticAdStudio.
            Studio expects Gate 7's preset shape; G8 output is flat configs[] — use G7 data as the source. */}
        {output && output.data && gateId === 'gate8' && (
          <StaticAdStudio
            data={(upstreamData.gate7 ?? output.data) as Record<string, unknown>}
            humanDecisions={output.humanDecisions ?? {}}
            onDecisionsChange={handleDecisionsChange}
            gate4Data={upstreamData.gate4}
            gate6Data={upstreamData.gate6}
            project={project}
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
        {output && output.data && gateId === 'gate3' && (
          <MechanismView
            data={variants.length > 1 ? (variants[activeVariant] || output.data) : output.data}
            humanDecisions={output.humanDecisions ?? {}}
            onDecisionsChange={handleDecisionsChange}
          />
        )}
        {output && output.data && gateId === 'gate4' && (
          <CopyArsenalView
            data={variants.length > 1 ? (variants[activeVariant] || output.data) : output.data}
            humanDecisions={output.humanDecisions ?? {}}
            onDecisionsChange={handleDecisionsChange}
            onAppendHooks={handleAppendHooks}
            appendingHooks={appendingHooks}
          />
        )}
        {output && output.data && gateId === 'gate5' && (
          <Gate5FormatView
            data={variants.length > 1 ? (variants[activeVariant] || output.data) : output.data}
            project={project}
            humanDecisions={output.humanDecisions ?? {}}
            onDecisionsChange={handleDecisionsChange}
          />
        )}
        {output && output.data && gateId !== 'gate2' && gateId !== 'gate3' && gateId !== 'gate4' && gateId !== 'gate5' && gateId !== 'gate7' && gateId !== 'gate8' && (
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
