'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  extractAllHeadlines,
  buildFactoryCombos,
  comboCountEstimate,
  type FactoryHeadline,
  type FactoryCombo,
} from '@/lib/gates/creativeFactory';

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
}

export default function CreativeFactory({
  gate7Data,
  gate4Data,
  gate6Data,
  humanDecisions,
  onDecisionsChange,
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
          model: 'flux-2-pro',
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
        {combos.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Select headlines, presets and formats to see combinations
          </div>
        ) : (
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

                    {/* Generate single button (if no image yet) */}
                    {imgs.length === 0 && !isGenerating && !isRunning && (
                      <div className="px-2.5 pb-2">
                        <button
                          onClick={async () => {
                            setGeneratingIds(prev => new Set([...prev, combo.id]));
                            const url = await generateOne(combo);
                            if (url) {
                              const next = { ...factoryImages, [combo.id]: [url] };
                              onDecisionsChange({ ...humanDecisions, factoryImages: next });
                            }
                            setGeneratingIds(prev => {
                              const n = new Set(prev);
                              n.delete(combo.id);
                              return n;
                            });
                          }}
                          className="w-full py-1.5 text-[10px] text-accent-teal border border-accent-teal/30 rounded-lg hover:bg-accent-teal/10 transition-colors"
                        >
                          Generate
                        </button>
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
