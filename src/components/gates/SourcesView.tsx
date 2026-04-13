'use client';

import { useMemo, useState } from 'react';
import { RawSignal, RawSignalItem, SourceType, SOURCE_LABELS } from '@/lib/avatars/types';

// Platform color + icon map — matches the rest of the UI palette.
const PLATFORM_META: Record<
  string,
  { label: string; icon: string; accent: string; border: string; bg: string; ring: string }
> = {
  reddit: {
    label: 'Reddit',
    icon: '🔴',
    accent: 'text-orange-300',
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/5',
    ring: 'ring-orange-500/20',
  },
  quora: {
    label: 'Quora',
    icon: '❓',
    accent: 'text-red-300',
    border: 'border-red-500/40',
    bg: 'bg-red-500/5',
    ring: 'ring-red-500/20',
  },
  youtube: {
    label: 'YouTube',
    icon: '▶️',
    accent: 'text-rose-300',
    border: 'border-rose-500/40',
    bg: 'bg-rose-500/5',
    ring: 'ring-rose-500/20',
  },
  tiktok: {
    label: 'TikTok',
    icon: '🎵',
    accent: 'text-fuchsia-300',
    border: 'border-fuchsia-500/40',
    bg: 'bg-fuchsia-500/5',
    ring: 'ring-fuchsia-500/20',
  },
  amazon: {
    label: 'Amazon Reviews',
    icon: '📦',
    accent: 'text-amber-300',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/5',
    ring: 'ring-amber-500/20',
  },
  reviews: {
    label: 'Review Sites',
    icon: '⭐',
    accent: 'text-yellow-300',
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-500/5',
    ring: 'ring-yellow-500/20',
  },
  forums: {
    label: 'Niche Forums',
    icon: '💬',
    accent: 'text-green-300',
    border: 'border-green-500/40',
    bg: 'bg-green-500/5',
    ring: 'ring-green-500/20',
  },
  searchWide: {
    label: 'Wide Web',
    icon: '🌐',
    accent: 'text-sky-300',
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/5',
    ring: 'ring-sky-500/20',
  },
  shopify: {
    label: 'Shopify',
    icon: '🛒',
    accent: 'text-emerald-300',
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/5',
    ring: 'ring-emerald-500/20',
  },
  instagram: {
    label: 'Instagram',
    icon: '📷',
    accent: 'text-pink-300',
    border: 'border-pink-500/40',
    bg: 'bg-pink-500/5',
    ring: 'ring-pink-500/20',
  },
  facebook: {
    label: 'Facebook',
    icon: '👥',
    accent: 'text-blue-300',
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/5',
    ring: 'ring-blue-500/20',
  },
};

function getMeta(platform: string) {
  return (
    PLATFORM_META[platform] || {
      label: SOURCE_LABELS[platform as SourceType] || platform,
      icon: '📄',
      accent: 'text-text-primary',
      border: 'border-border',
      bg: 'bg-bg-card',
      ring: 'ring-border',
    }
  );
}

interface SourcesViewProps {
  signal: RawSignal;
}

export default function SourcesView({ signal }: SourcesViewProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const sourceErrors = signal.source_errors ?? {};

  // Group items by source_type
  const { byPlatform, totals, totalItems } = useMemo(() => {
    const grouped: Record<string, RawSignalItem[]> = {};
    for (const item of signal.items) {
      (grouped[item.source_type] ||= []).push(item);
    }
    const totalsMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(grouped)) {
      totalsMap[k] = v.length;
    }
    // Ensure platforms that errored (even with 0 items) still show up in the grid.
    for (const k of Object.keys(sourceErrors)) {
      if (!(k in totalsMap)) totalsMap[k] = 0;
    }
    const total = signal.items.length;
    return { byPlatform: grouped, totals: totalsMap, totalItems: total };
  }, [signal.items, sourceErrors]);

  // Sort platforms: successful first (desc by count), then failed 0-item platforms.
  const sortedPlatforms = useMemo(() => {
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [totals]);

  // Filtered items for the selected platform
  const filteredItems = useMemo(() => {
    if (!selectedPlatform) return [];
    const items = byPlatform[selectedPlatform] || [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((it) => it.text.toLowerCase().includes(q));
  }, [byPlatform, selectedPlatform, search]);

  if (totalItems === 0 && Object.keys(sourceErrors).length === 0) {
    return (
      <div className="p-6 bg-bg-card border border-border rounded-xl text-sm text-text-muted italic">
        No raw signal items captured. Re-run the excavation to populate the source breakdown.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER STATS */}
      <div className="p-4 bg-bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-accent-teal">
            Source breakdown
          </h3>
          <span className="text-[10px] font-mono text-text-muted">
            {totalItems} total items across {sortedPlatforms.length} platforms
          </span>
        </div>

        {/* PLATFORM GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {sortedPlatforms.map((platform) => {
            const meta = getMeta(platform);
            const count = totals[platform] || 0;
            const pct = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
            const isActive = selectedPlatform === platform;
            const hasError = Boolean(sourceErrors[platform]);
            const isFailed = hasError && count === 0;
            return (
              <button
                key={platform}
                type="button"
                onClick={() => {
                  setSelectedPlatform(isActive ? null : platform);
                  setSearch('');
                }}
                className={`text-left p-3 rounded-lg border transition ${
                  isFailed ? 'border-red-500/40 bg-red-500/5' : `${meta.border} ${meta.bg}`
                } ${isActive ? `ring-2 ${isFailed ? 'ring-red-500/30' : meta.ring}` : 'hover:ring-1 hover:ring-border'}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">{meta.icon}</span>
                  <span className={`text-xs font-bold ${isFailed ? 'text-red-300' : meta.accent}`}>
                    {meta.label}
                  </span>
                  {isFailed && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                      FAILED
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-black ${isFailed ? 'text-red-300' : meta.accent}`}>
                    {count}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">{pct}%</span>
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 h-1 bg-border/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      isFailed
                        ? 'bg-red-500/60'
                        : meta.accent.replace('text-', 'bg-').replace('-300', '-500')
                    }`}
                    style={{ width: `${Math.max(3, pct)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* FAILED-PLATFORM DIAGNOSTIC PANEL */}
        {Object.keys(sourceErrors).length > 0 && (
          <div className="mt-4 p-3 bg-red-500/5 border border-red-500/30 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-300">
                Source diagnostics — {Object.keys(sourceErrors).length} platform
                {Object.keys(sourceErrors).length === 1 ? '' : 's'} reported issues
              </h4>
            </div>
            <ul className="space-y-1.5">
              {Object.entries(sourceErrors).map(([platform, msg]) => {
                const meta = getMeta(platform);
                return (
                  <li key={platform} className="flex items-start gap-2 text-[10px]">
                    <span className="text-sm leading-none">{meta.icon}</span>
                    <div className="flex-1">
                      <span className={`font-bold ${meta.accent}`}>{meta.label}:</span>{' '}
                      <span className="text-text-secondary">{msg}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* DETAIL VIEW — items for selected platform */}
      {selectedPlatform && (totals[selectedPlatform] ?? 0) === 0 && sourceErrors[selectedPlatform] && (
        <div className="p-4 bg-red-500/5 border border-red-500/30 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getMeta(selectedPlatform).icon}</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-300">
              {getMeta(selectedPlatform).label} — fetch failed
            </h3>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {sourceErrors[selectedPlatform]}
          </p>
        </div>
      )}
      {selectedPlatform && (totals[selectedPlatform] ?? 0) > 0 && (
        <div className="p-4 bg-bg-card border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getMeta(selectedPlatform).icon}</span>
              <h3 className={`text-sm font-bold uppercase tracking-wider ${getMeta(selectedPlatform).accent}`}>
                {getMeta(selectedPlatform).label}
              </h3>
              <span className="text-[10px] font-mono text-text-muted">
                {filteredItems.length} / {totals[selectedPlatform]} items
              </span>
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search in this platform..."
              className="text-xs px-3 py-1.5 bg-bg-primary border border-border rounded w-64 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-teal"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredItems.length === 0 && (
              <div className="text-[11px] text-text-muted italic p-4 text-center">
                No items match &ldquo;{search}&rdquo;.
              </div>
            )}
            {filteredItems.map((item, i) => (
              <div key={i} className={`p-3 bg-bg-primary border ${getMeta(selectedPlatform).border} rounded-lg`}>
                {item.title && (
                  <div className="text-[10px] font-semibold text-text-primary mb-1 line-clamp-1">
                    {item.title}
                  </div>
                )}
                <p className="text-[11px] text-text-secondary leading-snug whitespace-pre-wrap">
                  {item.text.length > 600 ? `${item.text.slice(0, 600)}…` : item.text}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[9px] text-text-muted">
                  <span className="font-mono">{item.char_count} chars</span>
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-teal hover:underline truncate max-w-md"
                    >
                      {item.source_url}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedPlatform && (
        <div className="p-4 bg-bg-card border border-dashed border-border rounded-xl text-center">
          <p className="text-xs text-text-muted italic">
            Click a platform above to see its scraped items.
          </p>
        </div>
      )}
    </div>
  );
}
