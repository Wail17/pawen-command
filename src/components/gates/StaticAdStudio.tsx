'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import SendToVaultButton from '@/components/swipeVault/SendToVaultButton';
import { mapWithConcurrency } from '@/lib/util/pLimit';

const CreativeFactory = dynamic(() => import('./CreativeFactory'), { ssr: false });

// -------- Types (inline — mirror the Gate 7 output shape) --------

interface HeadlineOption {
  text: string;
  score?: { curiosity: number; clarity: number; punch: number; total: number };
}

interface BriefData {
  id: string;
  name: string;
  headline_options:
    | Record<string, HeadlineOption>           // { A: {...}, B: {...}, C: {...} }
    | string[];                                 // ["A", "B", "C"]
  recommended_headline?: string;
  subheadline?: string;
  cta_text?: string;
  body_text?: string;
  visual_direction?: {
    scene_description?: string;
    mood?: string;
    lighting?: string;
    color_palette?: string[];
    composition?: string;
    focal_point?: string;
    style?: string;
    camera_angle?: string;
  };
  ai_generation_prompt?: string;
  negative_prompt?: string;
  layout?: {
    headline_position?: string;
    text_alignment?: string;
    text_background?: string;
    headline_size?: string;
    max_text_coverage_pct?: number;
  };
  emotional_intent?: string;
  why_it_works?: string;
  awareness_fit?: string;
}

interface PresetBlock {
  preset_name?: string;
  preset_icon?: string;
  quality?: 'high' | 'dynamic';
  briefs: BriefData[];
}

interface StudioData {
  static_ad_studio?: {
    metadata?: Record<string, unknown>;
    presets?: Record<string, PresetBlock>;
    rankings?: {
      top_5_briefs?: Array<{
        brief_id: string;
        preset: string;
        headline: string;
        predicted_ctr_rank: number;
        reason: string;
      }>;
      best_per_preset?: Record<string, string>;
    };
    creative_director_notes?: Record<string, unknown>;
  };
  presets?: Record<string, PresetBlock>;
}

// -------- Preset metadata --------

const PRESET_META: Record<string, { icon: string; name: string; quality: 'high' | 'dynamic' }> = {
  before_after:      { icon: '🔄', name: 'Before / After',             quality: 'high' },
  feature_highlight: { icon: '✨', name: 'Feature Highlight',          quality: 'dynamic' },
  lifestyle_context: { icon: '🌿', name: 'Lifestyle / Product in Context', quality: 'high' },
  problem_agitation: { icon: '⚡', name: 'Problem / Agitation',        quality: 'high' },
  social_proof:      { icon: '⭐', name: 'Social Proof / Testimonial', quality: 'high' },
  statistique_data:  { icon: '📊', name: 'Statistique / Data Visual',  quality: 'high' },
  unboxing_product:  { icon: '📦', name: 'Unboxing / Product Shot',    quality: 'dynamic' },
  us_vs_them:        { icon: '⚔️', name: 'Us vs Them',                quality: 'high' },
};

// -------- Helpers --------

function extractPresets(data: Record<string, unknown>): Record<string, PresetBlock> {
  // Try multiple possible locations
  const studio = data as StudioData;
  if (studio.static_ad_studio?.presets) return studio.static_ad_studio.presets;
  if (studio.presets) return studio.presets;

  // Walk to find presets object
  const result: Record<string, PresetBlock> = {};
  for (const key of Object.keys(data)) {
    if (key in PRESET_META) {
      const val = data[key];
      if (val && typeof val === 'object' && 'briefs' in (val as Record<string, unknown>)) {
        result[key] = val as PresetBlock;
      }
    }
    // Check nested
    if (typeof data[key] === 'object' && data[key] !== null) {
      const nested = data[key] as Record<string, unknown>;
      for (const nk of Object.keys(nested)) {
        if (nk in PRESET_META) {
          const nv = nested[nk];
          if (nv && typeof nv === 'object' && 'briefs' in (nv as Record<string, unknown>)) {
            result[nk] = nv as PresetBlock;
          }
        }
      }
    }
  }
  return result;
}

function getHeadlineText(opt: HeadlineOption | string): string {
  if (typeof opt === 'string') return opt;
  return opt.text || '';
}

function getHeadlineScore(opt: HeadlineOption | string): number {
  if (typeof opt === 'string') return 0;
  return opt.score?.total || 0;
}

function getHeadlineEntries(brief: BriefData): Array<{ key: string; text: string; score: number }> {
  const opts = brief.headline_options;
  if (!opts) return [];

  if (Array.isArray(opts)) {
    return opts.map((h, i) => ({
      key: String.fromCharCode(65 + i),
      text: typeof h === 'string' ? h : (h as HeadlineOption).text || '',
      score: typeof h === 'string' ? 0 : ((h as HeadlineOption).score?.total || 0),
    }));
  }

  return Object.entries(opts).map(([key, val]) => ({
    key,
    text: getHeadlineText(val),
    score: getHeadlineScore(val),
  }));
}

// -------- Component --------

interface StaticAdStudioProps {
  data: Record<string, unknown>;
  humanDecisions: Record<string, unknown>;
  onDecisionsChange: (decisions: Record<string, unknown>) => void;
  gate4Data?: Record<string, unknown>;
  gate6Data?: Record<string, unknown>;
  project?: import('@/lib/types').Project;
}

export default function StaticAdStudio({
  data,
  humanDecisions,
  onDecisionsChange,
  gate4Data,
  gate6Data,
  project,
}: StaticAdStudioProps) {
  const presets = useMemo(() => extractPresets(data), [data]);
  const presetIds = useMemo(() => Object.keys(presets), [presets]);
  const [selectedPreset, setSelectedPreset] = useState<string>(presetIds[0] || '');
  const [selectedBriefId, setSelectedBriefId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
  const [studioMode, setStudioMode] = useState<'precise' | 'factory'>(
    () => (humanDecisions?.studioMode as string) === 'factory' ? 'factory' : 'precise',
  );

  // Image generation state
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const generatedImages = (humanDecisions?.generatedImages ?? {}) as Record<string, string[]>;

  const generateImage = useCallback(async (brief: BriefData, format: { w: number; h: number; label: string }) => {
    if (!brief.ai_generation_prompt) return;
    const key = `${brief.id}_${format.label}`;
    setGeneratingIds(prev => new Set([...prev, key]));
    try {
      const res = await fetch('/api/imagegen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nano-banana-pro',
          prompt: brief.ai_generation_prompt,
          negativePrompt: brief.negative_prompt || '',
          width: format.w,
          height: format.h,
          numImages: 1,
        }),
      });
      if (!res.ok) {
        console.error('Image gen failed:', res.status);
        return;
      }
      const result = await res.json();
      const urls = (result.images || []).map((img: { url: string }) => img.url);
      if (urls.length > 0) {
        const next = { ...generatedImages, [key]: [...(generatedImages[key] || []), ...urls] };
        onDecisionsChange({ ...humanDecisions, generatedImages: next });
      }
    } catch (err) {
      console.error('Image gen error:', err);
    } finally {
      setGeneratingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, [generatedImages, humanDecisions, onDecisionsChange]);

  const IMAGE_FORMATS = [
    { w: 1080, h: 1080, label: 'feed' },
    { w: 1080, h: 1920, label: 'story' },
    { w: 1080, h: 1350, label: 'vertical' },
  ];

  // Headline selections stored in humanDecisions
  const headlineSelections = (humanDecisions?.headlineSelections ?? {}) as Record<string, string>;
  const pickedBriefs = (humanDecisions?.pickedBriefs ?? []) as string[];

  const setHeadlineSelection = useCallback((briefId: string, key: string) => {
    const next = { ...headlineSelections, [briefId]: key };
    onDecisionsChange({
      ...humanDecisions,
      headlineSelections: next,
    });
  }, [headlineSelections, humanDecisions, onDecisionsChange]);

  const toggleBriefPick = useCallback((briefId: string) => {
    const next = pickedBriefs.includes(briefId)
      ? pickedBriefs.filter(id => id !== briefId)
      : [...pickedBriefs, briefId];
    onDecisionsChange({
      ...humanDecisions,
      pickedBriefs: next,
    });
  }, [pickedBriefs, humanDecisions, onDecisionsChange]);

  const currentPreset = presets[selectedPreset];
  const currentBriefs = currentPreset?.briefs || [];
  const selectedBrief = currentBriefs.find(b => b.id === selectedBriefId);
  const meta = PRESET_META[selectedPreset] || { icon: '🎨', name: selectedPreset, quality: 'high' as const };

  // Extract rankings
  const studioData = data as StudioData;
  const rankings = studioData.static_ad_studio?.rankings;
  const directorNotes = studioData.static_ad_studio?.creative_director_notes;

  const handleModeSwitch = useCallback((mode: 'precise' | 'factory') => {
    setStudioMode(mode);
    onDecisionsChange({ ...humanDecisions, studioMode: mode });
  }, [humanDecisions, onDecisionsChange]);

  if (presetIds.length === 0) {
    return (
      <div className="p-6 text-center text-text-muted">
        No preset data found. Generate Gate 7 first.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* ============ MODE TOGGLE BAR ============ */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-bg-card/80">
        <button
          onClick={() => handleModeSwitch('precise')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            studioMode === 'precise'
              ? 'bg-accent-teal text-white shadow-lg shadow-accent-teal/20'
              : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          🎯 Precis
        </button>
        <button
          onClick={() => handleModeSwitch('factory')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            studioMode === 'factory'
              ? 'bg-gradient-to-r from-accent-orange to-purple-500 text-white shadow-lg shadow-accent-orange/20'
              : 'bg-bg-primary border border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          🏭 Usine a Crea
        </button>
        <span className="text-[10px] text-text-muted ml-2">
          {studioMode === 'precise'
            ? 'Briefs soignes, selection manuelle'
            : 'Explosion combinatoire — toutes les headlines × tous les presets'}
        </span>
      </div>

      {/* ============ FACTORY MODE ============ */}
      {studioMode === 'factory' && (
        <CreativeFactory
          gate7Data={data}
          gate4Data={gate4Data}
          gate6Data={gate6Data}
          humanDecisions={humanDecisions}
          onDecisionsChange={onDecisionsChange}
          project={project}
        />
      )}

      {/* ============ PRECISE MODE ============ */}
      {studioMode === 'precise' && (
    <div className="flex gap-0 flex-1">
      {/* ============ LEFT SIDEBAR — Preset selector ============ */}
      <div className="w-64 min-w-[256px] border-r border-border bg-bg-card overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Presets</h3>
        </div>

        {/* Preset list */}
        <div className="py-2">
          {presetIds.map(pid => {
            const pm = PRESET_META[pid] || { icon: '🎨', name: pid, quality: 'high' as const };
            const briefCount = presets[pid]?.briefs?.length || 0;
            const pickedCount = (presets[pid]?.briefs || []).filter(b => pickedBriefs.includes(b.id)).length;
            const isActive = selectedPreset === pid;

            return (
              <button
                key={pid}
                onClick={() => { setSelectedPreset(pid); setSelectedBriefId(''); setViewMode('grid'); }}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-accent-teal/10 border-l-2 border-l-accent-teal'
                    : 'hover:bg-bg-primary border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{pm.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-accent-teal' : 'text-text-primary'}`}>
                      {pm.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        pm.quality === 'high'
                          ? 'bg-accent-orange/20 text-accent-orange'
                          : 'bg-accent-teal/20 text-accent-teal'
                      }`}>
                        {pm.quality}
                      </span>
                      <span className="text-[10px] text-text-muted">{briefCount} briefs</span>
                      {pickedCount > 0 && (
                        <span className="text-[10px] text-yellow-400">★ {pickedCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Rankings section */}
        {rankings?.top_5_briefs && rankings.top_5_briefs.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Top 5 Briefs</h4>
            {rankings.top_5_briefs.map((r, i) => (
              <div key={i} className="flex items-center gap-2 py-1">
                <span className="text-xs font-bold text-accent-orange w-4">#{r.predicted_ctr_rank}</span>
                <span className="text-xs text-text-secondary truncate flex-1">{r.headline || r.brief_id}</span>
              </div>
            ))}
          </div>
        )}

        {/* Picked summary + batch generate */}
        {pickedBriefs.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <h4 className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider mb-2">
              ★ {pickedBriefs.length} Selected
            </h4>
            <button
              onClick={async () => {
                const allBriefs = Object.values(presets).flatMap(p => p.briefs || []);
                const jobs: Array<{ brief: BriefData; fmt: typeof IMAGE_FORMATS[number] }> = [];
                for (const briefId of pickedBriefs) {
                  const brief = allBriefs.find(b => b.id === briefId);
                  if (!brief?.ai_generation_prompt) continue;
                  for (const fmt of IMAGE_FORMATS) {
                    const key = `${brief.id}_${fmt.label}`;
                    if ((generatedImages[key]?.length > 0) || generatingIds.has(key)) continue;
                    jobs.push({ brief, fmt });
                  }
                }
                // Cap concurrent fal.ai calls at 6 — higher trips Vercel's
                // concurrency wall and half come back 5xx. With 6 in flight,
                // 72 images finish in ~12 batches instead of 72 sequential waits.
                await mapWithConcurrency(jobs, 6, ({ brief, fmt }) => generateImage(brief, fmt));
              }}
              disabled={generatingIds.size > 0}
              className="w-full py-2 text-xs font-semibold bg-accent-orange text-white rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
            >
              {generatingIds.size > 0 ? `Generating... (${generatingIds.size})` : 'Generate All Picked'}
            </button>
          </div>
        )}
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex-1 overflow-y-auto">
        {/* Preset header */}
        <div className="px-6 py-4 border-b border-border bg-bg-card/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-text-primary">{meta.name}</h2>
              <p className="text-xs text-text-muted">{currentBriefs.length} briefs generated</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                viewMode === 'grid' ? 'bg-accent-teal text-white' : 'bg-bg-card border border-border text-text-secondary'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('detail')}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                viewMode === 'detail' ? 'bg-accent-teal text-white' : 'bg-bg-card border border-border text-text-secondary'
              }`}
            >
              Detail
            </button>
          </div>
        </div>

        {/* Grid view — brief cards */}
        {viewMode === 'grid' && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {currentBriefs.map(brief => {
              const headlines = getHeadlineEntries(brief);
              const selectedKey = headlineSelections[brief.id] || brief.recommended_headline || headlines[0]?.key || '';
              const selectedHeadline = headlines.find(h => h.key === selectedKey);
              const isPicked = pickedBriefs.includes(brief.id);

              return (
                <div
                  key={brief.id}
                  className={`bg-bg-card border rounded-xl overflow-hidden transition-all cursor-pointer ${
                    isPicked ? 'border-yellow-400 shadow-lg shadow-yellow-400/10' : 'border-border hover:border-accent-teal/50'
                  }`}
                >
                  {/* Brief header */}
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{brief.name || brief.id}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{brief.emotional_intent}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <SendToVaultButton
                        project={project}
                        sourceGateId="gate8"
                        draft={{
                          imageUrl: (generatedImages[`${brief.id}-feed`] || generatedImages[`${brief.id}-story`] || [])[0],
                          hook: selectedHeadline?.text,
                          headline: selectedHeadline?.text,
                          cta: brief.cta_text,
                          format: 'static',
                          angle: brief.emotional_intent,
                          niche: project?.niche,
                          awarenessLevel: project?.selectedFunnel,
                        }}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBriefPick(brief.id); }}
                        className={`text-lg transition-transform hover:scale-110 ${isPicked ? 'text-yellow-400' : 'text-text-muted'}`}
                      >
                        {isPicked ? '★' : '☆'}
                      </button>
                    </div>
                  </div>

                  {/* Color palette preview */}
                  {brief.visual_direction?.color_palette && (
                    <div className="flex h-2">
                      {brief.visual_direction.color_palette.slice(0, 5).map((color, i) => (
                        <div
                          key={i}
                          className="flex-1"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Headline selector A/B/C */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Headline</p>
                    <div className="space-y-1.5">
                      {headlines.map(h => (
                        <button
                          key={h.key}
                          onClick={(e) => { e.stopPropagation(); setHeadlineSelection(brief.id, h.key); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                            selectedKey === h.key
                              ? 'bg-accent-teal/15 border border-accent-teal/40 text-text-primary'
                              : 'bg-bg-primary border border-border text-text-secondary hover:border-accent-teal/30'
                          }`}
                        >
                          <span className={`font-bold w-4 ${selectedKey === h.key ? 'text-accent-teal' : 'text-text-muted'}`}>
                            {h.key}
                          </span>
                          <span className="flex-1 truncate">{h.text}</span>
                          {h.score > 0 && (
                            <span className={`text-[10px] font-mono ${
                              h.score >= 24 ? 'text-green-400' : h.score >= 18 ? 'text-yellow-400' : 'text-text-muted'
                            }`}>
                              {h.score}/30
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected headline preview */}
                  {selectedHeadline && (
                    <div className="px-4 pb-3">
                      <div className="bg-bg-primary rounded-lg p-3 border border-border">
                        <p className="text-sm font-bold text-text-primary leading-tight">
                          &ldquo;{selectedHeadline.text}&rdquo;
                        </p>
                        {brief.subheadline && (
                          <p className="text-xs text-text-secondary mt-1">{brief.subheadline}</p>
                        )}
                        {brief.cta_text && (
                          <span className="inline-block mt-2 px-3 py-1 bg-accent-teal/20 text-accent-teal text-xs font-semibold rounded">
                            {brief.cta_text}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Visual direction preview */}
                  {brief.visual_direction && (
                    <div className="px-4 pb-3">
                      <div className="flex items-center gap-2 text-[10px] text-text-muted">
                        {brief.visual_direction.style && (
                          <span className="px-1.5 py-0.5 bg-bg-primary rounded">{brief.visual_direction.style}</span>
                        )}
                        {brief.visual_direction.camera_angle && (
                          <span className="px-1.5 py-0.5 bg-bg-primary rounded">{brief.visual_direction.camera_angle}</span>
                        )}
                        {brief.visual_direction.mood && (
                          <span className="px-1.5 py-0.5 bg-bg-primary rounded">{brief.visual_direction.mood}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Generated image thumbnails */}
                  {IMAGE_FORMATS.some(fmt => (generatedImages[`${brief.id}_${fmt.label}`] || []).length > 0) && (
                    <div className="px-4 pb-3">
                      <div className="flex gap-1.5">
                        {IMAGE_FORMATS.map(fmt => {
                          const imgs = generatedImages[`${brief.id}_${fmt.label}`] || [];
                          if (imgs.length === 0) return null;
                          return (
                            <div key={fmt.label} className="flex-1 rounded-lg overflow-hidden border border-border" style={{ maxHeight: '60px' }}>
                              <img src={imgs[imgs.length - 1]} alt={fmt.label} className="w-full h-full object-cover" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Detail button */}
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => { setSelectedBriefId(brief.id); setViewMode('detail'); }}
                      className="w-full py-2 text-xs text-accent-teal hover:bg-accent-teal/10 rounded-lg border border-accent-teal/30 transition-colors"
                    >
                      View Full Brief
                    </button>
                  </div>

                  {/* Why it works */}
                  {brief.why_it_works && (
                    <div className="px-4 py-2 border-t border-border bg-bg-primary/50">
                      <p className="text-[10px] text-text-muted italic">{brief.why_it_works}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Detail view — single brief expanded */}
        {viewMode === 'detail' && selectedBrief && (
          <div className="p-6 space-y-6">
            {/* Back to grid */}
            <button
              onClick={() => setViewMode('grid')}
              className="text-xs text-accent-teal hover:underline"
            >
              &larr; Back to grid
            </button>

            {/* Brief header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-text-primary">{selectedBrief.name || selectedBrief.id}</h3>
                <p className="text-sm text-text-muted mt-1">{selectedBrief.emotional_intent}</p>
              </div>
              <button
                onClick={() => toggleBriefPick(selectedBrief.id)}
                className={`text-2xl ${pickedBriefs.includes(selectedBrief.id) ? 'text-yellow-400' : 'text-text-muted'}`}
              >
                {pickedBriefs.includes(selectedBrief.id) ? '★' : '☆'}
              </button>
            </div>

            {/* Headline options */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Headlines (pick one)</h4>
              <div className="space-y-2">
                {getHeadlineEntries(selectedBrief).map(h => {
                  const selectedKey = headlineSelections[selectedBrief.id] || selectedBrief.recommended_headline || '';
                  return (
                    <button
                      key={h.key}
                      onClick={() => setHeadlineSelection(selectedBrief.id, h.key)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                        selectedKey === h.key
                          ? 'bg-accent-teal/15 border-2 border-accent-teal text-text-primary'
                          : 'bg-bg-primary border border-border text-text-secondary hover:border-accent-teal/30'
                      }`}
                    >
                      <span className={`font-bold text-lg w-6 ${selectedKey === h.key ? 'text-accent-teal' : 'text-text-muted'}`}>
                        {h.key}
                      </span>
                      <span className="flex-1 text-sm font-medium">{h.text}</span>
                      {h.score > 0 && (
                        <div className="text-right">
                          <span className={`text-sm font-mono font-bold ${
                            h.score >= 24 ? 'text-green-400' : h.score >= 18 ? 'text-yellow-400' : 'text-text-muted'
                          }`}>
                            {h.score}/30
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual direction */}
            {selectedBrief.visual_direction && (
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Visual Direction</h4>

                {/* Color palette */}
                {selectedBrief.visual_direction.color_palette && (
                  <div className="flex gap-2 mb-4">
                    {selectedBrief.visual_direction.color_palette.map((color, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md border border-border" style={{ backgroundColor: color }} />
                        <span className="text-[10px] text-text-muted font-mono">{color}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedBrief.visual_direction.style && (
                    <span className="text-xs px-2 py-1 bg-accent-teal/10 text-accent-teal rounded">
                      {selectedBrief.visual_direction.style}
                    </span>
                  )}
                  {selectedBrief.visual_direction.camera_angle && (
                    <span className="text-xs px-2 py-1 bg-accent-orange/10 text-accent-orange rounded">
                      {selectedBrief.visual_direction.camera_angle}
                    </span>
                  )}
                  {selectedBrief.visual_direction.mood && (
                    <span className="text-xs px-2 py-1 bg-purple-500/10 text-purple-400 rounded">
                      {selectedBrief.visual_direction.mood}
                    </span>
                  )}
                  {selectedBrief.visual_direction.lighting && (
                    <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded">
                      {selectedBrief.visual_direction.lighting}
                    </span>
                  )}
                </div>

                {/* Scene description */}
                {selectedBrief.visual_direction.scene_description && (
                  <div className="mb-3">
                    <p className="text-[10px] text-text-muted uppercase mb-1">Scene</p>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {selectedBrief.visual_direction.scene_description}
                    </p>
                  </div>
                )}

                {/* Composition + focal point */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedBrief.visual_direction.composition && (
                    <div>
                      <p className="text-[10px] text-text-muted uppercase mb-1">Composition</p>
                      <p className="text-xs text-text-secondary">{selectedBrief.visual_direction.composition}</p>
                    </div>
                  )}
                  {selectedBrief.visual_direction.focal_point && (
                    <div>
                      <p className="text-[10px] text-text-muted uppercase mb-1">Focal Point</p>
                      <p className="text-xs text-text-secondary">{selectedBrief.visual_direction.focal_point}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Generation Prompt */}
            {selectedBrief.ai_generation_prompt && (
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">fal.ai Generation Prompt</h4>
                  <div className="flex gap-1.5">
                    {IMAGE_FORMATS.map(fmt => {
                      const key = `${selectedBrief.id}_${fmt.label}`;
                      const isGen = generatingIds.has(key);
                      return (
                        <button
                          key={fmt.label}
                          onClick={() => generateImage(selectedBrief, fmt)}
                          disabled={isGen}
                          className="px-3 py-1.5 text-xs font-semibold bg-accent-orange text-white rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
                        >
                          {isGen ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                              {fmt.label}...
                            </span>
                          ) : (
                            <span>Generate {fmt.w}x{fmt.h}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <pre className="text-xs text-text-secondary bg-bg-primary p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {selectedBrief.ai_generation_prompt}
                </pre>
                {selectedBrief.negative_prompt && (
                  <div className="mt-3">
                    <p className="text-[10px] text-text-muted uppercase mb-1">Negative Prompt</p>
                    <p className="text-xs text-red-400/70 font-mono">{selectedBrief.negative_prompt}</p>
                  </div>
                )}
              </div>
            )}

            {/* Generated Images */}
            {IMAGE_FORMATS.some(fmt => (generatedImages[`${selectedBrief.id}_${fmt.label}`] || []).length > 0) && (
              <div className="bg-bg-card border border-accent-teal/30 rounded-xl p-5">
                <h4 className="text-xs font-bold text-accent-teal uppercase tracking-wider mb-4">Generated Images</h4>
                <div className="grid grid-cols-3 gap-4">
                  {IMAGE_FORMATS.map(fmt => {
                    const key = `${selectedBrief.id}_${fmt.label}`;
                    const imgs = generatedImages[key] || [];
                    if (imgs.length === 0) return null;
                    return (
                      <div key={fmt.label}>
                        <p className="text-[10px] text-text-muted uppercase mb-2 text-center">{fmt.label} ({fmt.w}x{fmt.h})</p>
                        {imgs.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block mb-2 rounded-lg overflow-hidden border border-border hover:border-accent-teal transition-colors">
                            <img src={url} alt={`${selectedBrief.name} ${fmt.label}`} className="w-full h-auto" />
                          </a>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Layout specs */}
            {selectedBrief.layout && (
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Layout Specs</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selectedBrief.layout.headline_position && (
                    <div className="bg-bg-primary rounded-lg p-2.5">
                      <p className="text-[10px] text-text-muted">Position</p>
                      <p className="text-xs text-text-primary font-medium">{selectedBrief.layout.headline_position}</p>
                    </div>
                  )}
                  {selectedBrief.layout.text_alignment && (
                    <div className="bg-bg-primary rounded-lg p-2.5">
                      <p className="text-[10px] text-text-muted">Alignment</p>
                      <p className="text-xs text-text-primary font-medium">{selectedBrief.layout.text_alignment}</p>
                    </div>
                  )}
                  {selectedBrief.layout.text_background && (
                    <div className="bg-bg-primary rounded-lg p-2.5">
                      <p className="text-[10px] text-text-muted">Background</p>
                      <p className="text-xs text-text-primary font-medium">{selectedBrief.layout.text_background}</p>
                    </div>
                  )}
                  {selectedBrief.layout.max_text_coverage_pct != null && (
                    <div className="bg-bg-primary rounded-lg p-2.5">
                      <p className="text-[10px] text-text-muted">Max text %</p>
                      <p className="text-xs text-text-primary font-medium">{selectedBrief.layout.max_text_coverage_pct}%</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Why it works + awareness fit */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedBrief.why_it_works && (
                <div className="bg-bg-card border border-border rounded-xl p-4">
                  <p className="text-[10px] text-text-muted uppercase mb-1">Why It Works</p>
                  <p className="text-sm text-text-secondary">{selectedBrief.why_it_works}</p>
                </div>
              )}
              {selectedBrief.awareness_fit && (
                <div className="bg-bg-card border border-border rounded-xl p-4">
                  <p className="text-[10px] text-text-muted uppercase mb-1">Awareness Fit</p>
                  <p className="text-sm text-text-secondary">{selectedBrief.awareness_fit}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detail view — no brief selected */}
        {viewMode === 'detail' && !selectedBrief && (
          <div className="p-6 text-center text-text-muted">
            <p>Select a brief from the grid to view details.</p>
            <button
              onClick={() => setViewMode('grid')}
              className="mt-3 text-sm text-accent-teal hover:underline"
            >
              &larr; Back to grid
            </button>
          </div>
        )}

        {/* Creative Director Notes */}
        {directorNotes && viewMode === 'grid' && (
          <div className="px-6 pb-6">
            <div className="bg-bg-card border border-accent-orange/30 rounded-xl p-5">
              <h4 className="text-xs font-bold text-accent-orange uppercase tracking-wider mb-3">
                Creative Director Notes
              </h4>
              <div className="space-y-2">
                {Object.entries(directorNotes).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-[10px] text-text-muted uppercase">{key.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-text-secondary">
                      {Array.isArray(val) ? val.join(', ') : String(val)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
