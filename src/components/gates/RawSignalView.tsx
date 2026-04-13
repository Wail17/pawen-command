'use client';

// ============================================================
// PAWEN — Raw Signal view (Gate 1)
// Shows the preserved verbatim corpus + n-gram frequency tables
// + emotion markers, with pickable ★ golden nuggets. This is the
// "the raw data is safe" panel — nothing here is LLM-processed.
// ============================================================

import { useMemo, useState, useCallback } from 'react';
import type { RawSignal, SourceType, RawSignalItem } from '@/lib/avatars/types';
import { togglePick, isPicked } from '@/lib/avatars/rawSignal';

interface RawSignalViewProps {
  signal: RawSignal;
  onChange: (next: RawSignal) => void;
}

type Tab = 'scored' | 'phrases' | 'golden' | 'identity' | 'buying' | 'trigrams' | 'bigrams' | 'unigrams' | 'emotion' | 'verbatims';

const SOURCE_LABELS: Record<SourceType, string> = {
  reddit: 'Reddit',
  amazon: 'Amazon',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  quora: 'Quora',
  forums: 'Forums',
  reviews: 'Reviews',
  searchWide: 'Web',
  shopify: 'Shopify',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

const EMOTION_COLORS: Record<string, string> = {
  fear: 'text-red-400 border-red-500/40 bg-red-500/10',
  frustration: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
  hope: 'text-green-400 border-green-500/40 bg-green-500/10',
  desperation: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
  shame: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  exhaustion: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  urgency: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  skepticism: 'text-gray-400 border-gray-500/40 bg-gray-500/10',
  desire: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  guilt: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
  isolation: 'text-slate-400 border-slate-500/40 bg-slate-500/10',
  anger: 'text-red-500 border-red-600/40 bg-red-600/10',
  envy: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  pride: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  helplessness: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
};

export default function RawSignalView({ signal, onChange }: RawSignalViewProps) {
  const [tab, setTab] = useState<Tab>(signal.scored_phrases?.length ? 'scored' : 'phrases');
  const [filterSource, setFilterSource] = useState<SourceType | 'all'>('all');
  const [search, setSearch] = useState('');

  const pickCount = useMemo(
    () =>
      (signal.picks?.phrases.length ?? 0) +
      (signal.picks?.verbatims.length ?? 0) +
      (signal.picks?.emotion_markers.length ?? 0),
    [signal.picks],
  );

  const handlePick = useCallback(
    (category: 'phrases' | 'verbatims' | 'emotion_markers', value: string) => {
      const nextPicks = togglePick(signal.picks, category, value);
      onChange({ ...signal, picks: nextPicks });
    },
    [signal, onChange],
  );

  const filteredVerbatims = useMemo(() => {
    let list = signal.items;
    if (filterSource !== 'all') {
      list = list.filter((v) => v.source_type === filterSource);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => v.text.toLowerCase().includes(q));
    }
    return list.slice(0, 200); // cap the render
  }, [signal.items, filterSource, search]);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <StatCard label="Items" value={signal.total_items.toLocaleString()} />
        <StatCard label="Sources" value={Object.keys(signal.source_breakdown).length} />
        <StatCard label="Emotions" value={signal.emotion_markers.length} />
        <StatCard label="Identity" value={signal.identity_markers?.length ?? 0} />
        <StatCard label="Golden" value={signal.golden_sentences?.length ?? 0} highlight={(signal.golden_sentences?.length ?? 0) > 0} />
        <StatCard label="★ Picked" value={pickCount} highlight={pickCount > 0} />
      </div>

      {/* Source breakdown */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(signal.source_breakdown).map(([source, count]) => (
          <span
            key={source}
            className="text-[10px] px-2 py-0.5 bg-bg-card border border-border rounded text-text-secondary"
          >
            {SOURCE_LABELS[source as SourceType] ?? source}: <span className="text-text-primary font-semibold">{count}</span>
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {(signal.scored_phrases?.length ?? 0) > 0 && (
          <TabButton active={tab === 'scored'} onClick={() => setTab('scored')}>Scored ({signal.scored_phrases!.length})</TabButton>
        )}
        <TabButton active={tab === 'phrases'}    onClick={() => setTab('phrases')}>    Phrases ({signal.top_phrases.length})   </TabButton>
        {(signal.golden_sentences?.length ?? 0) > 0 && (
          <TabButton active={tab === 'golden'} onClick={() => setTab('golden')}>Golden ({signal.golden_sentences!.length})</TabButton>
        )}
        {(signal.identity_markers?.length ?? 0) > 0 && (
          <TabButton active={tab === 'identity'} onClick={() => setTab('identity')}>Identity ({signal.identity_markers!.length})</TabButton>
        )}
        {(signal.buying_signals?.length ?? 0) > 0 && (
          <TabButton active={tab === 'buying'} onClick={() => setTab('buying')}>Buying ({signal.buying_signals!.length})</TabButton>
        )}
        <TabButton active={tab === 'trigrams'}   onClick={() => setTab('trigrams')}>   Trigrams ({signal.top_trigrams.length})     </TabButton>
        <TabButton active={tab === 'bigrams'}    onClick={() => setTab('bigrams')}>    Bigrams ({signal.top_bigrams.length})       </TabButton>
        <TabButton active={tab === 'unigrams'}   onClick={() => setTab('unigrams')}>   Words ({signal.top_unigrams.length})        </TabButton>
        <TabButton active={tab === 'emotion'}    onClick={() => setTab('emotion')}>    Emotion ({signal.emotion_markers.length})   </TabButton>
        <TabButton active={tab === 'verbatims'}  onClick={() => setTab('verbatims')}>  Verbatims ({signal.items.length})           </TabButton>
      </div>

      {/* Tab content */}

      {/* Scored Phrases — n-grams ranked by marketing value */}
      {tab === 'scored' && signal.scored_phrases && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Scored Phrases (ranked by marketing value 0-100)</h3>
          <p className="text-[11px] text-text-muted">
            Each phrase scored by: frequency + source diversity + emotional charge + identity signal + buying signal.
          </p>
          <div className="space-y-1.5">
            {signal.scored_phrases.map((sp) => {
              const isP = (signal.picks?.phrases ?? []).includes(sp.phrase);
              const heatColor = sp.score >= 70 ? 'bg-red-500/20 border-red-500/50'
                : sp.score >= 50 ? 'bg-orange-500/15 border-orange-500/40'
                : sp.score >= 30 ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-bg-primary border-border';
              return (
                <button
                  key={sp.phrase}
                  type="button"
                  onClick={() => handlePick('phrases', sp.phrase)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-left transition ${
                    isP ? 'bg-accent-orange/10 border-accent-orange/50' : heatColor
                  }`}
                >
                  <span className={`text-sm ${isP ? 'text-accent-orange font-semibold' : 'text-text-secondary'}`}>
                    {isP ? '★ ' : ''}{sp.phrase}
                  </span>
                  <span className="shrink-0 flex items-center gap-2">
                    {sp.tags.map(tag => (
                      <span key={tag} className="text-[9px] px-1 py-0.5 rounded bg-bg-card border border-border text-text-muted">
                        {tag}
                      </span>
                    ))}
                    <span className={`text-xs font-bold ${
                      sp.score >= 70 ? 'text-red-400' : sp.score >= 50 ? 'text-orange-400' : 'text-text-muted'
                    }`}>
                      {sp.score}
                    </span>
                    <span className="text-[10px] text-text-muted">×{sp.count}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Golden Sentences — high emotional charge, heat-mapped */}
      {tab === 'golden' && signal.golden_sentences && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Golden Sentences (by emotional intensity)</h3>
          <p className="text-[11px] text-text-muted">
            Full sentences with the highest emotional charge across the corpus. Color = intensity.
          </p>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {signal.golden_sentences.map((gs, i) => {
              const heat = gs.score >= 80 ? 'border-l-red-500 bg-red-500/5'
                : gs.score >= 60 ? 'border-l-orange-500 bg-orange-500/5'
                : gs.score >= 40 ? 'border-l-yellow-500 bg-yellow-500/5'
                : 'border-l-blue-500 bg-blue-500/5';
              const isP = (signal.picks?.verbatims ?? []).includes(gs.sentence);
              return (
                <div
                  key={`${gs.source_url}-${i}`}
                  className={`p-3 rounded-lg border-l-2 ${isP ? 'border-l-accent-orange bg-accent-orange/5' : heat}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 bg-bg-card rounded border border-border text-text-muted">
                        {SOURCE_LABELS[gs.source_type] ?? gs.source_type}
                      </span>
                      {gs.emotion_tags.map(tag => (
                        <span key={tag} className={`text-[9px] px-1 py-0.5 rounded border ${EMOTION_COLORS[tag] ?? 'text-text-muted border-border'}`}>
                          {tag}
                        </span>
                      ))}
                      <span className={`text-[10px] font-bold ${
                        gs.score >= 80 ? 'text-red-400' : gs.score >= 60 ? 'text-orange-400' : 'text-yellow-400'
                      }`}>
                        {gs.score}/100
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePick('verbatims', gs.sentence)}
                      className={`text-xs shrink-0 ${isP ? 'text-accent-orange' : 'text-text-muted hover:text-accent-orange'}`}
                    >
                      {isP ? '★' : '☆'}
                    </button>
                  </div>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{gs.sentence}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Identity Markers — "I am / I'm not" patterns */}
      {tab === 'identity' && signal.identity_markers && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Identity Markers</h3>
          <p className="text-[11px] text-text-muted">
            How your audience describes themselves. These are ad copy GOLD for targeting — &ldquo;I am / I&apos;m not / people like me&rdquo;.
          </p>
          {(['self_identify', 'anti_identify', 'aspiration', 'tribal'] as const).map(type => {
            const items = signal.identity_markers!.filter(m => m.type === type);
            if (items.length === 0) return null;
            const typeLabel: Record<string, string> = {
              self_identify: 'Self-Identity ("I am...")',
              anti_identify: 'Anti-Identity ("I\'m NOT...")',
              aspiration: 'Aspiration ("I want to be...")',
              tribal: 'Tribal ("People like me...")',
            };
            const typeColor: Record<string, string> = {
              self_identify: 'text-blue-400 border-blue-500/40',
              anti_identify: 'text-red-400 border-red-500/40',
              aspiration: 'text-green-400 border-green-500/40',
              tribal: 'text-purple-400 border-purple-500/40',
            };
            return (
              <div key={type} className="space-y-1.5">
                <h4 className={`text-xs font-bold uppercase px-2 py-0.5 inline-block rounded border ${typeColor[type] ?? ''}`}>
                  {typeLabel[type]} ({items.length})
                </h4>
                <div className="space-y-1">
                  {items.map((m, i) => (
                    <div key={`${m.pattern}-${i}`} className="flex items-center justify-between px-3 py-2 bg-bg-primary border border-border rounded-md">
                      <span className="text-sm text-text-secondary">&ldquo;{m.pattern}&rdquo;</span>
                      <span className="text-[10px] text-text-muted shrink-0">×{m.count} · {m.source_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Buying Signals */}
      {tab === 'buying' && signal.buying_signals && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Buying Signals</h3>
          <p className="text-[11px] text-text-muted">
            Purchase intent, comparison shopping, price sensitivity, recommendation seeking detected in the corpus.
          </p>
          {(['purchase_intent', 'comparison', 'price_sensitivity', 'recommendation_seeking', 'urgency'] as const).map(type => {
            const items = signal.buying_signals!.filter(b => b.type === type);
            if (items.length === 0) return null;
            const typeLabel: Record<string, string> = {
              purchase_intent: 'Purchase Intent',
              comparison: 'Comparison Shopping',
              price_sensitivity: 'Price Sensitivity',
              recommendation_seeking: 'Seeking Recommendations',
              urgency: 'Purchase Urgency',
            };
            const typeColor: Record<string, string> = {
              purchase_intent: 'text-green-400 border-green-500/40',
              comparison: 'text-blue-400 border-blue-500/40',
              price_sensitivity: 'text-yellow-400 border-yellow-500/40',
              recommendation_seeking: 'text-purple-400 border-purple-500/40',
              urgency: 'text-red-400 border-red-500/40',
            };
            return (
              <div key={type} className="space-y-1.5">
                <h4 className={`text-xs font-bold uppercase px-2 py-0.5 inline-block rounded border ${typeColor[type] ?? ''}`}>
                  {typeLabel[type]} ({items.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {items.map((b, i) => (
                    <div key={`${b.pattern}-${i}`} className="flex items-center justify-between px-3 py-2 bg-bg-primary border border-border rounded-md">
                      <span className="text-sm text-text-secondary">&ldquo;{b.pattern}&rdquo;</span>
                      <span className="text-[10px] text-text-muted shrink-0">×{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'phrases' && (
        <NgramList
          title="4-6 word motifs — the gold"
          description="Long recurring phrases with high source diversity. These are the ones to steal word-for-word for hooks and headlines."
          grams={signal.top_phrases}
          picked={signal.picks?.phrases ?? []}
          onTogglePick={(v) => handlePick('phrases', v)}
        />
      )}
      {tab === 'trigrams' && (
        <NgramList
          title="3-word expressions"
          grams={signal.top_trigrams}
          picked={signal.picks?.phrases ?? []}
          onTogglePick={(v) => handlePick('phrases', v)}
        />
      )}
      {tab === 'bigrams' && (
        <NgramList
          title="2-word co-occurrences"
          grams={signal.top_bigrams}
          picked={signal.picks?.phrases ?? []}
          onTogglePick={(v) => handlePick('phrases', v)}
          compact
        />
      )}
      {tab === 'unigrams' && (
        <NgramList
          title="Single words"
          description="Raw word frequency. Useful for spotting vocabulary your audience uses."
          grams={signal.top_unigrams}
          picked={signal.picks?.phrases ?? []}
          onTogglePick={(v) => handlePick('phrases', v)}
          compact
        />
      )}
      {tab === 'emotion' && (
        <EmotionList
          hits={signal.emotion_markers}
          picked={signal.picks?.emotion_markers ?? []}
          onTogglePick={(phrase) => handlePick('emotion_markers', phrase)}
        />
      )}
      {tab === 'verbatims' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search verbatims..."
              className="flex-1 min-w-[200px] px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
            />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as SourceType | 'all')}
              className="px-3 py-2 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
            >
              <option value="all">All sources</option>
              {Object.keys(signal.source_breakdown).map((src) => (
                <option key={src} value={src}>
                  {SOURCE_LABELS[src as SourceType] ?? src}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-text-muted">
            Showing {filteredVerbatims.length} of {signal.items.length} verbatims.
            Click ★ to mark as a golden nugget — picks carry into downstream gates.
          </p>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredVerbatims.map((item, i) => (
              <VerbatimCard
                key={`${item.source_url}-${i}`}
                item={item}
                isPicked={isPicked(signal.picks, 'verbatims', item.text)}
                onTogglePick={() => handlePick('verbatims', item.text)}
                searchHighlight={search.trim()}
              />
            ))}
            {filteredVerbatims.length === 0 && (
              <p className="text-sm text-text-muted italic text-center py-8">
                No verbatims match the current filters.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -------- subcomponents --------

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        highlight
          ? 'bg-accent-orange/10 border-accent-orange/40'
          : 'bg-bg-card border-border'
      }`}
    >
      <div className="text-[10px] uppercase text-text-muted font-semibold">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-accent-orange' : 'text-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md border transition ${
        active
          ? 'bg-accent-orange/15 border-accent-orange/60 text-accent-orange font-semibold'
          : 'bg-bg-primary border-border text-text-secondary hover:border-text-muted hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function NgramList({
  title,
  description,
  grams,
  picked,
  onTogglePick,
  compact,
}: {
  title: string;
  description?: string;
  grams: Array<{ gram: string; count: number; sources: number }>;
  picked: string[];
  onTogglePick: (gram: string) => void;
  compact?: boolean;
}) {
  if (grams.length === 0) {
    return <p className="text-sm text-text-muted italic">Nothing here yet — re-run avatar excavation.</p>;
  }
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description && <p className="text-[11px] text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className={compact ? 'grid grid-cols-2 md:grid-cols-3 gap-1.5' : 'space-y-1.5'}>
        {grams.map((g) => {
          const isP = picked.includes(g.gram);
          return (
            <button
              key={g.gram}
              type="button"
              onClick={() => onTogglePick(g.gram)}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-left transition ${
                isP
                  ? 'bg-accent-orange/10 border-accent-orange/50'
                  : 'bg-bg-primary border-border hover:border-accent-orange/40'
              }`}
            >
              <span className={`text-sm ${isP ? 'text-accent-orange font-semibold' : 'text-text-secondary'}`}>
                {isP ? '★ ' : ''}{g.gram}
              </span>
              <span className="shrink-0 flex items-center gap-1">
                <span className="text-[10px] text-text-muted">×{g.count}</span>
                <span className="text-[9px] text-text-muted">({g.sources} src)</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmotionList({
  hits,
  picked,
  onTogglePick,
}: {
  hits: Array<{ category: string; phrase: string; lang: string; count: number; sources: number }>;
  picked: string[];
  onTogglePick: (phrase: string) => void;
}) {
  if (hits.length === 0) {
    return <p className="text-sm text-text-muted italic">No emotion markers hit — corpus may be too small.</p>;
  }
  const grouped = hits.reduce<Record<string, typeof hits>>((acc, h) => {
    if (!acc[h.category]) acc[h.category] = [];
    acc[h.category].push(h);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-text-muted">
        Regex-matched emotion phrases across the corpus. Generous on purpose — false positives are fine, you pick what matters.
      </p>
      {Object.entries(grouped).map(([cat, catHits]) => (
        <div key={cat}>
          <h4 className={`text-xs font-bold uppercase mb-2 px-2 py-0.5 inline-block rounded border ${EMOTION_COLORS[cat] ?? 'text-text-primary border-border bg-bg-card'}`}>
            {cat} ({catHits.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {catHits.map((h) => {
              const key = `${h.category}::${h.phrase}`;
              const isP = picked.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTogglePick(key)}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-left ${
                    isP
                      ? 'bg-accent-orange/10 border-accent-orange/50 text-accent-orange'
                      : 'bg-bg-primary border-border text-text-secondary hover:border-accent-orange/40'
                  }`}
                >
                  <span className="text-sm">
                    {isP ? '★ ' : ''}&ldquo;{h.phrase}&rdquo;
                  </span>
                  <span className="text-[10px] text-text-muted shrink-0">×{h.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function VerbatimCard({
  item,
  isPicked,
  onTogglePick,
  searchHighlight,
}: {
  item: RawSignalItem;
  isPicked: boolean;
  onTogglePick: () => void;
  searchHighlight?: string;
}) {
  return (
    <div
      className={`p-3 rounded-lg border-l-2 ${
        isPicked
          ? 'border-accent-orange bg-accent-orange/5'
          : 'border-accent-teal/40 bg-bg-primary'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[10px] px-1.5 py-0.5 bg-bg-card rounded border border-border text-text-muted">
          {SOURCE_LABELS[item.source_type] ?? item.source_type}
        </span>
        <button
          type="button"
          onClick={onTogglePick}
          className={`text-xs shrink-0 ${
            isPicked ? 'text-accent-orange' : 'text-text-muted hover:text-accent-orange'
          }`}
          title={isPicked ? 'Un-favorite' : 'Mark as golden nugget'}
        >
          {isPicked ? '★ Picked' : '☆ Pick'}
        </button>
      </div>
      <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">
        {highlightText(item.text, searchHighlight)}
      </p>
      {item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-text-muted hover:text-accent-teal mt-1 block truncate"
        >
          {item.source_url}
        </a>
      )}
    </div>
  );
}

// -------- helpers --------

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function highlightText(text: string, query?: string): React.ReactNode {
  if (!query) return text;
  const q = query.trim();
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="bg-accent-orange/30 text-text-primary">{p}</mark>
    ) : (
      p
    ),
  );
}
