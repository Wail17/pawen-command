// ============================================================
// PAWEN — Gate 4 Copy Arsenal dedicated view
// Replaces SmartGateOutput for gate4. Tabs: Top 20 Hooks, All Hooks,
// Open Loops, Sensory, Future Pacing, Bucket Brigades, Takeaway,
// Customer Language Bank, Summary.
// ============================================================

'use client';

import { useMemo, useState, useCallback } from 'react';

type Dict = Record<string, unknown>;

interface Props {
  data: Dict;
  humanDecisions?: Dict;
  onDecisionsChange?: (next: Dict) => void;
  onAppendHooks?: (count: number) => Promise<void>;
  appendingHooks?: boolean;
}

function asStr(v: unknown, f = ''): string {
  return typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : f;
}
function asArr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function asDict(v: unknown): Dict {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {};
}

type TabId = 'top_hooks' | 'all_hooks' | 'open_loops' | 'sensory' | 'future_pacing' | 'bucket_brigades' | 'takeaway' | 'language' | 'summary';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'top_hooks', label: 'Top 20 Hooks', icon: '🏆' },
  { id: 'all_hooks', label: 'All Hooks', icon: '🎣' },
  { id: 'open_loops', label: 'Open Loops', icon: '🔁' },
  { id: 'sensory', label: 'Sensory', icon: '👁️' },
  { id: 'future_pacing', label: 'Future Pacing', icon: '🎬' },
  { id: 'bucket_brigades', label: 'Bucket Brigades', icon: '🚧' },
  { id: 'takeaway', label: 'Takeaway', icon: '💬' },
  { id: 'language', label: 'Language Bank', icon: '📚' },
  { id: 'summary', label: 'Summary', icon: '📊' },
];

export default function CopyArsenalView({ data, humanDecisions, onDecisionsChange, onAppendHooks, appendingHooks }: Props) {
  const [tab, setTab] = useState<TabId>('top_hooks');

  // After the compiler refactor (gate4.ts, Apr 2026), sub-agents emit their
  // sections at the top level and get backfilled in. Support BOTH the legacy
  // wrapped shape (data.hook_bank.*) and the new flat shape (data.hook_matrix).
  const rawHookBank = asDict(data.hook_bank);
  const hookBank: Dict = Object.keys(rawHookBank).length > 0 ? rawHookBank : {
    hook_matrix: data.hook_matrix,
    top_20_scored: data.top_20_scored,
    hooks_by_formula: data.hooks_by_formula,
    total_hooks_generated: data.total_hooks_generated,
  };
  const rawLanguageBank = asDict(data.customer_language_bank);
  const languageBank: Dict = Object.keys(rawLanguageBank).length > 0 ? rawLanguageBank : {
    micro_specific_moments: data.micro_specific_moments,
    internal_dialogue: data.internal_dialogue,
    relationship_moments: data.relationship_moments,
    humiliation_moments: data.humiliation_moments,
    failed_solution_language: data.failed_solution_language,
    transformation_language: data.transformation_language,
    trigger_phrases: data.trigger_phrases,
    top_10_phrases: data.top_10_phrases,
  };
  const openLoops = asDict(data.open_loops);
  const sensory = asDict(data.sensory_language);
  const futurePacingRaw = data.future_pacing ?? data.future_pacing_scenes;
  const futurePacing = asArr<Dict>(futurePacingRaw);
  const bucketBrigades = asDict(data.bucket_brigades);
  const takeaway = asDict(data.takeaway_copy);
  const summary = asDict(data.arsenal_summary);

  const top20 = asArr<Dict>(hookBank.top_20_scored);
  const hookMatrix = asArr<Dict>(hookBank.hook_matrix);

  const picked = useMemo(() => {
    const raw = humanDecisions?.picked;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string[]>) : {};
  }, [humanDecisions]);

  const togglePick = useCallback(
    (path: string, id: string) => {
      const current = new Set(picked[path] ?? []);
      if (current.has(id)) current.delete(id); else current.add(id);
      onDecisionsChange?.({ ...humanDecisions, picked: { ...picked, [path]: Array.from(current) } });
    },
    [humanDecisions, onDecisionsChange, picked],
  );
  const isPicked = (path: string, id: string) => (picked[path] ?? []).includes(id);

  return (
    <div className="space-y-4">
      {/* HERO — arsenal counts */}
      <div className="bg-gradient-to-br from-accent-orange/15 to-accent-teal/10 border border-accent-orange/40 rounded-xl p-5">
        <div className="text-xs uppercase tracking-wider text-accent-orange font-semibold mb-2">
          Copy Arsenal
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <StatCard label="Hooks" value={asStr(summary.total_hooks) || String(hookMatrix.length || top20.length || 0)} />
          <StatCard label="Open Loops" value={asStr(summary.total_open_loops) || '—'} />
          <StatCard label="Sensory Examples" value={asStr(summary.total_sensory_examples) || '—'} />
          <StatCard label="Bucket Brigades" value={asStr(summary.total_bucket_brigades) || '—'} />
        </div>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition ${
              tab === t.id ? 'bg-bg-card text-accent-orange border-b-2 border-accent-orange' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'top_hooks' && (
        <div className="space-y-2">
          {top20.length === 0 && <EmptyState />}
          {top20.map((h, i) => {
            const d = asDict(h);
            const text = asStr(d.hook) || asStr(d.text);
            const score = asStr(d.total_score) || asStr(d.score);
            const formula = asStr(d.formula);
            const subAvatar = asStr(d.sub_avatar);
            const hookId = asStr(d.id) || `top-${i}`;
            return (
              <div key={hookId} className="bg-bg-card border border-border rounded-lg p-4 flex items-start gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="text-xs text-accent-orange font-bold">#{i + 1}</div>
                  <button
                    onClick={() => togglePick('hooks/top_20', hookId)}
                    className={`text-lg ${isPicked('hooks/top_20', hookId) ? 'text-accent-orange' : 'text-text-muted hover:text-accent-orange'}`}
                    title="Favorite"
                  >
                    {isPicked('hooks/top_20', hookId) ? '★' : '☆'}
                  </button>
                </div>
                <div className="flex-1">
                  <p className="text-text-primary font-medium">{text}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {score && <span className="text-xs bg-accent-teal/20 text-accent-teal px-2 py-0.5 rounded-full">Score {score}</span>}
                    {formula && <span className="text-xs bg-bg-primary border border-border px-2 py-0.5 rounded-full text-text-muted">{formula}</span>}
                    {subAvatar && <span className="text-xs bg-bg-primary border border-border px-2 py-0.5 rounded-full text-text-muted">{subAvatar}</span>}
                  </div>
                  {!!d.feedback && <p className="text-xs text-text-muted mt-2 italic">{asStr(d.feedback)}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'all_hooks' && (
        <div className="space-y-4">
          {onAppendHooks && (
            <div className="bg-bg-card border border-accent-teal/40 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-semibold text-text-primary">Need more hooks?</div>
                <div className="text-xs text-text-muted">Generates NEW hooks excluding the ones you already have, keeps all other arsenal sections untouched.</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onAppendHooks(20)}
                  disabled={appendingHooks}
                  className="px-3 py-1.5 text-sm rounded-lg bg-accent-teal/20 text-accent-teal border border-accent-teal/40 hover:bg-accent-teal/30 disabled:opacity-50"
                >
                  {appendingHooks ? '…' : '+20 hooks'}
                </button>
                <button
                  onClick={() => onAppendHooks(30)}
                  disabled={appendingHooks}
                  className="px-3 py-1.5 text-sm rounded-lg bg-accent-orange/20 text-accent-orange border border-accent-orange/40 hover:bg-accent-orange/30 disabled:opacity-50"
                >
                  {appendingHooks ? '…' : '+30 hooks'}
                </button>
              </div>
            </div>
          )}
          {asArr<Dict>(humanDecisions?.additional_hook_waves).map((wave, wi) => {
            const w = asDict(wave);
            const hooks = asArr<Dict>(w.hooks);
            return (
              <div key={`wave-${wi}`} className="bg-bg-card border border-accent-teal/30 rounded-lg p-4">
                <div className="text-sm font-semibold text-accent-teal mb-3">
                  🌊 Wave {wi + 1} — {hooks.length} appended hooks
                  {!!w.generatedAt && <span className="ml-2 text-xs text-text-muted">{asStr(w.generatedAt)}</span>}
                </div>
                <div className="space-y-1.5">
                  {hooks.map((h, i) => {
                    const hd = asDict(h);
                    const text = asStr(hd.hook) || asStr(hd.hook_text) || asStr(hd.text);
                    const hookId = `wave-${wi}-${asStr(hd.id) || i}`;
                    return (
                      <div key={hookId} className="flex items-start gap-2 text-sm">
                        <button
                          onClick={() => togglePick('hooks/waves', hookId)}
                          className={`${isPicked('hooks/waves', hookId) ? 'text-accent-orange' : 'text-text-muted hover:text-accent-orange'}`}
                        >
                          {isPicked('hooks/waves', hookId) ? '★' : '☆'}
                        </button>
                        <span className="text-text-primary flex-1">{text}</span>
                        {!!hd.formula && <span className="text-xs text-text-muted">({asStr(hd.formula)})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {hookMatrix.map((group, gi) => {
            const g = asDict(group);
            const hooks = asArr<Dict>(g.hooks);
            return (
              <div key={gi} className="bg-bg-card border border-border rounded-lg p-4">
                <div className="text-sm font-semibold text-accent-orange mb-3">
                  {asStr(g.sub_avatar) || `Sub-Avatar ${gi + 1}`}
                  {!!g.angle && <span className="ml-2 text-xs text-text-muted">/ {asStr(g.angle)}</span>}
                </div>
                <div className="space-y-1.5">
                  {hooks.map((h, i) => {
                    const hd = asDict(h);
                    const text = asStr(hd.hook) || asStr(hd.text) || asStr(h);
                    const hookId = asStr(hd.id) || `${gi}-${i}`;
                    return (
                      <div key={hookId} className="flex items-start gap-2 text-sm">
                        <button
                          onClick={() => togglePick('hooks/all', hookId)}
                          className={`${isPicked('hooks/all', hookId) ? 'text-accent-orange' : 'text-text-muted hover:text-accent-orange'}`}
                        >
                          {isPicked('hooks/all', hookId) ? '★' : '☆'}
                        </button>
                        <span className="text-text-primary flex-1">{text}</span>
                        {!!hd.formula && <span className="text-xs text-text-muted">({asStr(hd.formula)})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <FormulaBreakdown formulas={asDict(hookBank.hooks_by_formula)} />
        </div>
      )}

      {tab === 'open_loops' && (
        <div className="space-y-4">
          {Object.entries(openLoops).map(([cat, items]) => (
            <Category key={cat} title={cat} items={asArr<unknown>(items).map(it => {
              const d = asDict(it);
              return asStr(d.loop) || asStr(d.text) || asStr(it);
            })} path={`open_loops/${cat}`} picked={picked} togglePick={togglePick} />
          ))}
        </div>
      )}

      {tab === 'sensory' && (
        <div className="space-y-4">
          {(['sight', 'sound', 'touch', 'smell', 'taste'] as const).map(sense => {
            const s = asDict(sensory[sense]);
            if (!s || Object.keys(s).length === 0) return null;
            return (
              <div key={sense} className="bg-bg-card border border-border rounded-lg p-4">
                <div className="text-sm font-semibold text-accent-teal uppercase mb-3">{sense}</div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-warning uppercase mb-2">Pain</div>
                    <ul className="space-y-1">
                      {asArr<unknown>(s.pain).map((p, i) => (
                        <li key={i} className="text-sm text-text-primary">{asStr(p)}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs text-success uppercase mb-2">Transformation</div>
                    <ul className="space-y-1">
                      {asArr<unknown>(s.transformation).map((p, i) => (
                        <li key={i} className="text-sm text-text-primary">{asStr(p)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
          <BulletList title="Sensory Phrases Bank" items={asArr<unknown>(sensory.sensory_phrases_bank).map((x) => asStr(x))} path="sensory/bank" picked={picked} togglePick={togglePick} />
        </div>
      )}

      {tab === 'future_pacing' && (
        <div className="space-y-4">
          {futurePacing.map((scene, i) => {
            const s = asDict(scene);
            return (
              <div key={i} className="bg-bg-card border border-border rounded-lg p-5">
                <div className="text-xs uppercase tracking-wider text-accent-orange font-semibold mb-2">
                  Scene {i + 1}{s.title ? ` - ${asStr(s.title)}` : ''}
                </div>
                <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
                  {asStr(s.scene) || asStr(s.text) || asStr(s.body) || JSON.stringify(s, null, 2)}
                </p>
                {!!s.word_count && <p className="text-xs text-text-muted mt-3">{asStr(s.word_count)} words</p>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'bucket_brigades' && (
        <div className="space-y-4">
          {Object.entries(bucketBrigades).map(([cat, items]) => (
            <div key={cat} className="bg-bg-card border border-border rounded-lg p-4">
              <div className="text-sm font-semibold text-accent-orange uppercase mb-3">{cat}</div>
              <div className="flex flex-wrap gap-2">
                {asArr<unknown>(items).map((b, i) => (
                  <span key={i} className="px-3 py-1 bg-bg-primary border border-border rounded-full text-sm text-text-primary">
                    {asStr(b)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'takeaway' && (
        <div className="space-y-4">
          {Object.entries(takeaway).map(([cat, items]) => (
            <Category key={cat} title={cat} items={asArr<unknown>(items).map((x) => asStr(x))} path={`takeaway/${cat}`} picked={picked} togglePick={togglePick} />
          ))}
        </div>
      )}

      {tab === 'language' && (
        <div className="space-y-4">
          {['top_10_phrases', 'micro_specific_moments', 'internal_dialogue', 'relationship_moments', 'humiliation_moments', 'failed_solution_language', 'transformation_language', 'trigger_phrases'].map(key => (
            <Category
              key={key}
              title={key.replace(/_/g, ' ')}
              items={asArr<unknown>(languageBank[key]).map((x) => asStr(x))}
              path={`language/${key}`}
              picked={picked}
              togglePick={togglePick}
              highlight={key === 'top_10_phrases'}
            />
          ))}
        </div>
      )}

      {tab === 'summary' && (
        <div className="space-y-3">
          {!!summary.strongest_sub_avatar && (
            <div className="bg-success/10 border border-success/30 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-success font-semibold mb-1">Strongest Sub-Avatar</div>
              <p className="text-text-primary">{asStr(summary.strongest_sub_avatar)}</p>
            </div>
          )}
          {!!summary.weakest_sub_avatar && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-warning font-semibold mb-1">Weakest Sub-Avatar</div>
              <p className="text-text-primary">{asStr(summary.weakest_sub_avatar)}</p>
            </div>
          )}
          {Array.isArray(summary.recommended_hook_loop_combos) && (
            <BulletList title="Recommended Hook + Loop Combos" items={asArr<unknown>(summary.recommended_hook_loop_combos).map((x) => asStr(x))} path="summary/combos" picked={picked} togglePick={togglePick} />
          )}
          {Array.isArray(summary.gaps_identified) && (
            <BulletList title="Gaps Identified" items={asArr<unknown>(summary.gaps_identified).map((x) => asStr(x))} path="summary/gaps" picked={picked} togglePick={togglePick} />
          )}
          {!!summary.strategic_notes && (
            <div className="bg-bg-card border border-accent-teal/30 rounded-lg p-5">
              <div className="text-xs uppercase tracking-wider text-accent-teal font-semibold mb-2">Strategic Notes</div>
              <p className="text-text-primary whitespace-pre-wrap leading-relaxed">{asStr(summary.strategic_notes)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3">
      <div className="text-2xl font-bold text-accent-orange">{value}</div>
      <div className="text-xs text-text-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}

function Category({
  title, items, path, picked, togglePick, highlight,
}: {
  title: string; items: string[]; path: string;
  picked: Record<string, string[]>; togglePick: (path: string, id: string) => void;
  highlight?: boolean;
}) {
  if (!items.length) return null;
  const isPicked = (id: string) => (picked[path] ?? []).includes(id);
  return (
    <div className={`border rounded-lg p-4 ${highlight ? 'bg-accent-orange/5 border-accent-orange/30' : 'bg-bg-card border-border'}`}>
      <div className="text-sm font-semibold uppercase mb-3 text-accent-orange">{title}</div>
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const id = `${i}-${item.slice(0, 20)}`;
          return (
            <div key={id} className="flex items-start gap-2 text-sm">
              <button
                onClick={() => togglePick(path, id)}
                className={`${isPicked(id) ? 'text-accent-orange' : 'text-text-muted hover:text-accent-orange'}`}
              >
                {isPicked(id) ? '★' : '☆'}
              </button>
              <span className="text-text-primary flex-1">{item}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BulletList({
  title, items, path, picked, togglePick,
}: {
  title: string; items: string[]; path: string;
  picked: Record<string, string[]>; togglePick: (path: string, id: string) => void;
}) {
  return <Category title={title} items={items} path={path} picked={picked} togglePick={togglePick} />;
}

function FormulaBreakdown({ formulas }: { formulas: Dict }) {
  const entries = Object.entries(formulas).filter(([, v]) => typeof v === 'number' && v > 0);
  if (entries.length === 0) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <div className="text-sm font-semibold uppercase mb-3 text-text-muted">Hooks by Formula</div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([k, v]) => (
          <span key={k} className="px-3 py-1 bg-bg-primary border border-border rounded-full text-sm">
            <span className="text-text-muted">{k}</span> <span className="text-accent-orange font-bold">{String(v)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return <p className="text-sm text-text-muted italic">No top-20 hooks in this output. Check the All Hooks tab.</p>;
}
