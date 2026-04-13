'use client';

// ============================================================
// PAWEN — SmartGateOutput
// Renders a gate's output data structure as a readable, interactive
// layout instead of a raw JSON dump. Used by gates 2-9 to deliver
// the "beau retour de Claude" experience that Gate 1 already has.
//
// How it decides what to render:
//   - strings / numbers / bools  → single row
//   - long strings               → collapsible block
//   - string[]                   → bullet list
//   - object[] with `quote`      → quote cards w/ source link
//   - object[] otherwise         → stacked cards
//   - Record<string, unknown>    → titled sections (recursive)
//
// Picking: every array item can be marked as a favorite. Favorites
// are stored in `humanDecisions` under the path `picked.<section>[]`
// so downstream gates can read them.
// ============================================================

import { useMemo, useState, useCallback } from 'react';
import { TranslateCtx, InlineTranslate } from '@/components/ui/TranslateToggle';

interface SmartGateOutputProps {
  data: Record<string, unknown> | unknown;
  humanDecisions: Record<string, unknown>;
  onDecisionsChange: (next: Record<string, unknown>) => void;
  // Source language of the output. When set and ≠ "English", leaf text items
  // render a 🌐 translate toggle so the user can peek at an English version.
  sourceLanguage?: string;
}

// -------------------- helpers --------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isQuoteLike(v: unknown): v is { quote: string; source?: string; source_url?: string; emotion?: string } {
  return isPlainObject(v) && typeof v.quote === 'string';
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isObjectArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => isPlainObject(x));
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPickedSet(
  decisions: Record<string, unknown>,
  sectionPath: string,
): Set<string> {
  const picked = decisions.picked;
  if (!isPlainObject(picked)) return new Set();
  const arr = picked[sectionPath];
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map(String));
}

function togglePicked(
  decisions: Record<string, unknown>,
  sectionPath: string,
  itemKey: string,
): Record<string, unknown> {
  const picked = isPlainObject(decisions.picked) ? { ...decisions.picked } : {};
  const existing = Array.isArray(picked[sectionPath])
    ? (picked[sectionPath] as unknown[]).map(String)
    : [];
  const next = existing.includes(itemKey)
    ? existing.filter((k) => k !== itemKey)
    : [...existing, itemKey];
  return { ...decisions, picked: { ...picked, [sectionPath]: next } };
}

// -------------------- main renderer --------------------

export default function SmartGateOutput({
  data,
  humanDecisions,
  onDecisionsChange,
  sourceLanguage,
}: SmartGateOutputProps) {
  const notes = typeof humanDecisions.notes === 'string' ? humanDecisions.notes : '';

  const handleNotesChange = useCallback(
    (value: string) => {
      onDecisionsChange({ ...humanDecisions, notes: value });
    },
    [humanDecisions, onDecisionsChange],
  );

  const content = useMemo(() => {
    if (!isPlainObject(data)) {
      // Top-level is not an object — render as raw value
      return <RawValue value={data} />;
    }
    return (
      <div className="space-y-4">
        <OverviewPanel data={data} />
        {Object.entries(data).map(([key, value]) => (
          <Section
            key={key}
            title={humanizeKey(key)}
            path={key}
            value={value}
            humanDecisions={humanDecisions}
            onDecisionsChange={onDecisionsChange}
          />
        ))}
      </div>
    );
  }, [data, humanDecisions, onDecisionsChange]);

  return (
    <TranslateCtx.Provider value={sourceLanguage ?? null}>
    <div className="space-y-6">
      {content}

      {/* Free-form notes — saved into humanDecisions.notes */}
      <div className="p-4 bg-bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase text-accent-orange">
            Your notes on this gate
          </h3>
          <span className="text-[10px] text-text-muted">
            Saved with the gate output — visible to downstream agents.
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          rows={3}
          placeholder="What's missing? What would you push harder on? Any direction Claude should lean into next run?"
          className="w-full px-3 py-2 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-orange resize-y"
        />
      </div>
    </div>
    </TranslateCtx.Provider>
  );
}

// -------------------- overview panel --------------------
// Top-of-gate "at a glance" card. Counts items per top-level section so
// the user sees the shape of the output (e.g. "14 fears, 9 objections,
// 6 triggers, 22 verbatims") instead of 17 opaque collapsibles.

function countDeep(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (isPlainObject(value)) {
    return Object.values(value).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  }
  return 0;
}

function OverviewPanel({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  const stats = entries
    .map(([key, value]) => ({ key, label: humanizeKey(key), count: countDeep(value) }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  if (stats.length === 0) return null;

  const totalItems = stats.reduce((sum, s) => sum + s.count, 0);
  const topStats = stats.slice(0, 8);

  return (
    <section className="p-4 bg-gradient-to-br from-accent-orange/10 via-bg-card to-accent-teal/10 border border-accent-orange/30 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Overview</h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            {totalItems} signals across {stats.length} dimensions — scroll to drill in, ★ to pick favorites.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-accent-orange leading-none">{totalItems}</div>
          <div className="text-[10px] uppercase text-text-muted tracking-wider">total</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {topStats.map((s) => (
          <div
            key={s.key}
            className="px-2.5 py-2 bg-bg-primary/60 border border-border rounded-lg"
          >
            <div className="text-lg font-bold text-accent-teal leading-tight">{s.count}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wide truncate" title={s.label}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
      {stats.length > topStats.length && (
        <div className="text-[10px] text-text-muted mt-2">
          +{stats.length - topStats.length} more dimensions below
        </div>
      )}
    </section>
  );
}

// -------------------- section --------------------

interface SectionProps {
  title: string;
  path: string;
  value: unknown;
  humanDecisions: Record<string, unknown>;
  onDecisionsChange: (next: Record<string, unknown>) => void;
}

function Section({ title, path, value, humanDecisions, onDecisionsChange }: SectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const count = Array.isArray(value) ? value.length : undefined;

  return (
    <section className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-card-hover"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">{title}</span>
          {count !== undefined && (
            <span className="text-[10px] text-text-muted">({count})</span>
          )}
        </div>
        <span className="text-text-muted text-xs">{collapsed ? '▼' : '▲'}</span>
      </button>
      {!collapsed && (
        <div className="px-4 pb-4 pt-1">
          <ValueRenderer
            value={value}
            path={path}
            humanDecisions={humanDecisions}
            onDecisionsChange={onDecisionsChange}
          />
        </div>
      )}
    </section>
  );
}

// -------------------- value dispatch --------------------

interface ValueRendererProps {
  value: unknown;
  path: string;
  humanDecisions: Record<string, unknown>;
  onDecisionsChange: (next: Record<string, unknown>) => void;
}

function ValueRenderer({ value, path, humanDecisions, onDecisionsChange }: ValueRendererProps) {
  if (value === null || value === undefined) {
    return <p className="text-xs text-text-muted italic">(empty)</p>;
  }

  if (typeof value === 'string') {
    if (value.length > 300) {
      return <CollapsibleString value={value} />;
    }
    return (
      <div>
        <p className="text-sm text-text-secondary whitespace-pre-wrap">{value}</p>
        <InlineTranslate text={value} />
      </div>
    );
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <p className="text-sm text-text-primary font-mono">{String(value)}</p>;
  }

  if (isStringArray(value)) {
    return <StringListPickable path={path} items={value} humanDecisions={humanDecisions} onDecisionsChange={onDecisionsChange} />;
  }

  if (Array.isArray(value) && value.every(isQuoteLike)) {
    return <QuoteList path={path} items={value as { quote: string; source?: string; source_url?: string; emotion?: string }[]} humanDecisions={humanDecisions} onDecisionsChange={onDecisionsChange} />;
  }

  if (isObjectArray(value)) {
    return <ObjectCardList path={path} items={value} humanDecisions={humanDecisions} onDecisionsChange={onDecisionsChange} />;
  }

  if (isPlainObject(value)) {
    return (
      <div className="space-y-3 pl-2 border-l-2 border-border">
        {Object.entries(value).map(([key, v]) => (
          <div key={key}>
            <div className="text-[11px] uppercase text-text-muted font-semibold mb-1">
              {humanizeKey(key)}
            </div>
            <ValueRenderer
              value={v}
              path={`${path}.${key}`}
              humanDecisions={humanDecisions}
              onDecisionsChange={onDecisionsChange}
            />
          </div>
        ))}
      </div>
    );
  }

  return <RawValue value={value} />;
}

// -------------------- leaf components --------------------

function CollapsibleString({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className={`text-sm text-text-secondary whitespace-pre-wrap ${open ? '' : 'line-clamp-4'}`}>
        {value}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] text-accent-teal hover:underline"
        >
          {open ? 'Show less' : 'Show more'}
        </button>
        <InlineTranslate text={value} />
      </div>
    </div>
  );
}

function RawValue({ value }: { value: unknown }) {
  return (
    <pre className="text-[11px] text-text-muted font-mono bg-bg-primary p-2 rounded border border-border overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// Picker-enabled string list
function StringListPickable({
  path,
  items,
  humanDecisions,
  onDecisionsChange,
}: {
  path: string;
  items: string[];
  humanDecisions: Record<string, unknown>;
  onDecisionsChange: (next: Record<string, unknown>) => void;
}) {
  const picked = getPickedSet(humanDecisions, path);
  return (
    <ul className="space-y-1">
      {items.map((item, i) => {
        const key = `${i}`;
        const isPicked = picked.has(key);
        return (
          <li key={i} className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => onDecisionsChange(togglePicked(humanDecisions, path, key))}
              title={isPicked ? 'Un-favorite' : 'Mark as favorite'}
              className={`shrink-0 w-4 h-4 mt-0.5 rounded border flex items-center justify-center text-[10px] ${
                isPicked
                  ? 'bg-accent-orange border-accent-orange text-white'
                  : 'border-border text-text-muted hover:border-accent-orange'
              }`}
            >
              {isPicked ? '★' : '☆'}
            </button>
            <div className="flex-1">
              <span className="text-sm text-text-secondary">{item}</span>
              <InlineTranslate text={item} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Quote cards — source-linked, picker-enabled
function QuoteList({
  path,
  items,
  humanDecisions,
  onDecisionsChange,
}: {
  path: string;
  items: { quote: string; source?: string; source_url?: string; emotion?: string }[];
  humanDecisions: Record<string, unknown>;
  onDecisionsChange: (next: Record<string, unknown>) => void;
}) {
  const picked = getPickedSet(humanDecisions, path);
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {items.map((q, i) => {
        const key = `${i}`;
        const isPicked = picked.has(key);
        return (
          <div
            key={i}
            className={`p-3 border-l-2 rounded ${
              isPicked
                ? 'border-accent-orange bg-accent-orange/10'
                : 'border-accent-teal/40 bg-bg-primary'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm italic text-text-secondary">&ldquo;{q.quote}&rdquo;</p>
                <InlineTranslate text={q.quote} />
              </div>
              <button
                type="button"
                onClick={() => onDecisionsChange(togglePicked(humanDecisions, path, key))}
                className={`shrink-0 text-xs ${
                  isPicked ? 'text-accent-orange' : 'text-text-muted hover:text-accent-orange'
                }`}
                title={isPicked ? 'Un-favorite' : 'Mark as favorite'}
              >
                {isPicked ? '★' : '☆'}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
              {q.emotion && <span className="px-1.5 py-0.5 bg-bg-card rounded">{q.emotion}</span>}
              {q.source_url ? (
                <a
                  href={q.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent-teal truncate"
                >
                  {q.source ?? q.source_url}
                </a>
              ) : (
                q.source && <span>{q.source}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Generic object card list
function ObjectCardList({
  path,
  items,
  humanDecisions,
  onDecisionsChange,
}: {
  path: string;
  items: Record<string, unknown>[];
  humanDecisions: Record<string, unknown>;
  onDecisionsChange: (next: Record<string, unknown>) => void;
}) {
  const picked = getPickedSet(humanDecisions, path);
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const key = `${i}`;
        const isPicked = picked.has(key);
        // Try to find a title-ish field. Expanded for deep-dive outputs
        // (Gate 2) where items rarely have "name"/"title" but do have
        // domain-specific keys like category / fear / objection / trigger.
        const TITLE_KEYS = [
          'name', 'title', 'label', 'headline', 'hook',
          'category', 'fear', 'objection', 'trigger', 'desire', 'solution',
          'source', 'belief', 'metaphor', 'competitor', 'segment', 'moment',
          'contradiction', 'dimension', 'question', 'quote', 'statement',
          'problem', 'struggle', 'pattern', 'type', 'id',
        ];
        const titleKey = TITLE_KEYS.find((k) => typeof item[k] === 'string');
        const rawTitle = titleKey ? String(item[titleKey]) : '';
        // Truncate long titles (quotes) so the card header stays tidy
        const title = rawTitle
          ? rawTitle.length > 120
            ? `${rawTitle.slice(0, 117)}…`
            : rawTitle
          : `Item ${i + 1}`;
        const rest = Object.entries(item).filter(([k]) => k !== titleKey);

        return (
          <div
            key={i}
            className={`p-3 rounded-lg border transition ${
              isPicked
                ? 'border-accent-orange bg-accent-orange/5'
                : 'border-border bg-bg-primary'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <div className="font-semibold text-text-primary text-sm">{title}</div>
                <InlineTranslate text={title} />
              </div>
              <button
                type="button"
                onClick={() => onDecisionsChange(togglePicked(humanDecisions, path, key))}
                className={`shrink-0 text-xs px-2 py-0.5 rounded border ${
                  isPicked
                    ? 'border-accent-orange text-accent-orange bg-accent-orange/10'
                    : 'border-border text-text-muted hover:text-accent-orange hover:border-accent-orange'
                }`}
              >
                {isPicked ? '★ Picked' : '☆ Pick'}
              </button>
            </div>
            {rest.length > 0 && (
              <div className="space-y-1.5">
                {rest.map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[10px] uppercase text-text-muted font-semibold">
                      {humanizeKey(k)}
                    </div>
                    <ValueRenderer
                      value={v}
                      path={`${path}[${i}].${k}`}
                      humanDecisions={humanDecisions}
                      onDecisionsChange={onDecisionsChange}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
