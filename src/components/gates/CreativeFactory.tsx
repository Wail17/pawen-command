'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  extractAllHeadlines,
  buildFactoryCombos,
  comboCountEstimate,
  type FactoryHeadline,
  type FactoryCombo,
} from '@/lib/gates/creativeFactory';
import { parseStudioConcepts, type StudioConcept } from '@/lib/gates/creaStudioParser';
import { buildCreaStudioPrompt, type CreaStyle } from '@/lib/prompts/creaStudio';
import { getAllGateOutputs } from '@/lib/store/db';
import type { Project, GateOutput } from '@/lib/types';
import SendToVaultButton from '@/components/swipeVault/SendToVaultButton';
import { mapWithConcurrency } from '@/lib/util/pLimit';

const PRESET_IDS = [
  'before_after', 'feature_highlight', 'lifestyle_context', 'problem_agitation',
  'social_proof', 'statistique_data', 'unboxing_product', 'us_vs_them',
] as const;

const PRESET_META: Record<string, { icon: string; name: string }> = {
  before_after: { icon: '🔄', name: 'Before / After' },
  feature_highlight: { icon: '✨', name: 'Feature' },
  lifestyle_context: { icon: '🌿', name: 'Lifestyle' },
  problem_agitation: { icon: '⚡', name: 'Problem' },
  social_proof: { icon: '⭐', name: 'Social Proof' },
  statistique_data: { icon: '📊', name: 'Statistique' },
  unboxing_product: { icon: '📦', name: 'Unboxing' },
  us_vs_them: { icon: '⚔️', name: 'Us vs Them' },
};

const FORMAT_OPTIONS = [
  { id: 'feed_1x1', label: 'Feed 1:1', short: '1:1' },
  { id: 'story_9x16', label: 'Story 9:16', short: '9:16' },
  { id: 'vertical_4x5', label: 'Vertical 4:5', short: '4:5' },
] as const;

const FORMAT_DIMS: Record<string, { w: number; h: number }> = {
  feed_1x1: { w: 1080, h: 1080 },
  story_9x16: { w: 1080, h: 1920 },
  vertical_4x5: { w: 1080, h: 1350 },
};

const SOURCE_COLORS: Record<string, string> = {
  zak: 'bg-purple-500/20 text-purple-400',
  evolve: 'bg-accent-orange/20 text-accent-orange',
  brief_option: 'bg-accent-teal/20 text-accent-teal',
  gate4_hook: 'bg-pink-500/20 text-pink-400',
  gate6: 'bg-sky-500/20 text-sky-400',
};

const SOURCE_LABELS: Record<string, string> = {
  zak: 'ZAK',
  evolve: 'EVOLVE',
  brief_option: 'Brief',
  gate4_hook: 'Hook G4',
  gate6: 'Copy G6',
};

interface Props {
  gate7Data: Record<string, unknown>;
  gate4Data?: Record<string, unknown>;
  gate6Data?: Record<string, unknown>;
  humanDecisions: Record<string, unknown>;
  onDecisionsChange: (decisions: Record<string, unknown>) => void;
  project?: Project;
}

export default function CreativeFactory({
  gate7Data,
  gate4Data,
  gate6Data,
  humanDecisions,
  onDecisionsChange,
  project,
}: Props) {
  // ---- Headline extraction ----
  const allHeadlines = useMemo(
    () => extractAllHeadlines(gate7Data, gate4Data, gate6Data),
    [gate7Data, gate4Data, gate6Data],
  );

  // ---- Selection state ----
  const [selectedHeadlineIdxs, setSelectedHeadlineIdxs] = useState<Set<number>>(
    () => new Set(allHeadlines.map((_, i) => i)),
  );
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(
    () => new Set(PRESET_IDS),
  );
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(
    () => new Set(['feed_1x1']),
  );
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [headlineSearch, setHeadlineSearch] = useState('');

  // ---- Generation state ----
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generationProgress, setGenerationProgress] = useState({ done: 0, total: 0 });
  const abortRef = useRef(false);
  const factoryImages = (humanDecisions?.factoryImages ?? {}) as Record<string, string[]>;
  const factoryPicked = (humanDecisions?.factoryPicked ?? []) as string[];

  // ---- Studio Waves state (ZAK / EVOLVE concepts with their own image prompts) ----
  const studioConcepts = (humanDecisions?.factoryStudioConcepts ?? []) as StudioConcept[];
  const studioImages = (humanDecisions?.factoryStudioImages ?? {}) as Record<string, string[]>;
  const headlineChoices = (humanDecisions?.factoryHeadlineChoice ?? {}) as Record<string, string>;
  const [runningWave, setRunningWave] = useState<CreaStyle | null>(null);
  const [waveError, setWaveError] = useState<string | null>(null);
  const [generatingConceptIds, setGeneratingConceptIds] = useState<Set<string>>(new Set());
  const [studioFormats, setStudioFormats] = useState<Set<string>>(() => new Set(['feed_1x1']));

  // ---- Filtered headlines ----
  const filteredHeadlines = useMemo(() => {
    return allHeadlines.map((h, i) => ({ ...h, idx: i })).filter(h => {
      if (filterSource && h.source !== filterSource) return false;
      if (headlineSearch && !h.text.toLowerCase().includes(headlineSearch.toLowerCase())) return false;
      return true;
    });
  }, [allHeadlines, filterSource, headlineSearch]);

  // ---- Combos ----
  const selectedHL = useMemo(
    () => allHeadlines.filter((_, i) => selectedHeadlineIdxs.has(i)),
    [allHeadlines, selectedHeadlineIdxs],
  );
  const estimate = comboCountEstimate(
    selectedHL.length,
    selectedPresets.size,
    selectedFormats.size,
  );

  const combos = useMemo(
    () => buildFactoryCombos(
      selectedHL,
      Array.from(selectedPresets),
      Array.from(selectedFormats),
      gate7Data,
    ),
    [selectedHL, selectedPresets, selectedFormats, gate7Data],
  );

  // ---- Toggle helpers ----
  const toggleHeadline = useCallback((idx: number) => {
    setSelectedHeadlineIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const toggleAllHeadlines = useCallback((filtered: Array<{ idx: number }>) => {
    const allSelected = filtered.every(h => selectedHeadlineIdxs.has(h.idx));
    if (allSelected) {
      setSelectedHeadlineIdxs(prev => {
        const next = new Set(prev);
        for (const h of filtered) next.delete(h.idx);
        return next;
      });
    } else {
      setSelectedHeadlineIdxs(prev => {
        const next = new Set(prev);
        for (const h of filtered) next.add(h.idx);
        return next;
      });
    }
  }, [selectedHeadlineIdxs]);

  const togglePreset = useCallback((id: string) => {
    setSelectedPresets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleFormat = useCallback((id: string) => {
    setSelectedFormats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleFactoryPick = useCallback((comboId: string) => {
    const next = factoryPicked.includes(comboId)
      ? factoryPicked.filter(id => id !== comboId)
      : [...factoryPicked, comboId];
    onDecisionsChange({ ...humanDecisions, factoryPicked: next });
  }, [factoryPicked, humanDecisions, onDecisionsChange]);

  // ---- Image generation ----
  const generateOne = useCallback(async (combo: FactoryCombo): Promise<string | null> => {
    try {
      const res = await fetch('/api/imagegen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nano-banana-pro',
          prompt: combo.prompt,
          negativePrompt: combo.negativePrompt,
          width: combo.width,
          height: combo.height,
          numImages: 1,
        }),
      });
      if (!res.ok) return null;
      const result = await res.json();
      const urls = (result.images || []).map((img: { url: string }) => img.url);
      return urls[0] ?? null;
    } catch {
      return null;
    }
  }, []);

  // ---- Studio wave: run ZAK or EVOLVE prompt, parse concepts, append to humanDecisions ----
  const runWave = useCallback(async (style: CreaStyle) => {
    if (!project) {
      setWaveError('Project not loaded — cannot run wave');
      return;
    }
    setRunningWave(style);
    setWaveError(null);
    try {
      const allOutputs = await getAllGateOutputs(project.id);
      const previousOutputs: Record<string, unknown> = {};
      for (const o of allOutputs) {
        if (o && typeof o === 'object' && 'gateId' in o && 'data' in o) {
          const go = o as GateOutput;
          previousOutputs[go.gateId] = go.data;
        }
      }
      const { systemPrompt, userMessage, model, maxTokens } = buildCreaStudioPrompt(style, project, previousOutputs);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, systemPrompt, userMessage, maxTokens, temperature: 0.8, stream: false }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data = await res.json();
      const markdown: string = data.text ?? data.content ?? data.output ?? '';
      const parsedStyle: 'zak' | 'evolve' = style === 'niche_dr' ? 'zak' : 'evolve';
      const concepts = parseStudioConcepts(markdown, parsedStyle);
      if (concepts.length === 0) {
        setWaveError(`${parsedStyle.toUpperCase()} wave: no concepts parsed from output. Check that the JSON block was returned.`);
        return;
      }
      const next = [...studioConcepts, ...concepts];
      onDecisionsChange({ ...humanDecisions, factoryStudioConcepts: next });
    } catch (e) {
      setWaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunningWave(null);
    }
  }, [project, studioConcepts, humanDecisions, onDecisionsChange]);

  const deleteConcept = useCallback((conceptId: string) => {
    const next = studioConcepts.filter(c => c.id !== conceptId);
    const nextImages = { ...studioImages };
    delete nextImages[conceptId];
    const nextChoices = { ...headlineChoices };
    delete nextChoices[conceptId];
    onDecisionsChange({
      ...humanDecisions,
      factoryStudioConcepts: next,
      factoryStudioImages: nextImages,
      factoryHeadlineChoice: nextChoices,
    });
  }, [studioConcepts, studioImages, headlineChoices, humanDecisions, onDecisionsChange]);

  const pickHeadline = useCallback((conceptId: string, headline: string) => {
    onDecisionsChange({
      ...humanDecisions,
      factoryHeadlineChoice: { ...headlineChoices, [conceptId]: headline },
    });
  }, [humanDecisions, headlineChoices, onDecisionsChange]);

  const toggleStudioFormat = useCallback((id: string) => {
    setStudioFormats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) next.add(id);
      return next;
    });
  }, []);

  const generateStudioImage = useCallback(async (concept: StudioConcept, formatId: string): Promise<string | null> => {
    const dims = FORMAT_DIMS[formatId];
    if (!dims) return null;
    try {
      const res = await fetch('/api/imagegen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nano-banana-pro',
          prompt: concept.imagePrompt,
          negativePrompt: 'text overlay, watermark, logo, blurry, deformed, low quality, amateur',
          width: dims.w,
          height: dims.h,
          numImages: 1,
        }),
      });
      if (!res.ok) return null;
      const result = await res.json();
      const urls = (result.images || []).map((img: { url: string }) => img.url);
      return urls[0] ?? null;
    } catch {
      return null;
    }
  }, []);

  const generateForConcept = useCallback(async (concept: StudioConcept) => {
    setGeneratingConceptIds(prev => new Set([...prev, concept.id]));
    const fmts = Array.from(studioFormats);
    const urls: string[] = [];
    for (const fmt of fmts) {
      const url = await generateStudioImage(concept, fmt);
      if (url) urls.push(url);
    }
    if (urls.length > 0) {
      const prev = studioImages[concept.id] ?? [];
      const next = { ...studioImages, [concept.id]: [...urls, ...prev] };
      onDecisionsChange({ ...humanDecisions, factoryStudioImages: next });
    }
    setGeneratingConceptIds(prev => {
      const n = new Set(prev);
      n.delete(concept.id);
      return n;
    });
  }, [studioFormats, studioImages, humanDecisions, onDecisionsChange, generateStudioImage]);

  const generateAllConcepts = useCallback(async () => {
    const pending = studioConcepts.filter(c => !(studioImages[c.id]?.length > 0));
    // Cap at 4 concurrent — generateForConcept itself generates N formats per
    // concept, so 4 concepts × ~2 formats = 8 simultaneous fal.ai calls max.
    await mapWithConcurrency(pending, 4, (c) => generateForConcept(c));
  }, [studioConcepts, studioImages, generateForConcept]);

  const launchFactory = useCallback(async () => {
    abortRef.current = false;
    const toGenerate = combos.filter(c => !(factoryImages[c.id]?.length > 0));
    setGenerationProgress({ done: 0, total: toGenerate.length });
    const batchSize = 3;
    let done = 0;

    for (let i = 0; i < toGenerate.length; i += batchSize) {
      if (abortRef.current) break;
      const batch = toGenerate.slice(i, i + batchSize);
      setGeneratingIds(prev => {
        const next = new Set(prev);
        for (const c of batch) next.add(c.id);
        return next;
      });

      const results = await Promise.all(batch.map(async c => {
        const url = await generateOne(c);
        return { id: c.id, url };
      }));

      const nextImages = { ...factoryImages };
      for (const r of results) {
        if (r.url) nextImages[r.id] = [r.url];
      }
      onDecisionsChange({ ...humanDecisions, factoryImages: nextImages });

      done += batch.length;
      setGenerationProgress({ done, total: toGenerate.length });
      setGeneratingIds(prev => {
        const next = new Set(prev);
        for (const c of batch) next.delete(c.id);
        return next;
      });
    }
    setGenerationProgress({ done: 0, total: 0 });
  }, [combos, factoryImages, humanDecisions, onDecisionsChange, generateOne]);

  const stopFactory = useCallback(() => {
    abortRef.current = true;
  }, []);

  const isRunning = generationProgress.total > 0;
  const generatedCount = combos.filter(c => (factoryImages[c.id]?.length ?? 0) > 0).length;

  // ---- Source stats ----
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of allHeadlines) counts[h.source] = (counts[h.source] ?? 0) + 1;
    return counts;
  }, [allHeadlines]);

  return (
    <div className="flex gap-0 h-full min-h-[600px]">
      {/* ============ LEFT PANEL — Configuration ============ */}
      <div className="w-80 min-w-[320px] border-r border-border bg-bg-card overflow-y-auto">
        {/* Stats bar */}
        <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-accent-orange/10 to-purple-500/10">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏭</span>
            <div>
              <p className="text-sm font-bold text-text-primary">Usine a Crea</p>
              <p className="text-[10px] text-text-muted">
                {allHeadlines.length} headlines &middot; {estimate} combos
              </p>
            </div>
          </div>
        </div>

        {/* ============ CREATIVE WAVES ============ */}
        <div className="px-4 py-3 border-b border-border bg-gradient-to-b from-purple-500/5 to-transparent">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
            🌊 Creative Waves
          </h4>
          <p className="text-[10px] text-text-muted mb-2 leading-snug">
            Chaque wave génère des concepts d&apos;image distincts depuis TES données (avatars, verbatims, mechanism, brand DNA).
          </p>
          <div className="space-y-1.5">
            <button
              onClick={() => runWave('niche_dr')}
              disabled={!project || runningWave !== null}
              className="w-full py-2 text-xs font-semibold bg-purple-500/15 border border-purple-500/40 text-purple-300 rounded-lg hover:bg-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {runningWave === 'niche_dr' ? '⏳ Running ZAK...' : '🎯 Wave ZAK (Niche DR) — +5 concepts'}
            </button>
            <button
              onClick={() => runWave('big_brand')}
              disabled={!project || runningWave !== null}
              className="w-full py-2 text-xs font-semibold bg-accent-teal/15 border border-accent-teal/40 text-accent-teal rounded-lg hover:bg-accent-teal/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {runningWave === 'big_brand' ? '⏳ Running EVOLVE...' : '🎨 Wave EVOLVE (Big Brand) — +9 concepts'}
            </button>
          </div>
          {waveError && (
            <div className="mt-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
              {waveError}
            </div>
          )}
          {studioConcepts.length > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] text-text-muted">
                {studioConcepts.length} concept{studioConcepts.length > 1 ? 's' : ''} stacked
              </p>
              <button
                onClick={generateAllConcepts}
                disabled={generatingConceptIds.size > 0}
                className="text-[10px] px-2 py-1 bg-accent-orange/20 text-accent-orange rounded hover:bg-accent-orange/30 disabled:opacity-40"
              >
                Generate All Images
              </button>
            </div>
          )}
          {/* Studio format selector */}
          <div className="mt-2">
            <p className="text-[10px] text-text-muted mb-1">Formats for Wave images:</p>
            <div className="flex gap-1">
              {FORMAT_OPTIONS.map(fmt => {
                const active = studioFormats.has(fmt.id);
                return (
                  <button
                    key={fmt.id}
                    onClick={() => toggleStudioFormat(fmt.id)}
                    className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${
                      active
                        ? 'bg-accent-orange/20 border border-accent-orange/40 text-accent-orange'
                        : 'bg-bg-primary border border-border text-text-muted'
                    }`}
                  >
                    {fmt.short}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* HEADLINES SECTION */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              Headlines ({selectedHeadlineIdxs.size}/{allHeadlines.length})
            </h4>
            <button
              onClick={() => toggleAllHeadlines(filteredHeadlines)}
              className="text-[10px] text-accent-teal hover:underline"
            >
              {filteredHeadlines.every(h => selectedHeadlineIdxs.has(h.idx)) ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={headlineSearch}
            onChange={e => setHeadlineSearch(e.target.value)}
            placeholder="Search headlines..."
            className="w-full px-3 py-1.5 text-xs bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted mb-2"
          />

          {/* Source filter chips */}
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              onClick={() => setFilterSource(null)}
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                !filterSource ? 'bg-text-primary text-bg-primary' : 'bg-bg-primary text-text-muted border border-border'
              }`}
            >
              All
            </button>
            {Object.entries(sourceCounts).map(([src, count]) => (
              <button
                key={src}
                onClick={() => setFilterSource(filterSource === src ? null : src)}
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  filterSource === src ? SOURCE_COLORS[src] : 'bg-bg-primary text-text-muted border border-border'
                }`}
              >
                {SOURCE_LABELS[src] ?? src} ({count})
              </button>
            ))}
          </div>

          {/* Headline list (scrollable) */}
          <div className="max-h-[300px] overflow-y-auto space-y-0.5 pr-1">
            {filteredHeadlines.map(h => {
              const checked = selectedHeadlineIdxs.has(h.idx);
              return (
                <label
                  key={h.idx}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                    checked ? 'bg-bg-primary' : 'hover:bg-bg-primary/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleHeadline(h.idx)}
                    className="mt-0.5 accent-accent-teal"
                  />
                  <span className={`flex-1 ${checked ? 'text-text-primary' : 'text-text-muted'}`}>
                    {h.text}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${SOURCE_COLORS[h.source]}`}>
                    {SOURCE_LABELS[h.source] ?? h.source}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* PRESETS SECTION */}
        <div className="px-4 py-3 border-b border-border">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
            Presets ({selectedPresets.size}/8)
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_IDS.map(pid => {
              const pm = PRESET_META[pid];
              const active = selectedPresets.has(pid);
              return (
                <button
                  key={pid}
                  onClick={() => togglePreset(pid)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                    active
                      ? 'bg-accent-teal/15 border border-accent-teal/40 text-text-primary'
                      : 'bg-bg-primary border border-border text-text-muted'
                  }`}
                >
                  <span>{pm.icon}</span>
                  <span className="truncate">{pm.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* FORMATS SECTION */}
        <div className="px-4 py-3 border-b border-border">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
            Formats
          </h4>
          <div className="flex gap-2">
            {FORMAT_OPTIONS.map(fmt => {
              const active = selectedFormats.has(fmt.id);
              return (
                <button
                  key={fmt.id}
                  onClick={() => toggleFormat(fmt.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-accent-orange/15 border border-accent-orange/40 text-accent-orange'
                      : 'bg-bg-primary border border-border text-text-muted'
                  }`}
                >
                  {fmt.short}
                </button>
              );
            })}
          </div>
        </div>

        {/* LAUNCH SECTION */}
        <div className="px-4 py-4">
          <div className="text-center mb-3">
            <p className="text-2xl font-black text-text-primary">{estimate}</p>
            <p className="text-[10px] text-text-muted uppercase">creatives a generer</p>
            {generatedCount > 0 && (
              <p className="text-[10px] text-green-400 mt-1">{generatedCount} deja generes</p>
            )}
          </div>

          {isRunning ? (
            <div className="space-y-2">
              <div className="w-full bg-bg-primary rounded-full h-2">
                <div
                  className="bg-accent-orange h-2 rounded-full transition-all"
                  style={{ width: `${(generationProgress.done / generationProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-text-muted text-center">
                {generationProgress.done}/{generationProgress.total}
              </p>
              <button
                onClick={stopFactory}
                className="w-full py-2.5 text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Stop
              </button>
            </div>
          ) : (
            <button
              onClick={launchFactory}
              disabled={estimate === 0}
              className="w-full py-3 text-sm font-bold bg-gradient-to-r from-accent-orange to-purple-500 text-white rounded-xl hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              🏭 Lancer l&apos;Usine ({estimate})
            </button>
          )}

          {factoryPicked.length > 0 && (
            <p className="text-xs text-yellow-400 text-center mt-2">
              ★ {factoryPicked.length} picked
            </p>
          )}
        </div>
      </div>

      {/* ============ MAIN CONTENT — Results Grid ============ */}
      <div className="flex-1 overflow-y-auto">
        {/* ============ STUDIO CONCEPTS (ZAK / EVOLVE waves) ============ */}
        {studioConcepts.length > 0 && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">🌊 Studio Concepts ({studioConcepts.length})</h3>
                <p className="text-[10px] text-text-muted">Unique image ideas from ZAK / EVOLVE — each with its own visual prompt</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {studioConcepts.map(concept => {
                const imgs = studioImages[concept.id] ?? [];
                const isGen = generatingConceptIds.has(concept.id);
                const chosenHeadline = headlineChoices[concept.id] ?? concept.headline;
                const headlineOptions = [concept.headline, ...concept.variations];
                const isPicked = factoryPicked.includes(concept.id);
                const activeChipClass = concept.style === 'zak'
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                  : 'bg-accent-teal/20 border-accent-teal/50 text-accent-teal';
                return (
                  <div
                    key={concept.id}
                    className={`bg-bg-card border rounded-xl overflow-hidden transition-all ${
                      isPicked ? 'border-yellow-400 shadow-md shadow-yellow-400/10' : 'border-border hover:border-accent-teal/40'
                    }`}
                  >
                    {/* Image */}
                    <div className="relative bg-bg-primary aspect-square">
                      {imgs.length > 0 ? (
                        <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                      ) : isGen ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-accent-orange border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-4 text-center">
                          <span className="text-[10px] text-text-muted line-clamp-6">{concept.imagePrompt}</span>
                        </div>
                      )}
                      {/* Pick */}
                      <button
                        onClick={() => toggleFactoryPick(concept.id)}
                        className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center ${
                          isPicked ? 'bg-yellow-400 text-black' : 'bg-black/40 text-white/60 hover:text-white'
                        }`}
                      >
                        {isPicked ? '★' : '☆'}
                      </button>
                      {/* Style badge */}
                      <span className={`absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        concept.style === 'zak' ? 'bg-purple-500 text-white' : 'bg-accent-teal text-black'
                      }`}>
                        {concept.style.toUpperCase()}
                      </span>
                      {/* Vault + Delete */}
                      <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                        <SendToVaultButton
                          project={project}
                          sourceGateId="gate8"
                          draft={{
                            imageUrl: imgs[0],
                            hook: chosenHeadline,
                            headline: chosenHeadline,
                            format: 'static',
                            angle: concept.psychAngle,
                            niche: project?.niche,
                            awarenessLevel: project?.selectedFunnel,
                          }}
                          className="w-6 h-6 rounded-full bg-black/40 text-white/70 hover:bg-accent-orange hover:text-bg-primary text-xs flex items-center justify-center"
                          label="🗃️"
                        />
                        <button
                          onClick={() => deleteConcept(concept.id)}
                          className="w-6 h-6 rounded-full bg-black/40 text-white/60 hover:bg-red-500 hover:text-white text-xs"
                          title="Delete concept"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Palette */}
                    {concept.palette && concept.palette.length > 0 && (
                      <div className="flex h-1">
                        {concept.palette.slice(0, 5).map((c, i) => (
                          <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    )}

                    {/* Headline + picker */}
                    <div className="p-3">
                      <p className="text-xs font-semibold text-text-primary mb-2 leading-tight">
                        {chosenHeadline}
                      </p>
                      {concept.psychAngle && (
                        <p className="text-[10px] text-text-muted italic mb-2">{concept.psychAngle}</p>
                      )}
                      {headlineOptions.length > 1 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {headlineOptions.map((h, i) => {
                            const active = h === chosenHeadline;
                            return (
                              <button
                                key={i}
                                onClick={() => pickHeadline(concept.id, h)}
                                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                  active
                                    ? activeChipClass
                                    : 'bg-bg-primary border-border text-text-muted hover:text-text-primary'
                                }`}
                                title={h}
                              >
                                {i === 0 ? 'Main' : `V${i}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button
                        onClick={() => generateForConcept(concept)}
                        disabled={isGen}
                        className={`w-full py-1.5 text-[11px] rounded-lg transition-colors ${
                          imgs.length === 0
                            ? 'text-accent-teal border border-accent-teal/30 hover:bg-accent-teal/10'
                            : 'text-accent-orange border border-accent-orange/30 hover:bg-accent-orange/10'
                        } disabled:opacity-40`}
                      >
                        {isGen ? 'Generating...' : imgs.length === 0 ? `Generate (${studioFormats.size} fmt)` : `Re-gen (${imgs.length})`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {combos.length === 0 && studioConcepts.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted text-sm px-6 text-center">
            Lance une Wave ZAK ou EVOLVE pour générer des concepts, ou sélectionne headlines+presets+formats ci-contre pour voir les combinaisons classiques.
          </div>
        )}
        {combos.length > 0 && (
          <div className="p-4">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-text-muted">
                {combos.length} combos &middot; {generatedCount} generated &middot; {factoryPicked.length} picked
              </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {combos.map(combo => {
                const imgs = factoryImages[combo.id] ?? [];
                const isPicked = factoryPicked.includes(combo.id);
                const isGenerating = generatingIds.has(combo.id);

                return (
                  <div
                    key={combo.id}
                    className={`bg-bg-card border rounded-xl overflow-hidden transition-all ${
                      isPicked ? 'border-yellow-400 shadow-md shadow-yellow-400/10' : 'border-border hover:border-accent-teal/40'
                    }`}
                  >
                    {/* Image area */}
                    <div
                      className="relative bg-bg-primary"
                      style={{ aspectRatio: `${combo.width}/${combo.height}` }}
                    >
                      {imgs.length > 0 ? (
                        <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                      ) : isGenerating ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-accent-orange border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl opacity-20">{combo.presetIcon}</span>
                        </div>
                      )}

                      {/* Pick button overlay */}
                      <button
                        onClick={() => toggleFactoryPick(combo.id)}
                        className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isPicked
                            ? 'bg-yellow-400 text-black'
                            : 'bg-black/40 text-white/60 hover:text-white'
                        }`}
                      >
                        {isPicked ? '★' : '☆'}
                      </button>

                      {/* Preset badge */}
                      <span className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 bg-black/60 text-white rounded">
                        {combo.presetIcon} {combo.presetName}
                      </span>

                      {/* Format badge */}
                      <span className="absolute bottom-1.5 right-1.5 text-[10px] px-1.5 py-0.5 bg-black/60 text-white/70 rounded font-mono">
                        {combo.format.replace('_', ' ').replace(/\d+x\d+/, '')}
                      </span>
                    </div>

                    {/* Color palette strip */}
                    {combo.colorPalette.length > 0 && (
                      <div className="flex h-1">
                        {combo.colorPalette.slice(0, 5).map((c, i) => (
                          <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    )}

                    {/* Headline text */}
                    <div className="px-2.5 py-2">
                      <p className="text-xs text-text-primary leading-tight line-clamp-2 font-medium">
                        {combo.headline}
                      </p>
                      <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full ${SOURCE_COLORS[combo.headlineSource]}`}>
                        {SOURCE_LABELS[combo.headlineSource]}
                      </span>
                    </div>

                    {/* Generate / Re-generate button */}
                    {!isGenerating && !isRunning && (
                      <div className="px-2.5 pb-2 flex gap-1.5">
                        <button
                          onClick={async () => {
                            setGeneratingIds(prev => new Set([...prev, combo.id]));
                            const url = await generateOne(combo);
                            if (url) {
                              const prev = factoryImages[combo.id] ?? [];
                              const next = { ...factoryImages, [combo.id]: [url, ...prev] };
                              onDecisionsChange({ ...humanDecisions, factoryImages: next });
                            }
                            setGeneratingIds(prev => {
                              const n = new Set(prev);
                              n.delete(combo.id);
                              return n;
                            });
                          }}
                          className={`flex-1 py-1.5 text-[10px] rounded-lg transition-colors ${
                            imgs.length === 0
                              ? 'text-accent-teal border border-accent-teal/30 hover:bg-accent-teal/10'
                              : 'text-accent-orange border border-accent-orange/30 hover:bg-accent-orange/10'
                          }`}
                        >
                          {imgs.length === 0 ? 'Generate' : `Re-gen (${imgs.length})`}
                        </button>
                      </div>
                    )}

                    {/* Image iterations carousel */}
                    {imgs.length > 1 && (
                      <div className="px-2.5 pb-2 flex gap-1 overflow-x-auto">
                        {imgs.map((url, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const reordered = [url, ...imgs.filter((_, j) => j !== i)];
                              const next = { ...factoryImages, [combo.id]: reordered };
                              onDecisionsChange({ ...humanDecisions, factoryImages: next });
                            }}
                            className={`shrink-0 w-8 h-8 rounded border overflow-hidden ${
                              i === 0 ? 'border-accent-orange' : 'border-border opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
