'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { getAllSwipeEntries, addSwipeEntry, deleteSwipeEntry, updateSwipeEntry } from '@/lib/store/db';
import type { SwipeVaultEntry, SwipeStatus, SwipeSource, SophisticationLevel } from '@/lib/swipeVault/types';
import { SOPHISTICATION_LEVELS } from '@/lib/swipeVault/types';

const STATUSES: { id: SwipeStatus; label: string; chip: string }[] = [
  { id: 'winning', label: '✓ Winner', chip: 'bg-success/15 text-success border-success/40' },
  { id: 'big_swing', label: '🎯 Big Swing', chip: 'bg-accent-orange/15 text-accent-orange border-accent-orange/40' },
  { id: 'reference', label: '📌 Reference', chip: 'bg-accent-teal/15 text-accent-teal border-accent-teal/40' },
  { id: 'losing', label: '✗ Loser', chip: 'bg-warning/15 text-warning border-warning/40' },
];

const AWARENESS_LEVELS = ['full_unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware', 'retargeting'];
const FORMATS = ['static', 'advertorial', 'vsl', 'ugc', 'carousel', 'email', 'native'];

const SOPH_COLORS: Record<SophisticationLevel, { bg: string; border: string; text: string; bar: string }> = {
  1: { bg: 'bg-red-500/10', border: 'border-red-500/40', text: 'text-red-400', bar: 'bg-red-500' },
  2: { bg: 'bg-orange-500/10', border: 'border-orange-500/40', text: 'text-orange-400', bar: 'bg-orange-500' },
  3: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-400', bar: 'bg-yellow-500' },
  4: { bg: 'bg-blue-500/10', border: 'border-blue-500/40', text: 'text-blue-400', bar: 'bg-blue-500' },
  5: { bg: 'bg-purple-500/10', border: 'border-purple-500/40', text: 'text-purple-400', bar: 'bg-purple-500' },
};

export default function SwipeVaultPage() {
  const [entries, setEntries] = useState<SwipeVaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<SwipeStatus | ''>('');
  const [filterNiche, setFilterNiche] = useState('');
  const [filterAwareness, setFilterAwareness] = useState('');
  const [filterFormat, setFilterFormat] = useState('');
  const [filterSoph, setFilterSoph] = useState<SophisticationLevel | 0>(0);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedSophInfo, setExpandedSophInfo] = useState<SophisticationLevel | null>(null);

  const loadEntries = useCallback(async () => {
    const all = await getAllSwipeEntries();
    setEntries(all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')));
    setLoading(false);
  }, []);

  useEffect(() => {
    // setState calls happen after an await — not synchronous in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntries();
  }, [loadEntries]);

  const filtered = entries.filter(e =>
    (!filterStatus || e.status === filterStatus) &&
    (!filterNiche || (e.niche || '').toLowerCase().includes(filterNiche.toLowerCase())) &&
    (!filterAwareness || e.awarenessLevel === filterAwareness) &&
    (!filterFormat || e.format === filterFormat) &&
    (!filterSoph || e.sophisticationLevel === filterSoph)
  );

  const counts = {
    total: entries.length,
    winning: entries.filter(e => e.status === 'winning').length,
    big_swing: entries.filter(e => e.status === 'big_swing').length,
    losing: entries.filter(e => e.status === 'losing').length,
    reference: entries.filter(e => e.status === 'reference').length,
  };

  const sophStats = useMemo(() => {
    const tagged = entries.filter(e => e.sophisticationLevel);
    if (tagged.length === 0) return null;

    const dist: Record<number, { total: number; winners: number; losers: number }> = {};
    for (let l = 1; l <= 5; l++) dist[l] = { total: 0, winners: 0, losers: 0 };
    for (const e of tagged) {
      const lv = e.sophisticationLevel!;
      dist[lv].total++;
      if (e.status === 'winning') dist[lv].winners++;
      if (e.status === 'losing') dist[lv].losers++;
    }

    const maxTotal = Math.max(...Object.values(dist).map(d => d.total), 1);

    let dominantLevel: SophisticationLevel = 3;
    let maxCount = 0;
    for (let l = 1; l <= 5; l++) {
      if (dist[l].total > maxCount) { maxCount = dist[l].total; dominantLevel = l as SophisticationLevel; }
    }

    let winningLevel: SophisticationLevel | null = null;
    let bestRate = 0;
    for (let l = 1; l <= 5; l++) {
      if (dist[l].total >= 2) {
        const rate = dist[l].winners / dist[l].total;
        if (rate > bestRate) { bestRate = rate; winningLevel = l as SophisticationLevel; }
      }
    }

    let losingLevel: SophisticationLevel | null = null;
    let worstRate = 0;
    for (let l = 1; l <= 5; l++) {
      if (dist[l].total >= 2) {
        const rate = dist[l].losers / dist[l].total;
        if (rate > worstRate) { worstRate = rate; losingLevel = l as SophisticationLevel; }
      }
    }

    return { dist, maxTotal, dominantLevel, winningLevel, losingLevel, taggedCount: tagged.length, totalCount: entries.length };
  }, [entries]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this swipe entry?')) return;
    await deleteSwipeEntry(id);
    loadEntries();
  };

  const handleStatusChange = async (entry: SwipeVaultEntry, newStatus: SwipeStatus) => {
    await updateSwipeEntry({ ...entry, status: newStatus, updatedAt: new Date().toISOString() });
    loadEntries();
  };

  const handleSophChange = async (entry: SwipeVaultEntry, level: SophisticationLevel | undefined) => {
    await updateSwipeEntry({ ...entry, sophisticationLevel: level, updatedAt: new Date().toISOString() });
    loadEntries();
  };

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-sm text-text-muted hover:text-accent-orange">← Home</Link>
            <h1 className="text-3xl font-bold text-text-primary mt-2">🗃️ Swipe Vault</h1>
            <p className="text-sm text-text-muted mt-1">
              Global library of ads. Agents pull from here across all projects — winners to emulate, losers to avoid, big swings to explore.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg bg-accent-orange text-bg-primary font-semibold hover:bg-accent-orange/90"
          >
            + Add Entry
          </button>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <div className="bg-bg-card border border-border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-text-primary">{counts.total}</div>
            <div className="text-xs text-text-muted">Total</div>
          </div>
          <div className="bg-bg-card border border-success/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-success">{counts.winning}</div>
            <div className="text-xs text-text-muted">Winners</div>
          </div>
          <div className="bg-bg-card border border-accent-orange/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-accent-orange">{counts.big_swing}</div>
            <div className="text-xs text-text-muted">Big Swings</div>
          </div>
          <div className="bg-bg-card border border-accent-teal/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-accent-teal">{counts.reference}</div>
            <div className="text-xs text-text-muted">Reference</div>
          </div>
          <div className="bg-bg-card border border-warning/40 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-warning">{counts.losing}</div>
            <div className="text-xs text-text-muted">Losers</div>
          </div>
        </div>

        {/* Sophistication Dashboard */}
        <div className="bg-bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Market Sophistication Level</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Schwartz&apos;s 5 levels — tag each entry to see where the market sits and where winners live.
                {sophStats && <span className="text-accent-orange ml-1">{sophStats.taggedCount}/{sophStats.totalCount} tagged</span>}
              </p>
            </div>
            {sophStats?.winningLevel && (
              <div className="text-right">
                <div className="text-xs text-text-muted">Sweet spot</div>
                <div className={`text-xl font-black ${SOPH_COLORS[sophStats.winningLevel].text}`}>
                  L{sophStats.winningLevel}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {SOPHISTICATION_LEVELS.map(({ level, name, short, description, example }) => {
              const colors = SOPH_COLORS[level];
              const stat = sophStats?.dist?.[level] ?? { total: 0, winners: 0, losers: 0 };
              const barWidth = sophStats ? (stat.total / sophStats.maxTotal) * 100 : 0;
              const isWinning = sophStats?.winningLevel === level;
              const isLosing = sophStats?.losingLevel === level && !isWinning;
              const isExpanded = expandedSophInfo === level;

              return (
                <div key={level}>
                  <div
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition ${
                      filterSoph === level ? `${colors.bg} ${colors.border} border` : 'hover:bg-bg-primary/60'
                    }`}
                    onClick={() => setFilterSoph(prev => prev === level ? 0 : level)}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm ${colors.bg} ${colors.text}`}>
                      {short}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{name}</span>
                        {isWinning && <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success font-bold">WINNING</span>}
                        {isLosing && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-bold">LOSING</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-bg-primary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${barWidth}%` }} />
                        </div>
                        <span className="text-xs text-text-muted w-20 text-right">
                          {stat.total > 0 ? `${stat.total} (${stat.winners}W/${stat.losers}L)` : '—'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedSophInfo(prev => prev === level ? null : level); }}
                      className="text-text-muted hover:text-text-primary text-sm px-1"
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className={`ml-12 mr-8 mt-1 mb-2 p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
                      <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
                      <p className={`text-xs ${colors.text} mt-2 italic`}>{example}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sophStats && sophStats.taggedCount >= 4 && (
            <div className="mt-4 p-3 rounded-lg bg-bg-primary border border-border">
              <div className="text-xs font-semibold text-text-primary mb-1">Learning signal (injected into all agents):</div>
              <p className="text-xs text-text-muted leading-relaxed">
                Market is at <span className={`font-bold ${SOPH_COLORS[sophStats.dominantLevel].text}`}>L{sophStats.dominantLevel} ({SOPHISTICATION_LEVELS[sophStats.dominantLevel - 1].name})</span>.
                {sophStats.winningLevel && (
                  <> Winners concentrate at <span className={`font-bold ${SOPH_COLORS[sophStats.winningLevel].text}`}>L{sophStats.winningLevel}</span>.</>
                )}
                {sophStats.losingLevel && sophStats.losingLevel !== sophStats.winningLevel && (
                  <> <span className={`font-bold ${SOPH_COLORS[sophStats.losingLevel].text}`}>L{sophStats.losingLevel}</span> underperforms — agents will avoid writing at that level.</>
                )}
                {' '}Agents write at L{sophStats.winningLevel ?? sophStats.dominantLevel}+ minimum.
              </p>
            </div>
          )}

          {(!sophStats || sophStats.taggedCount < 4) && (
            <div className="mt-3 p-2.5 rounded-lg bg-accent-orange/5 border border-accent-orange/20">
              <p className="text-xs text-accent-orange">
                {!sophStats ? 'Tag entries with a sophistication level' : `${sophStats.taggedCount}/4 tagged`}
                {' '} — need at least 4 tagged entries for agents to learn from sophistication data.
              </p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-bg-card border border-border rounded-lg p-4 mb-6 flex flex-wrap gap-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as SwipeStatus | '')} className="bg-bg-primary border border-border rounded px-3 py-1.5 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <input value={filterNiche} onChange={e => setFilterNiche(e.target.value)} placeholder="Filter by niche" className="bg-bg-primary border border-border rounded px-3 py-1.5 text-sm" />
          <select value={filterAwareness} onChange={e => setFilterAwareness(e.target.value)} className="bg-bg-primary border border-border rounded px-3 py-1.5 text-sm">
            <option value="">All awareness</option>
            {AWARENESS_LEVELS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={filterFormat} onChange={e => setFilterFormat(e.target.value)} className="bg-bg-primary border border-border rounded px-3 py-1.5 text-sm">
            <option value="">All formats</option>
            {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filterSoph} onChange={e => setFilterSoph(Number(e.target.value) as SophisticationLevel | 0)} className="bg-bg-primary border border-border rounded px-3 py-1.5 text-sm">
            <option value={0}>All levels</option>
            {SOPHISTICATION_LEVELS.map(s => <option key={s.level} value={s.level}>L{s.level} — {s.name}</option>)}
          </select>
          {(filterStatus || filterNiche || filterAwareness || filterFormat || filterSoph) && (
            <button onClick={() => { setFilterStatus(''); setFilterNiche(''); setFilterAwareness(''); setFilterFormat(''); setFilterSoph(0); }} className="text-sm text-text-muted hover:text-text-primary">
              clear
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center text-text-muted py-12">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-text-muted py-12">
            {entries.length === 0 ? 'No entries yet. Add your first winner/loser/big-swing.' : 'No entries match these filters.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(e => (
              <EntryCard
                key={e.id}
                entry={e}
                onDelete={() => handleDelete(e.id)}
                onStatusChange={(s) => handleStatusChange(e, s)}
                onSophChange={(l) => handleSophChange(e, l)}
              />
            ))}
          </div>
        )}

        {showAdd && <AddEntryModal onClose={() => { setShowAdd(false); loadEntries(); }} />}
      </div>
    </div>
  );
}

function EntryCard({ entry, onDelete, onStatusChange, onSophChange }: {
  entry: SwipeVaultEntry;
  onDelete: () => void;
  onStatusChange: (s: SwipeStatus) => void;
  onSophChange: (l: SophisticationLevel | undefined) => void;
}) {
  const statusDef = STATUSES.find(s => s.id === entry.status);
  const sophDef = entry.sophisticationLevel ? SOPHISTICATION_LEVELS.find(s => s.level === entry.sophisticationLevel) : null;
  const sophColor = entry.sophisticationLevel ? SOPH_COLORS[entry.sophisticationLevel] : null;

  return (
    <div className="bg-bg-card border border-border rounded-lg overflow-hidden hover:border-accent-orange/60 transition">
      {entry.imageUrl && (
        <div className="aspect-square bg-bg-primary relative">
          <img src={entry.imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <select
            value={entry.status}
            onChange={e => onStatusChange(e.target.value as SwipeStatus)}
            className={`text-xs px-2 py-1 rounded border ${statusDef?.chip ?? ''}`}
          >
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button onClick={onDelete} className="text-text-muted hover:text-warning text-sm">×</button>
        </div>

        {/* Sophistication level selector */}
        <div className="flex items-center gap-1">
          {([1, 2, 3, 4, 5] as SophisticationLevel[]).map(l => {
            const c = SOPH_COLORS[l];
            const isActive = entry.sophisticationLevel === l;
            return (
              <button
                key={l}
                onClick={() => onSophChange(isActive ? undefined : l)}
                title={SOPHISTICATION_LEVELS[l - 1].name}
                className={`flex-1 text-[10px] font-bold py-1 rounded transition ${
                  isActive ? `${c.bar} text-white` : `${c.bg} ${c.text} border ${c.border} hover:opacity-80`
                }`}
              >
                L{l}
              </button>
            );
          })}
        </div>
        {sophDef && sophColor && (
          <div className={`text-[10px] ${sophColor.text} font-medium`}>{sophDef.name}</div>
        )}

        {entry.hook && <div className="text-sm font-semibold text-text-primary">{entry.hook}</div>}
        {entry.headline && <div className="text-sm text-text-primary">{entry.headline}</div>}
        {entry.body && <div className="text-xs text-text-muted line-clamp-3">{entry.body}</div>}
        {entry.cta && <div className="text-xs text-accent-teal">CTA: {entry.cta}</div>}
        <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
          {entry.niche && <span className="text-xs bg-bg-primary px-2 py-0.5 rounded">{entry.niche}</span>}
          {entry.format && <span className="text-xs bg-bg-primary px-2 py-0.5 rounded">{entry.format}</span>}
          {entry.awarenessLevel && <span className="text-xs bg-bg-primary px-2 py-0.5 rounded">{entry.awarenessLevel}</span>}
          {entry.emotion && <span className="text-xs bg-bg-primary px-2 py-0.5 rounded">{entry.emotion}</span>}
        </div>
        {entry.note && <div className="text-xs text-text-muted italic pt-1">{entry.note}</div>}
        {entry.metrics && (entry.metrics.roas || entry.metrics.ctr || entry.metrics.cpa) && (
          <div className="text-xs text-accent-orange pt-1">
            {entry.metrics.roas && <span className="mr-2">ROAS {entry.metrics.roas}</span>}
            {entry.metrics.ctr && <span className="mr-2">CTR {entry.metrics.ctr}%</span>}
            {entry.metrics.cpa && <span>CPA {entry.metrics.cpa}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function AddEntryModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<SwipeStatus>('winning');
  const [source, setSource] = useState<SwipeSource>('swipe');
  const [imageUrl, setImageUrl] = useState('');
  const [hook, setHook] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('');
  const [niche, setNiche] = useState('');
  const [format, setFormat] = useState('');
  const [awarenessLevel, setAwarenessLevel] = useState('');
  const [angle, setAngle] = useState('');
  const [emotion, setEmotion] = useState('');
  const [note, setNote] = useState('');
  const [roas, setRoas] = useState('');
  const [ctr, setCtr] = useState('');
  const [sophLevel, setSophLevel] = useState<SophisticationLevel | 0>(0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const entry: SwipeVaultEntry = {
        id: crypto.randomUUID(),
        status,
        source,
        imageUrl: imageUrl || undefined,
        hook: hook || undefined,
        headline: headline || undefined,
        body: body || undefined,
        cta: cta || undefined,
        niche: niche || undefined,
        format: format || undefined,
        awarenessLevel: awarenessLevel || undefined,
        angle: angle || undefined,
        emotion: emotion || undefined,
        note: note || undefined,
        sophisticationLevel: sophLevel || undefined,
        metrics: (roas || ctr) ? {
          roas: roas ? parseFloat(roas) : undefined,
          ctr: ctr ? parseFloat(ctr) : undefined,
        } : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await addSwipeEntry(entry);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-bg-card border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Add to Swipe Vault</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary">✕</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted">Status *</label>
              <select value={status} onChange={e => setStatus(e.target.value as SwipeStatus)} className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1">
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted">Source</label>
              <select value={source} onChange={e => setSource(e.target.value as SwipeSource)} className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1">
                <option value="swipe">Swipe</option>
                <option value="own_brand">Own Brand</option>
                <option value="competitor">Competitor</option>
                <option value="generated">Generated</option>
              </select>
            </div>
          </div>

          {/* Sophistication Level */}
          <div>
            <label className="text-xs text-text-muted">Sophistication Level (Schwartz)</label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {SOPHISTICATION_LEVELS.map(({ level, name, short }) => {
                const c = SOPH_COLORS[level];
                const isActive = sophLevel === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSophLevel(prev => prev === level ? 0 : level)}
                    className={`p-2.5 rounded-lg text-center transition border ${
                      isActive
                        ? `${c.bar} text-white border-transparent`
                        : `${c.bg} ${c.text} ${c.border} hover:opacity-80`
                    }`}
                  >
                    <div className="text-lg font-black">{short}</div>
                    <div className="text-[9px] font-medium leading-tight mt-0.5">{name}</div>
                  </button>
                );
              })}
            </div>
            {sophLevel > 0 && (
              <div className={`mt-2 p-2.5 rounded-lg ${SOPH_COLORS[sophLevel as SophisticationLevel].bg} border ${SOPH_COLORS[sophLevel as SophisticationLevel].border}`}>
                <p className="text-xs text-text-secondary">{SOPHISTICATION_LEVELS[sophLevel - 1].description}</p>
                <p className={`text-xs ${SOPH_COLORS[sophLevel as SophisticationLevel].text} mt-1 italic`}>{SOPHISTICATION_LEVELS[sophLevel - 1].example}</p>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-text-muted">Image</label>
            <div className="flex gap-2 mt-1">
              <input
                type="file"
                accept="image/*"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setImageUrl(String(reader.result));
                  reader.readAsDataURL(file);
                }}
                className="flex-1 bg-bg-primary border border-border rounded px-3 py-2 text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-accent-orange file:text-bg-primary file:text-xs file:font-semibold file:cursor-pointer"
              />
              {imageUrl && (
                <button onClick={() => setImageUrl('')} className="px-2 py-1 text-xs text-text-muted hover:text-warning border border-border rounded">clear</button>
              )}
            </div>
            <input
              value={imageUrl.startsWith('data:') ? '' : imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="…or paste URL"
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-2"
            />
            {imageUrl && (
              <img src={imageUrl} alt="" className="mt-2 max-h-32 rounded border border-border object-cover" />
            )}
          </div>

          <div>
            <label className="text-xs text-text-muted">Hook</label>
            <input value={hook} onChange={e => setHook(e.target.value)} className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Headline</label>
            <input value={headline} onChange={e => setHeadline(e.target.value)} className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-text-muted">CTA</label>
            <input value={cta} onChange={e => setCta(e.target.value)} className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted">Niche</label>
              <input value={niche} onChange={e => setNiche(e.target.value)} placeholder="e.g. menopause, joint pain" className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-text-muted">Format</label>
              <select value={format} onChange={e => setFormat(e.target.value)} className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1">
                <option value="">—</option>
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted">Awareness</label>
              <select value={awarenessLevel} onChange={e => setAwarenessLevel(e.target.value)} className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1">
                <option value="">—</option>
                {AWARENESS_LEVELS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted">Emotion</label>
              <input value={emotion} onChange={e => setEmotion(e.target.value)} placeholder="fear, hope, shame..." className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-text-muted">Angle</label>
              <input value={angle} onChange={e => setAngle(e.target.value)} className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-text-muted">ROAS / CTR</label>
              <div className="flex gap-2 mt-1">
                <input value={roas} onChange={e => setRoas(e.target.value)} placeholder="ROAS" className="w-1/2 bg-bg-primary border border-border rounded px-2 py-2 text-sm" />
                <input value={ctr} onChange={e => setCtr(e.target.value)} placeholder="CTR %" className="w-1/2 bg-bg-primary border border-border rounded px-2 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted">Why it works / flops (agent learning signal)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="e.g. 'Emotional hook + specific moment of pain.' or 'Too generic, no identity anchor.'" className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-primary">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-accent-orange text-bg-primary font-semibold hover:bg-accent-orange/90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save to Vault'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
