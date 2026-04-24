// ============================================================
// PAWEN — Gate 3 Mechanism & Root Cause dedicated view
// Replaces SmartGateOutput for gate3. Hero shows mechanism name +
// aha moment. Tabs: Mechanism, Root Cause, Belief Error, Villains,
// UGC, Copy Variations, Narrative, Synthesis.
// ============================================================

'use client';

import { useMemo, useState, useCallback } from 'react';

type Dict = Record<string, unknown>;

interface Props {
  data: Dict;
  humanDecisions?: Dict;
  onDecisionsChange?: (next: Dict) => void;
}

function asStr(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function asArr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asDict(v: unknown): Dict {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {};
}

type TabId = 'mechanism' | 'root_cause' | 'belief_error' | 'villains' | 'ugc' | 'copy' | 'narrative' | 'synthesis';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'mechanism', label: 'Mechanism', icon: '⚙️' },
  { id: 'root_cause', label: 'Root Cause', icon: '🎯' },
  { id: 'belief_error', label: 'Belief Error', icon: '💡' },
  { id: 'villains', label: 'Villains', icon: '👹' },
  { id: 'ugc', label: 'UGC Scripts', icon: '🎬' },
  { id: 'copy', label: 'Copy Variations', icon: '✍️' },
  { id: 'narrative', label: 'Narrative Arc', icon: '📖' },
  { id: 'synthesis', label: 'Synthesis', icon: '🧠' },
];

export default function MechanismView({ data, humanDecisions, onDecisionsChange }: Props) {
  const [tab, setTab] = useState<TabId>('mechanism');
  const [copyLead, setCopyLead] = useState<'pain_lead' | 'curiosity_lead' | 'anger_lead' | 'story_lead'>('curiosity_lead');

  const mechanism = asDict(data.mechanism);
  const rootCause = asDict(data.root_cause);
  const beliefError = asDict(data.belief_error);
  const villains = asDict(data.villains);
  const ugc = asDict(data.ugc_talking_points);
  const narrative = asDict(data.narrative_alignment);
  const copyVariations = asDict(data.copy_master_variations);
  const synthesis = asStr(data.strategic_synthesis);

  const mechName = asStr(mechanism.name);
  const mechTagline = asStr(mechanism.tagline);
  const ahaMoment = asStr(rootCause.aha_moment);
  const steps = asArr<Dict>(mechanism.steps);

  const picked = useMemo(() => {
    const raw = humanDecisions?.picked;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string[]>) : {};
  }, [humanDecisions]);

  const togglePick = useCallback(
    (path: string, id: string) => {
      const current = new Set(picked[path] ?? []);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      const next = { ...picked, [path]: Array.from(current) };
      onDecisionsChange?.({ ...humanDecisions, picked: next });
    },
    [humanDecisions, onDecisionsChange, picked],
  );

  const isPicked = (path: string, id: string) => (picked[path] ?? []).includes(id);

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="bg-gradient-to-br from-accent-orange/15 to-accent-teal/10 border border-accent-orange/40 rounded-xl p-5">
        <div className="text-xs uppercase tracking-wider text-accent-orange font-semibold mb-2">
          🔒 Locked Mechanism
        </div>
        <h1 className="text-2xl font-bold text-text-primary">{mechName || '—'}</h1>
        {mechTagline && <p className="text-accent-teal text-sm mt-1 italic">{mechTagline}</p>}
        {ahaMoment && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-1">
              The Aha Moment
            </div>
            <p className="text-lg text-text-primary leading-relaxed">&ldquo;{ahaMoment}&rdquo;</p>
          </div>
        )}
      </div>

      {/* TABS */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition ${
              tab === t.id
                ? 'bg-bg-card text-accent-orange border-b-2 border-accent-orange'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* MECHANISM */}
      {tab === 'mechanism' && (
        <div className="space-y-4">
          <Section title="How It Works (Simple)" body={asStr(mechanism.how_it_works_simple)} />
          <Section title="How It Works (Technical)" body={asStr(mechanism.how_it_works_technical)} collapsed />

          {steps.length > 0 && (
            <div>
              <h3 className="text-sm uppercase tracking-wider text-text-muted font-semibold mb-3">
                The 3 Steps
              </h3>
              <div className="grid md:grid-cols-3 gap-3">
                {steps.slice(0, 3).map((step, i) => {
                  const s = asDict(step);
                  return (
                    <div key={i} className="bg-bg-card border border-border rounded-lg p-4">
                      <div className="text-xs text-accent-orange font-bold mb-1">STEP {i + 1}</div>
                      <div className="font-bold text-text-primary">{asStr(s.name) || `Step ${i + 1}`}</div>
                      {!!s.description && (
                        <p className="text-sm text-text-secondary mt-2">{asStr(s.description)}</p>
                      )}
                      {!!s.mechanism && (
                        <p className="text-xs text-text-muted mt-2 italic">{asStr(s.mechanism)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <CopyReadyPanel title="Copy-Ready Sections" data={asDict(mechanism.copy_ready)} />
          <CopyReadyPanel
            title="Simplified / Copy-Ready (ZAK Phase 2)"
            data={asDict(asDict(mechanism.simplified).copy_ready_section)}
          />

          <AlternativeNames names={asArr(mechanism.alternative_names)} />
        </div>
      )}

      {/* ROOT CAUSE */}
      {tab === 'root_cause' && (
        <div className="space-y-4">
          <Section title="Simplified Root Cause" body={asStr(asDict(rootCause.simplified).summary) || asStr(rootCause.simplified)} />
          <Section title="Raw Research" body={asStr(asDict(rootCause.raw_research).summary)} collapsed />
          <CopyReadyPanel title="Copy-Ready Versions" data={asDict(rootCause.copy_ready)} />
          <ProofStack proof={asArr(rootCause.proof_stack)} />
        </div>
      )}

      {/* BELIEF ERROR */}
      {tab === 'belief_error' && (
        <div className="space-y-4">
          <BeliefPrimary belief={asDict(beliefError.primary_false_belief)} />
          <BulletList
            title="Supporting False Beliefs"
            items={asArr<Dict>(beliefError.supporting_false_beliefs).map(b => asStr(b.belief) || JSON.stringify(b))}
          />
          <Section title="Belief Ecosystem" body={JSON.stringify(beliefError.belief_ecosystem, null, 2)} collapsed code />
          <Section title="Copy Architecture" body={JSON.stringify(beliefError.copy_architecture, null, 2)} collapsed code />
        </div>
      )}

      {/* VILLAINS */}
      {tab === 'villains' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <VillainCard label="Hidden Enemy" icon="🎭" data={asDict(villains.hidden_enemy)} />
            <VillainCard label="The System" icon="🏛️" data={asDict(villains.the_system)} />
            <VillainCard label="Self-Saboteur" icon="🪞" data={asDict(villains.the_self_saboteur)} />
          </div>
          <Section title="Hierarchy" body={JSON.stringify(villains.hierarchy, null, 2)} collapsed code />
          <BulletList
            title="Combinations"
            items={asArr<Dict>(villains.combinations).map(c => asStr(c.description) || JSON.stringify(c))}
          />
        </div>
      )}

      {/* UGC */}
      {tab === 'ugc' && (
        <div className="space-y-4">
          <UGCClip label="Root Cause Clip" clip={asDict(ugc.root_cause_clip)} />
          <BulletList title="Root Cause Talking Points" items={asArr<string>(ugc.root_cause_talking_points)} />
          <UGCClip label="Mechanism Clip" clip={asDict(ugc.mechanism_clip)} />
          <BulletList title="Mechanism Talking Points" items={asArr<string>(ugc.mechanism_talking_points)} />
          <UGCClip label="Combined Script" clip={asDict(ugc.combined_script)} highlight />

          <div>
            <h3 className="text-sm uppercase tracking-wider text-text-muted font-semibold mb-2">
              Root Cause Hooks
            </h3>
            <div className="space-y-2">
              {asArr<Dict>(ugc.root_cause_hooks).map((hook, i) => {
                const hookId = `hook-${i}`;
                const text = asStr(hook.hook) || asStr(hook.text);
                const score = asStr(hook.score) || asStr(hook.scroll_stop_score);
                return (
                  <div key={i} className="flex items-start gap-2 bg-bg-card border border-border rounded-lg p-3">
                    <button
                      onClick={() => togglePick('ugc/root_cause_hooks', hookId)}
                      className={`text-lg ${isPicked('ugc/root_cause_hooks', hookId) ? 'text-accent-orange' : 'text-text-muted hover:text-accent-orange'}`}
                      title="Favorite"
                    >
                      {isPicked('ugc/root_cause_hooks', hookId) ? '★' : '☆'}
                    </button>
                    <div className="flex-1">
                      <p className="text-text-primary">{text}</p>
                      {score && <span className="text-xs text-accent-teal">Score: {score}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <BulletList
            title="Villain Scripts"
            items={asArr<Dict>(ugc.villain_scripts).map(v => asStr(v.script) || JSON.stringify(v))}
          />
          <BulletList
            title="Combo Scripts"
            items={asArr<Dict>(ugc.combo_scripts).map(v => asStr(v.script) || JSON.stringify(v))}
          />
        </div>
      )}

      {/* COPY VARIATIONS */}
      {tab === 'copy' && (
        <div className="space-y-4">
          <div className="flex gap-1 bg-bg-card border border-border rounded-lg p-1 w-fit">
            {(['pain_lead', 'curiosity_lead', 'anger_lead', 'story_lead'] as const).map(k => (
              <button
                key={k}
                onClick={() => setCopyLead(k)}
                className={`px-3 py-1.5 text-sm rounded ${
                  copyLead === k ? 'bg-accent-orange text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {k.replace('_lead', '').toUpperCase()}
              </button>
            ))}
          </div>
          <div className="bg-bg-card border border-border rounded-lg p-5">
            <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
              {asStr(copyVariations[copyLead]) || '—'}
            </p>
          </div>
        </div>
      )}

      {/* NARRATIVE */}
      {tab === 'narrative' && (
        <div className="space-y-3">
          {Object.entries(narrative).map(([k, v]) => (
            <div key={k} className="bg-bg-card border border-border rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-2">
                {k.replace(/_/g, ' ')}
              </div>
              <p className="text-text-primary whitespace-pre-wrap">{asStr(v)}</p>
            </div>
          ))}
        </div>
      )}

      {/* SYNTHESIS */}
      {tab === 'synthesis' && (
        <div className="bg-gradient-to-br from-accent-teal/10 to-accent-orange/10 border border-accent-teal/30 rounded-xl p-5">
          <h3 className="text-sm uppercase tracking-wider text-accent-teal font-semibold mb-3">
            Strategic Synthesis
          </h3>
          <p className="text-text-primary whitespace-pre-wrap leading-relaxed">{synthesis || '—'}</p>
        </div>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

function Section({ title, body, collapsed, code }: { title: string; body: string; collapsed?: boolean; code?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  if (!body || body === 'null' || body === '{}' || body === 'undefined') return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-bg-card-hover"
      >
        <span className="text-sm uppercase tracking-wider text-text-muted font-semibold">{title}</span>
        <span className="text-text-muted">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {code ? (
            <pre className="text-xs text-text-secondary bg-bg-primary p-3 rounded overflow-auto">{body}</pre>
          ) : (
            <p className="text-text-primary whitespace-pre-wrap">{body}</p>
          )}
        </div>
      )}
    </div>
  );
}

function CopyReadyPanel({ title, data }: { title: string; data: Dict }) {
  const entries = Object.entries(data).filter(([, v]) => typeof v === 'string' && v.length > 0);
  if (entries.length === 0) return null;
  return (
    <div className="bg-bg-card border border-accent-teal/30 rounded-lg p-4">
      <h3 className="text-sm uppercase tracking-wider text-accent-teal font-semibold mb-3">✨ {title}</h3>
      <div className="space-y-3">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-text-muted mb-1">{k.replace(/_/g, ' ')}</div>
            <p className="text-text-primary bg-bg-primary border border-border rounded p-3 whitespace-pre-wrap text-sm">
              {String(v)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlternativeNames({ names }: { names: unknown[] }) {
  if (!names.length) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm uppercase tracking-wider text-text-muted font-semibold mb-3">
        Alternative Names Considered
      </h3>
      <div className="flex flex-wrap gap-2">
        {names.map((n, i) => (
          <span key={i} className="px-3 py-1 bg-bg-primary border border-border rounded-full text-sm text-text-secondary">
            {asStr(n) || JSON.stringify(n)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProofStack({ proof }: { proof: unknown[] }) {
  if (!proof.length) return null;
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-text-muted font-semibold mb-2">
        Proof Stack
      </h3>
      <div className="space-y-2">
        {proof.map((p, i) => {
          const d = asDict(p);
          return (
            <div key={i} className="bg-bg-card border border-border rounded-lg p-3">
              <p className="text-text-primary text-sm">{asStr(d.claim) || asStr(p)}</p>
              {!!d.source && <p className="text-xs text-text-muted mt-1">Source: {asStr(d.source)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BeliefPrimary({ belief }: { belief: Dict }) {
  if (!belief || Object.keys(belief).length === 0) return null;
  return (
    <div className="bg-gradient-to-br from-warning/10 to-accent-orange/10 border border-warning/40 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-warning font-semibold mb-2">
        💡 Primary False Belief
      </div>
      {!!belief.belief && (
        <p className="text-lg text-text-primary font-medium mb-3">&ldquo;{asStr(belief.belief)}&rdquo;</p>
      )}
      {!!belief.why_wrong && (
        <div className="mt-3 pt-3 border-t border-warning/30">
          <div className="text-xs text-text-muted mb-1">Why it&apos;s wrong</div>
          <p className="text-text-primary text-sm">{asStr(belief.why_wrong)}</p>
        </div>
      )}
      {!!belief.correction && (
        <div className="mt-3 pt-3 border-t border-warning/30">
          <div className="text-xs text-text-muted mb-1">Correction</div>
          <p className="text-text-primary text-sm">{asStr(belief.correction)}</p>
        </div>
      )}
    </div>
  );
}

function VillainCard({ label, icon, data }: { label: string; icon: string; data: Dict }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs uppercase tracking-wider text-accent-orange font-semibold mb-2">{label}</div>
      {!!data.name && <div className="font-bold text-text-primary mb-1">{asStr(data.name)}</div>}
      {!!data.description && <p className="text-sm text-text-secondary">{asStr(data.description)}</p>}
      {!!data.attack_line && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs text-text-muted">Attack line</div>
          <p className="text-sm text-text-primary italic">&ldquo;{asStr(data.attack_line)}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

function UGCClip({ label, clip, highlight }: { label: string; clip: Dict; highlight?: boolean }) {
  if (!clip || Object.keys(clip).length === 0) return null;
  const script = asStr(clip.script) || asStr(clip.monologue) || asStr(clip.text);
  if (!script) return null;
  return (
    <div className={`border rounded-lg p-4 ${highlight ? 'bg-accent-orange/10 border-accent-orange/40' : 'bg-bg-card border-border'}`}>
      <div className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-2">{label}</div>
      <p className="text-text-primary whitespace-pre-wrap leading-relaxed text-sm">{script}</p>
      {!!clip.word_count && (
        <p className="text-xs text-text-muted mt-2">{asStr(clip.word_count)} words</p>
      )}
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-sm uppercase tracking-wider text-text-muted font-semibold mb-2">{title}</h3>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-text-primary text-sm bg-bg-card border border-border rounded px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
