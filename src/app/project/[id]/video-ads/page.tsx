'use client';

// ============================================================
// PAWEN — Animated Video Ads page (Architect / Factory)
// Script → per-scene image → animate (Kling/Veo) → preview → export.
// Architect: user picks hook/body/CTA/character from mined angles.
// Factory:   one-click, top-scored items picked automatically (batch TOF/MOF/BOF).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Project } from '@/lib/types';
import type { Scene, VideoAdScript, VideoModel } from '@/lib/video/types';
import {
  getProject,
  getProjectVideoAds,
  saveVideoAd,
  deleteVideoAd,
} from '@/lib/store/db';
import {
  mineAngles,
  pickFactoryDefaults,
  type MinedAngles,
  type MinedHook,
  type MinedBodyAngle,
  type MinedCTA,
  type MinedCharacterSuggestion,
  type MinedProofPoint,
  type MinedVerbatim,
} from '@/lib/video/angleMiner';
import {
  checkCongruence,
  serializeCongruenceGuardrails,
  type CongruenceReport,
} from '@/lib/video/congruence';

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type FunnelStage = 'TOF' | 'MOF' | 'BOF';
type Mode = 'architect' | 'factory';

const MODEL_OPTIONS: { value: VideoModel; label: string; note: string }[] = [
  { value: 'kling-2-5-turbo', label: 'Kling 2.5 Turbo', note: 'fast + cheap' },
  { value: 'kling-2-master', label: 'Kling 2 Master', note: 'highest quality' },
  { value: 'veo-3', label: 'Veo 3', note: 'Google, best audio' },
];

export default function VideoAdsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [ads, setAds] = useState<VideoAdScript[]>([]);
  const [activeAdId, setActiveAdId] = useState<string | null>(null);

  // Mode + sub-avatar picker
  const [mode, setMode] = useState<Mode>('architect');
  const [subAvatarId, setSubAvatarId] = useState<string | undefined>(undefined);

  // Architect selections (locked choices)
  const [selectedHook, setSelectedHook] = useState<MinedHook | null>(null);
  const [customHook, setCustomHook] = useState('');
  const [selectedBody, setSelectedBody] = useState<MinedBodyAngle | null>(null);
  const [selectedCTA, setSelectedCTA] = useState<MinedCTA | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<MinedCharacterSuggestion | null>(null);
  const [selectedProof, setSelectedProof] = useState<MinedProofPoint | null>(null);
  const [selectedVerbatim, setSelectedVerbatim] = useState<MinedVerbatim | null>(null);

  // Gen form
  const [funnelPosition, setFunnelPosition] = useState<FunnelStage>('TOF');
  const [targetDuration, setTargetDuration] = useState(35);
  const [extraNotes, setExtraNotes] = useState('');
  const [model, setModel] = useState<VideoModel>('kling-2-5-turbo');
  const [imageModel, setImageModel] =
    useState<'nano-banana-pro'>('nano-banana-pro');

  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [factoryProgress, setFactoryProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load project + ads
  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);
      setSubAvatarId(p.selectedSubAvatarId);
      const list = await getProjectVideoAds(projectId);
      setAds(list);
      if (list.length > 0) setActiveAdId(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // === MINED ANGLES (recomputed when project/subAvatar/funnel changes) ===
  const mined: MinedAngles | null = useMemo(() => {
    if (!project) return null;
    return mineAngles(project, subAvatarId, funnelPosition);
  }, [project, subAvatarId, funnelPosition]);

  // Auto-select top-scored defaults when mined changes (Architect mode)
  useEffect(() => {
    if (!mined || mode !== 'architect') return;
    if (!selectedHook && mined.hooks[0]) setSelectedHook(mined.hooks[0]);
    if (!selectedBody && mined.body_angles[0]) setSelectedBody(mined.body_angles[0]);
    if (!selectedCTA && mined.ctas[0]) {
      const stageCta = mined.ctas.find(c => c.funnel_fit === funnelPosition) ?? mined.ctas[0];
      setSelectedCTA(stageCta);
    }
    if (!selectedCharacter && mined.character_suggestions[0]) setSelectedCharacter(mined.character_suggestions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mined, mode]);

  const activeAd = useMemo(
    () => ads.find((a) => a.id === activeAdId) ?? null,
    [ads, activeAdId],
  );

  const allSubAvatars = project?.avatarRunResult?.sub_avatars ?? [];
  const selectedSubAvatar = allSubAvatars.find(s => s.id === subAvatarId) ?? allSubAvatars[0] ?? null;

  // === CONGRUENCE ===
  const congruence: CongruenceReport | null = useMemo(() => {
    if (!project) return null;
    return checkCongruence({
      project,
      subAvatarId,
      funnel: funnelPosition,
      hook: customHook ? { text: customHook } : selectedHook ?? undefined,
      bodyAngle: selectedBody ?? undefined,
      cta: selectedCTA ?? undefined,
      character: selectedCharacter ?? undefined,
      customHookText: customHook || undefined,
    });
  }, [project, subAvatarId, funnelPosition, selectedHook, customHook, selectedBody, selectedCTA, selectedCharacter]);

  // === SCRIPT GENERATION ===

  const buildSharedBody = useCallback(
    (stage: FunnelStage, hookText: string) => {
      if (!project) return null;
      const guardrails = serializeCongruenceGuardrails({
        project,
        subAvatarId,
        funnel: stage,
        hook: { text: hookText },
        bodyAngle: selectedBody ?? undefined,
        cta: selectedCTA ?? undefined,
        character: selectedCharacter ?? undefined,
        customHookText: hookText,
      });
      return {
        subAvatar: selectedSubAvatar,
        brandDNA: project.brandDNA ?? null,
        hook: hookText,
        bodyAngle: selectedBody?.text ?? null,
        cta: selectedCTA?.text ?? null,
        character: selectedCharacter
          ? {
              name: selectedCharacter.name,
              object_type: selectedCharacter.object_type,
              rationale: selectedCharacter.rationale,
            }
          : null,
        proofPoint: selectedProof?.text ?? null,
        verbatim: selectedVerbatim?.quote ?? null,
        funnelPosition: stage,
        targetLanguage: project.targetLanguage || 'en-US',
        targetMarket: project.targetMarket || 'US',
        productContext: project.shopifyData ?? { product: project.productDescription, name: project.name },
        extraNotes,
        targetDurationS: targetDuration,
        guardrails,
        mode,
      };
    },
    [project, subAvatarId, selectedSubAvatar, selectedBody, selectedCTA, selectedCharacter, selectedProof, selectedVerbatim, extraNotes, targetDuration, mode],
  );

  const saveFromScript = useCallback(
    async (
      script: {
        title?: string;
        hook_angle?: string;
        total_duration_s?: number;
        aspect_ratio?: '9:16' | '16:9' | '1:1';
        character?: VideoAdScript['character'];
        scenes?: Array<Omit<Scene, 'id'>>;
        notes?: string;
      },
      stage: FunnelStage,
      hookText: string,
    ) => {
      if (!project) return null;
      const now = new Date().toISOString();
      const ad: VideoAdScript = {
        id: uid('vid'),
        project_id: projectId,
        title: script.title ?? `Video ad — ${hookText.slice(0, 40)}`,
        hook_angle: script.hook_angle ?? hookText,
        sub_avatar_id: selectedSubAvatar?.id,
        funnel_position: stage,
        target_language: project.targetLanguage || 'en-US',
        target_market: project.targetMarket || 'US',
        total_duration_s: script.total_duration_s ?? targetDuration,
        aspect_ratio: script.aspect_ratio ?? '9:16',
        character:
          script.character ??
          (selectedCharacter
            ? {
                name: selectedCharacter.name,
                object_type: selectedCharacter.object_type,
                visual_style: 'pixar-style 3D, 9:16',
              }
            : { name: 'Mascot', object_type: 'product', visual_style: 'pixar-style 3D' }),
        scenes: (script.scenes ?? []).map((s, i) => ({
          ...s,
          id: uid('sc'),
          order: s.order ?? i + 1,
        } as Scene)),
        model_used: model,
        status: 'draft',
        notes: script.notes,
        created_at: now,
        updated_at: now,
      };
      await saveVideoAd(ad);
      return ad;
    },
    [project, projectId, selectedSubAvatar, selectedCharacter, targetDuration, model],
  );

  // Architect mode: single stage
  const handleGenerateArchitect = useCallback(async () => {
    if (!project) return;
    const hookText = customHook.trim() || selectedHook?.text || '';
    if (!hookText) {
      setError('Pick or write a hook first');
      return;
    }
    if (congruence && !congruence.ok) {
      setError('Fix the critical congruence issues first');
      return;
    }
    setIsGeneratingScript(true);
    setError(null);
    try {
      const body = buildSharedBody(funnelPosition, hookText);
      if (!body) return;
      const res = await fetch('/api/video/script', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.script) throw new Error(data.message ?? `gen failed (${res.status})`);
      const ad = await saveFromScript(data.script, funnelPosition, hookText);
      if (ad) {
        setAds(prev => [ad, ...prev]);
        setActiveAdId(ad.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingScript(false);
    }
  }, [project, customHook, selectedHook, congruence, buildSharedBody, funnelPosition, saveFromScript]);

  // Factory mode: pick top-scored everything + batch TOF/MOF/BOF
  const handleGenerateFactory = useCallback(async () => {
    if (!project || !mined) return;
    setIsGeneratingScript(true);
    setError(null);
    setFactoryProgress('Picking top angles across TOF/MOF/BOF...');
    try {
      const stages: FunnelStage[] = ['TOF', 'MOF', 'BOF'];
      const newAds: VideoAdScript[] = [];
      for (const stage of stages) {
        setFactoryProgress(`Writing ${stage} script...`);
        const picks = pickFactoryDefaults(
          mineAngles(project, subAvatarId, stage),
          stage,
        );
        const hookText = picks.hook?.text ?? mined.hooks[0]?.text ?? '';
        if (!hookText) throw new Error('No hooks mined — run Gate 1 first');

        // Temporarily swap selected items (Factory auto-picks)
        const body = (() => {
          const guardrails = serializeCongruenceGuardrails({
            project,
            subAvatarId,
            funnel: stage,
            hook: { text: hookText },
            bodyAngle: picks.body_angle,
            cta: picks.cta,
            character: picks.character,
            customHookText: hookText,
          });
          return {
            subAvatar: selectedSubAvatar,
            brandDNA: project.brandDNA ?? null,
            hook: hookText,
            bodyAngle: picks.body_angle?.text ?? null,
            cta: picks.cta?.text ?? null,
            character: picks.character
              ? { name: picks.character.name, object_type: picks.character.object_type, rationale: picks.character.rationale }
              : null,
            proofPoint: picks.proof_point?.text ?? null,
            verbatim: picks.verbatim?.quote ?? null,
            funnelPosition: stage,
            targetLanguage: project.targetLanguage || 'en-US',
            targetMarket: project.targetMarket || 'US',
            productContext: project.shopifyData ?? { product: project.productDescription, name: project.name },
            extraNotes,
            targetDurationS: targetDuration,
            guardrails,
            mode: 'factory' as const,
          };
        })();

        const res = await fetch('/api/video/script', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.ok || !data.script) {
          throw new Error(`${stage}: ${data.message ?? 'gen failed'}`);
        }
        const ad = await saveFromScript(data.script, stage, hookText);
        if (ad) newAds.push(ad);
      }
      setAds(prev => [...newAds, ...prev]);
      if (newAds[0]) setActiveAdId(newAds[0].id);
      setFactoryProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFactoryProgress(null);
    } finally {
      setIsGeneratingScript(false);
    }
  }, [project, mined, subAvatarId, selectedSubAvatar, extraNotes, targetDuration, saveFromScript]);

  // === SCENE ACTIONS ===

  const updateScene = useCallback(async (sceneId: string, patch: Partial<Scene>) => {
    if (!activeAd) return;
    const next: VideoAdScript = {
      ...activeAd,
      scenes: activeAd.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
      updated_at: new Date().toISOString(),
    };
    await saveVideoAd(next);
    setAds((prev) => prev.map((a) => (a.id === next.id ? next : a)));
  }, [activeAd]);

  const handleGenerateImage = useCallback(async (scene: Scene) => {
    if (!activeAd) return;
    await updateScene(scene.id, { is_generating_image: true, generation_error: undefined });
    try {
      const res = await fetch('/api/imagegen', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: imageModel,
          prompt: scene.starting_image_prompt,
          width: 1080,
          height: 1920,
          guidanceScale: 7,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'image gen failed');
      const url = data.images?.[0]?.url;
      if (!url) throw new Error('no image returned');
      await updateScene(scene.id, { starting_image_url: url, is_generating_image: false });
    } catch (err) {
      await updateScene(scene.id, {
        is_generating_image: false,
        generation_error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [activeAd, imageModel, updateScene]);

  const handleAnimate = useCallback(async (scene: Scene) => {
    if (!activeAd) return;
    if (!scene.starting_image_url) {
      await updateScene(scene.id, { generation_error: 'Generate the starting image first' });
      return;
    }
    await updateScene(scene.id, { is_generating_video: true, generation_error: undefined });
    try {
      const res = await fetch('/api/video/animate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeAd.model_used ?? model,
          imageUrl: scene.starting_image_url,
          prompt: scene.animation_prompt,
          durationSeconds: scene.duration,
          aspectRatio: activeAd.aspect_ratio,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? 'animate failed');
      await updateScene(scene.id, {
        video_url: data.video_url,
        video_seed: data.seed,
        is_generating_video: false,
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      await updateScene(scene.id, {
        is_generating_video: false,
        generation_error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [activeAd, model, updateScene]);

  const handleGenerateAllImages = useCallback(async () => {
    if (!activeAd) return;
    for (const sc of activeAd.scenes) {
      if (!sc.starting_image_url) await handleGenerateImage(sc);
    }
  }, [activeAd, handleGenerateImage]);

  const handleAnimateAll = useCallback(async () => {
    if (!activeAd) return;
    for (const sc of activeAd.scenes) {
      if (sc.starting_image_url && !sc.video_url) {
        await handleAnimate(sc);
      }
    }
  }, [activeAd, handleAnimate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this video ad?')) return;
    await deleteVideoAd(id);
    setAds((prev) => prev.filter((a) => a.id !== id));
    if (activeAdId === id) setActiveAdId(null);
  }, [activeAdId]);

  if (!project) return <div className="p-8 text-text-muted">Loading project...</div>;

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="border-b border-border bg-bg-card px-6 py-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">{project.name}</div>
          <h1 className="text-lg font-bold text-text-primary">Animated Video Ads</h1>
        </div>
        <button
          onClick={() => router.push(`/project/${projectId}`)}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          ← Back to project
        </button>
      </div>

      <div className="flex h-[calc(100vh-60px)]">
        {/* ============ LEFT SIDEBAR ============ */}
        <aside className="w-[420px] border-r border-border overflow-y-auto p-5 space-y-5">
          {/* Mode toggle */}
          <div className="p-3 bg-bg-card rounded-xl border border-border">
            <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">Mode</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('architect')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border ${
                  mode === 'architect'
                    ? 'bg-accent-orange/20 text-accent-orange border-accent-orange/40'
                    : 'bg-bg-primary text-text-muted border-border hover:border-accent-orange/40'
                }`}
              >
                🧠 Architect
                <div className="text-[9px] font-normal text-text-muted mt-0.5">You pick every angle</div>
              </button>
              <button
                onClick={() => setMode('factory')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border ${
                  mode === 'factory'
                    ? 'bg-accent-teal/20 text-accent-teal border-accent-teal/40'
                    : 'bg-bg-primary text-text-muted border-border hover:border-accent-teal/40'
                }`}
              >
                🏭 Factory
                <div className="text-[9px] font-normal text-text-muted mt-0.5">AI picks top scored, batch TOF/MOF/BOF</div>
              </button>
            </div>
          </div>

          {/* Sub-avatar picker */}
          <div className="p-3 bg-bg-card rounded-xl border border-border">
            <label className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Sub-avatar</label>
            {allSubAvatars.length === 0 ? (
              <div className="text-[11px] text-red-400 mt-2">
                No sub-avatars yet — run Gate 1 first.
              </div>
            ) : (
              <select
                value={subAvatarId ?? allSubAvatars[0]?.id}
                onChange={(e) => {
                  setSubAvatarId(e.target.value);
                  // Reset picks so they re-pick from the new sub-avatar
                  setSelectedHook(null); setSelectedBody(null); setSelectedCTA(null); setSelectedVerbatim(null);
                }}
                className="w-full mt-2 px-2 py-1.5 bg-bg-input border border-border rounded text-text-primary text-xs"
              >
                {allSubAvatars.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nickname} — {s.dominant_category}
                  </option>
                ))}
              </select>
            )}
            {selectedSubAvatar && (
              <div className="text-[10px] text-text-muted mt-2 italic line-clamp-2">{selectedSubAvatar.description}</div>
            )}
          </div>

          {/* Funnel + Duration */}
          <div className="p-3 bg-bg-card rounded-xl border border-border space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-text-muted uppercase">Funnel {mode === 'factory' ? '(Factory ignores — runs 3)' : ''}</label>
                <select
                  value={funnelPosition}
                  disabled={mode === 'factory'}
                  onChange={(e) => setFunnelPosition(e.target.value as FunnelStage)}
                  className="w-full mt-1 px-2 py-1.5 bg-bg-input border border-border rounded text-text-primary text-xs disabled:opacity-50"
                >
                  <option value="TOF">TOF</option>
                  <option value="MOF">MOF</option>
                  <option value="BOF">BOF</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-muted uppercase">Duration (s)</label>
                <input
                  type="number"
                  min={15}
                  max={60}
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 bg-bg-input border border-border rounded text-text-primary text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-text-muted uppercase">Video model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as VideoModel)}
                className="w-full mt-1 px-2 py-1.5 bg-bg-input border border-border rounded text-text-primary text-xs"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label} — {m.note}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-text-muted uppercase">Image model</label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value as typeof imageModel)}
                className="w-full mt-1 px-2 py-1.5 bg-bg-input border border-border rounded text-text-primary text-xs"
              >
                <option value="nano-banana-pro">Nano Banana Pro (only)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-text-muted uppercase">Extra notes (optional)</label>
              <textarea
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                rows={2}
                placeholder="e.g. must be a lemon, use Italian slang"
                className="w-full mt-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-xs"
              />
            </div>
          </div>

          {/* Congruence panel */}
          {congruence && (
            <div className={`p-3 rounded-xl border ${
              congruence.ok
                ? congruence.score >= 85 ? 'bg-green-500/10 border-green-500/40'
                : 'bg-yellow-500/10 border-yellow-500/40'
                : 'bg-red-500/10 border-red-500/40'
            }`}>
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wider font-bold">
                  Congruence A→Z
                </div>
                <div className={`text-sm font-bold ${
                  congruence.score >= 85 ? 'text-green-400'
                  : congruence.score >= 60 ? 'text-yellow-400'
                  : 'text-red-400'
                }`}>
                  {congruence.score}/100
                </div>
              </div>
              {congruence.issues.length === 0 ? (
                <div className="text-[11px] text-green-400 mt-1">✓ All locked elements are coherent.</div>
              ) : (
                <ul className="mt-2 space-y-1">
                  {congruence.issues.slice(0, 5).map((iss, i) => (
                    <li key={i} className="text-[11px] flex items-start gap-1">
                      <span className={
                        iss.severity === 'critical' ? 'text-red-400'
                        : iss.severity === 'warning' ? 'text-yellow-400'
                        : 'text-text-muted'
                      }>
                        {iss.severity === 'critical' ? '✗' : iss.severity === 'warning' ? '⚠' : 'ℹ'}
                      </span>
                      <span className="text-text-secondary">{iss.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={mode === 'factory' ? handleGenerateFactory : handleGenerateArchitect}
            disabled={isGeneratingScript || (congruence && !congruence.ok) || allSubAvatars.length === 0}
            className={`w-full px-4 py-3 text-sm font-semibold rounded-lg disabled:opacity-50 text-white ${
              mode === 'factory'
                ? 'bg-accent-teal hover:bg-accent-teal-hover'
                : 'bg-accent-orange hover:bg-accent-orange-hover'
            }`}
          >
            {isGeneratingScript
              ? (factoryProgress ?? 'Writing script...')
              : mode === 'factory'
                ? '🏭 Run Factory — 3 scripts (TOF + MOF + BOF)'
                : '🧠 Generate script →'}
          </button>
          {error && <div className="text-[11px] text-red-400">{error}</div>}

          {/* Ads list */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">
              Your video ads ({ads.length})
            </div>
            <div className="space-y-2">
              {ads.map((ad) => (
                <button
                  key={ad.id}
                  onClick={() => setActiveAdId(ad.id)}
                  className={`w-full text-left p-3 rounded-lg border ${
                    activeAdId === ad.id
                      ? 'bg-accent-orange/10 border-accent-orange/40'
                      : 'bg-bg-card border-border hover:border-accent-orange/40'
                  }`}
                >
                  <div className="text-sm font-semibold text-text-primary truncate">{ad.title}</div>
                  <div className="text-[10px] text-text-muted mt-1">
                    {ad.scenes.length} scenes · {ad.total_duration_s}s · {ad.funnel_position}
                  </div>
                </button>
              ))}
              {ads.length === 0 && (
                <div className="text-xs text-text-muted italic p-3 text-center">
                  No ads yet. Run Architect or Factory ↑
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ============ MAIN AREA ============ */}
        <main className="flex-1 overflow-y-auto p-6">
          {mode === 'architect' && mined ? (
            <ArchitectPanel
              mined={mined}
              funnel={funnelPosition}
              selectedHook={selectedHook}
              setSelectedHook={setSelectedHook}
              customHook={customHook}
              setCustomHook={setCustomHook}
              selectedBody={selectedBody}
              setSelectedBody={setSelectedBody}
              selectedCTA={selectedCTA}
              setSelectedCTA={setSelectedCTA}
              selectedCharacter={selectedCharacter}
              setSelectedCharacter={setSelectedCharacter}
              selectedProof={selectedProof}
              setSelectedProof={setSelectedProof}
              selectedVerbatim={selectedVerbatim}
              setSelectedVerbatim={setSelectedVerbatim}
              activeAd={activeAd}
              onGenImage={handleGenerateImage}
              onAnimate={handleAnimate}
              onGenAllImages={handleGenerateAllImages}
              onAnimateAll={handleAnimateAll}
              onDelete={handleDelete}
            />
          ) : (
            <FactoryPanel
              mined={mined}
              activeAd={activeAd}
              onGenImage={handleGenerateImage}
              onAnimate={handleAnimate}
              onGenAllImages={handleGenerateAllImages}
              onAnimateAll={handleAnimateAll}
              onDelete={handleDelete}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// ARCHITECT PANEL
// ============================================================

function ArchitectPanel({
  mined, funnel,
  selectedHook, setSelectedHook, customHook, setCustomHook,
  selectedBody, setSelectedBody,
  selectedCTA, setSelectedCTA,
  selectedCharacter, setSelectedCharacter,
  selectedProof, setSelectedProof,
  selectedVerbatim, setSelectedVerbatim,
  activeAd, onGenImage, onAnimate, onGenAllImages, onAnimateAll, onDelete,
}: {
  mined: MinedAngles;
  funnel: FunnelStage;
  selectedHook: MinedHook | null;
  setSelectedHook: (h: MinedHook | null) => void;
  customHook: string;
  setCustomHook: (s: string) => void;
  selectedBody: MinedBodyAngle | null;
  setSelectedBody: (b: MinedBodyAngle | null) => void;
  selectedCTA: MinedCTA | null;
  setSelectedCTA: (c: MinedCTA | null) => void;
  selectedCharacter: MinedCharacterSuggestion | null;
  setSelectedCharacter: (c: MinedCharacterSuggestion | null) => void;
  selectedProof: MinedProofPoint | null;
  setSelectedProof: (p: MinedProofPoint | null) => void;
  selectedVerbatim: MinedVerbatim | null;
  setSelectedVerbatim: (v: MinedVerbatim | null) => void;
  activeAd: VideoAdScript | null;
  onGenImage: (s: Scene) => void;
  onAnimate: (s: Scene) => void;
  onGenAllImages: () => void;
  onAnimateAll: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">🧠 Architect mode — pick every angle</h2>
        <p className="text-xs text-text-muted mt-1">
          Everything below is mined from Gate 1 (sub-avatar) + Brand DNA + Deep Dives. Pick the angles you want, or write your own hook.
        </p>
      </div>

      {/* HOOKS */}
      <section>
        <SectionHeader count={mined.hooks.length} label="Hooks" sub="Sub-avatar scored_hooks + primary angles + awareness variants" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {mined.hooks.slice(0, 12).map(h => (
            <PickCard
              key={h.id}
              active={selectedHook?.id === h.id && !customHook}
              onClick={() => { setSelectedHook(h); setCustomHook(''); }}
              score={h.score}
              source={h.source}
              text={h.text}
            />
          ))}
        </div>
        <div className="mt-3">
          <label className="text-[10px] text-text-muted uppercase">Or write your own hook (overrides picked)</label>
          <textarea
            value={customHook}
            onChange={e => setCustomHook(e.target.value)}
            rows={2}
            placeholder="Custom hook..."
            className="w-full mt-1 px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm"
          />
        </div>
      </section>

      {/* BODY ANGLES */}
      <section>
        <SectionHeader count={mined.body_angles.length} label="Body angle (middle scenes)" sub="Brand DNA mechanism + deep-dive fears/triggers/identity" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {mined.body_angles.slice(0, 10).map(b => (
            <PickCard
              key={b.id}
              active={selectedBody?.id === b.id}
              onClick={() => setSelectedBody(b)}
              score={b.score}
              source={`${b.source} · ${b.type}`}
              text={b.text}
            />
          ))}
        </div>
      </section>

      {/* CTAs */}
      <section>
        <SectionHeader count={mined.ctas.length} label={`CTAs (fit for ${funnel})`} sub="Brand DNA arc + guarantee + funnel-stage defaults" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {mined.ctas.map(c => (
            <PickCard
              key={c.id}
              active={selectedCTA?.id === c.id}
              onClick={() => setSelectedCTA(c)}
              source={`${c.source} · ${c.funnel_fit}`}
              text={c.text}
              warn={c.funnel_fit !== 'any' && c.funnel_fit !== funnel}
            />
          ))}
        </div>
      </section>

      {/* CHARACTER */}
      <section>
        <SectionHeader count={mined.character_suggestions.length} label="Animated character (must appear in every scene)" sub="Product-grounded suggestions" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {mined.character_suggestions.map(c => (
            <PickCard
              key={c.id}
              active={selectedCharacter?.id === c.id}
              onClick={() => setSelectedCharacter(c)}
              source={c.object_type}
              text={<><b>{c.name}</b><div className="text-[10px] text-text-muted mt-1">{c.rationale}</div></>}
            />
          ))}
        </div>
      </section>

      {/* PROOF + VERBATIM (optional) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section>
          <SectionHeader count={mined.proof_points.length} label="Proof point (optional)" sub="Testimonials + ratings + guarantee" />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {mined.proof_points.slice(0, 6).map(p => (
              <PickCard
                key={p.id}
                active={selectedProof?.id === p.id}
                onClick={() => setSelectedProof(selectedProof?.id === p.id ? null : p)}
                source={`${p.source} · ${p.type}`}
                text={p.text}
              />
            ))}
          </div>
        </section>
        <section>
          <SectionHeader count={mined.verbatims.length} label="Customer verbatim (optional)" sub="Raw quotes from research — drop into dialogue" />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {mined.verbatims.slice(0, 6).map(v => (
              <PickCard
                key={v.id}
                active={selectedVerbatim?.id === v.id}
                onClick={() => setSelectedVerbatim(selectedVerbatim?.id === v.id ? null : v)}
                source={v.emotion ?? 'verbatim'}
                text={`"${v.quote}"`}
              />
            ))}
          </div>
        </section>
      </div>

      {/* SCENES (once generated) */}
      {activeAd && (
        <SceneEditor
          activeAd={activeAd}
          onGenImage={onGenImage}
          onAnimate={onAnimate}
          onGenAllImages={onGenAllImages}
          onAnimateAll={onAnimateAll}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

// ============================================================
// FACTORY PANEL
// ============================================================

function FactoryPanel({
  mined, activeAd, onGenImage, onAnimate, onGenAllImages, onAnimateAll, onDelete,
}: {
  mined: MinedAngles | null;
  activeAd: VideoAdScript | null;
  onGenImage: (s: Scene) => void;
  onAnimate: (s: Scene) => void;
  onGenAllImages: () => void;
  onAnimateAll: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary">🏭 Factory mode — AI picks top angles, batch 3 stages</h2>
        <p className="text-xs text-text-muted mt-1">
          One click → 3 scripts (TOF, MOF, BOF). Each uses the top-scored hook, body, CTA and character from the mined angles below. Congruence guardrails auto-inject.
        </p>
      </div>

      {mined && (
        <div className="grid grid-cols-2 gap-4">
          <FactoryPreview label="Hook (top scored)" item={mined.hooks[0]?.text} meta={mined.hooks[0] ? `${mined.hooks[0].source} · ${mined.hooks[0].score}/100` : undefined} />
          <FactoryPreview label="Body angle (top scored)" item={mined.body_angles[0]?.text} meta={mined.body_angles[0] ? `${mined.body_angles[0].source} · ${mined.body_angles[0].type}` : undefined} />
          <FactoryPreview label="Character" item={mined.character_suggestions[0]?.name} meta={mined.character_suggestions[0]?.object_type} />
          <FactoryPreview label="Mechanism name" item={mined.mechanism_name} meta="From Brand DNA" />
        </div>
      )}

      {activeAd && (
        <SceneEditor
          activeAd={activeAd}
          onGenImage={onGenImage}
          onAnimate={onAnimate}
          onGenAllImages={onGenAllImages}
          onAnimateAll={onAnimateAll}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function FactoryPreview({ label, item, meta }: { label: string; item?: string; meta?: string }) {
  return (
    <div className="p-3 bg-bg-card border border-border rounded-lg">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-sm text-text-primary mt-1 font-medium">{item ?? <i className="text-text-muted">Nothing mined</i>}</div>
      {meta && <div className="text-[10px] text-text-muted mt-1">{meta}</div>}
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function SectionHeader({ count, label, sub }: { count: number; label: string; sub: string }) {
  return (
    <div className="mb-2">
      <div className="text-sm font-bold text-text-primary">
        {label} <span className="text-text-muted text-xs">({count})</span>
      </div>
      <div className="text-[10px] text-text-muted">{sub}</div>
    </div>
  );
}

function PickCard({
  active, onClick, score, source, text, warn,
}: {
  active: boolean;
  onClick: () => void;
  score?: number;
  source: string;
  text: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-colors ${
        active
          ? 'bg-accent-orange/10 border-accent-orange/60 ring-1 ring-accent-orange/40'
          : warn
            ? 'bg-yellow-500/5 border-yellow-500/30 hover:border-yellow-500/60'
            : 'bg-bg-card border-border hover:border-accent-orange/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-[9px] uppercase tracking-wider text-text-muted">{source}</div>
        {typeof score === 'number' && (
          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            score >= 80 ? 'bg-green-500/20 text-green-400'
            : score >= 60 ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-text-muted/20 text-text-muted'
          }`}>
            {score}
          </div>
        )}
      </div>
      <div className="text-sm text-text-primary">{text}</div>
    </button>
  );
}

function SceneEditor({
  activeAd, onGenImage, onAnimate, onGenAllImages, onAnimateAll, onDelete,
}: {
  activeAd: VideoAdScript;
  onGenImage: (s: Scene) => void;
  onAnimate: (s: Scene) => void;
  onGenAllImages: () => void;
  onAnimateAll: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4 border-t border-border pt-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-text-primary">{activeAd.title}</h3>
          <div className="text-xs text-text-muted mt-1">
            Hook: <span className="text-accent-orange">{activeAd.hook_angle}</span> · {activeAd.scenes.length} scenes · {activeAd.total_duration_s}s · {activeAd.funnel_position}
          </div>
          <div className="text-xs text-text-secondary mt-1">
            <span className="text-text-muted">Character:</span> {activeAd.character.name} — {activeAd.character.object_type}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onGenAllImages} className="px-3 py-1.5 text-xs bg-accent-teal text-white rounded hover:bg-accent-teal-hover">Gen all images</button>
          <button onClick={onAnimateAll} className="px-3 py-1.5 text-xs bg-accent-orange text-white rounded hover:bg-accent-orange-hover">Animate all</button>
          <button onClick={() => onDelete(activeAd.id)} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300">Delete</button>
        </div>
      </div>

      {activeAd.notes && (
        <div className="p-3 bg-bg-card border border-border rounded-lg text-[11px] text-text-muted italic">📝 {activeAd.notes}</div>
      )}

      <div className="space-y-4">
        {activeAd.scenes.map((scene, i) => (
          <div key={scene.id} className="p-5 bg-bg-card border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-accent-orange font-bold">
                  Scene {i + 1} · {scene.role} · {scene.duration}s · {scene.personality}
                </div>
                <div className="text-xs text-text-muted mt-1">{scene.environment}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onGenImage(scene)}
                  disabled={scene.is_generating_image}
                  className="px-3 py-1.5 text-[11px] bg-accent-teal/20 text-accent-teal border border-accent-teal/40 rounded hover:bg-accent-teal/30 disabled:opacity-50"
                >
                  {scene.is_generating_image ? '🎨 Generating...' : scene.starting_image_url ? '🔄 Regen image' : '🎨 Gen image'}
                </button>
                <button
                  onClick={() => onAnimate(scene)}
                  disabled={scene.is_generating_video || !scene.starting_image_url}
                  className="px-3 py-1.5 text-[11px] bg-accent-orange/20 text-accent-orange border border-accent-orange/40 rounded hover:bg-accent-orange/30 disabled:opacity-30"
                >
                  {scene.is_generating_video ? '🎬 Animating...' : scene.video_url ? '🔄 Re-animate' : '🎬 Animate'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div>
                  <div className="text-[9px] uppercase text-text-muted">Dialogue</div>
                  <div className="text-sm text-text-primary italic">&ldquo;{scene.dialogue}&rdquo;</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-text-muted">Action</div>
                  <div className="text-xs text-text-secondary">{scene.action}</div>
                </div>
                <details className="text-[11px]">
                  <summary className="text-text-muted cursor-pointer">Image prompt</summary>
                  <div className="mt-1 p-2 bg-bg-primary rounded text-text-secondary font-mono text-[10px]">{scene.starting_image_prompt}</div>
                </details>
                <details className="text-[11px]">
                  <summary className="text-text-muted cursor-pointer">Animation prompt</summary>
                  <div className="mt-1 p-2 bg-bg-primary rounded text-text-secondary font-mono text-[10px]">{scene.animation_prompt}</div>
                </details>
              </div>

              <div className="space-y-2">
                {scene.starting_image_url && (
                  <div>
                    <div className="text-[9px] uppercase text-text-muted mb-1">Starting image</div>
                    { }
                    <img src={scene.starting_image_url} alt={`Scene ${i + 1}`} className="w-full max-w-[160px] rounded border border-border" />
                  </div>
                )}
                {scene.video_url && (
                  <div>
                    <div className="text-[9px] uppercase text-text-muted mb-1">Video</div>
                    <video src={scene.video_url} controls loop className="w-full max-w-[240px] rounded border border-accent-orange/40" />
                    <a href={scene.video_url} download target="_blank" rel="noreferrer" className="text-[10px] text-accent-orange hover:underline">Download clip ↓</a>
                  </div>
                )}
                {scene.generation_error && (
                  <div className="text-[10px] text-red-400 p-2 bg-red-500/10 rounded">⚠ {scene.generation_error}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-bg-card border border-border rounded-xl">
        <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-2">Export</div>
        <div className="flex gap-2 flex-wrap">
          {activeAd.scenes.filter((s) => s.video_url).map((s, i) => (
            <a key={s.id} href={s.video_url} download target="_blank" rel="noreferrer"
              className="px-3 py-1.5 text-[11px] bg-bg-primary border border-border rounded hover:border-accent-orange">
              Scene {i + 1} ↓
            </a>
          ))}
        </div>
        <button
          onClick={() => {
            const json = JSON.stringify(activeAd, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${activeAd.title.replace(/\W+/g, '_')}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="mt-3 px-3 py-1.5 text-[11px] bg-bg-primary border border-border rounded hover:border-accent-teal"
        >
          Export full script JSON
        </button>
      </div>
    </div>
  );
}
