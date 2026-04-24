// ============================================================
// PAWEN — Gate 5 Copy Format dedicated view (if/else dispatch)
// Based on project.selectedCopyFormat:
//   - advertorial → AdvertorialView (long-form 3000-5000 words)
//   - native      → NativeAdView (300-600 word first-person story)
//   - listicle    → ListicleView (numbered items + image beats)
//   - skipped     → SkippedView (user chose to skip Gate 5)
// ============================================================

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Project } from '@/lib/types';

type Dict = Record<string, unknown>;

interface Props {
  data: Dict;
  project: Project;
  humanDecisions?: Dict;
  onDecisionsChange?: (next: Dict) => void;
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

export default function Gate5FormatView({ data, project, humanDecisions, onDecisionsChange }: Props) {
  const format = project.selectedCopyFormat ?? 'advertorial';

  if (format === 'skipped') {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">⤼</div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Gate 5 Skipped</h2>
        <p className="text-text-secondary">
          You chose to skip Gate 5 (Copy). Downstream gates (Gate 6+) are unlocked and will work
          directly from Gate 4&apos;s copy arsenal.
        </p>
      </div>
    );
  }

  if (format === 'native') return <NativeAdView data={data} project={project} humanDecisions={humanDecisions} onDecisionsChange={onDecisionsChange} />;
  if (format === 'listicle') return <ListicleView data={data} project={project} humanDecisions={humanDecisions} onDecisionsChange={onDecisionsChange} />;
  return <AdvertorialView data={data} project={project} humanDecisions={humanDecisions} onDecisionsChange={onDecisionsChange} />;
}

// ============================================================
// ADVERTORIAL
// ============================================================

function AdvertorialView({ data, project, humanDecisions, onDecisionsChange }: Props) {
  const advertorialEn = asStr(data.advertorial_en);
  const localeKey = `advertorial_${project.targetLanguage}`;
  const advertorialLocal = asStr(data[localeKey]);
  const metadata = asDict(data.metadata);
  const headlineOptions = asArr<unknown>(data.headline_options).map((x) => asStr(x));
  const subheadline = asStr(data.subheadline);

  const [lang, setLang] = useState<'en' | 'local'>(advertorialLocal ? 'local' : 'en');
  const selectedText = lang === 'local' ? advertorialLocal : advertorialEn;

  const picked = useMemo(() => {
    const raw = humanDecisions?.picked;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string[]>) : {};
  }, [humanDecisions]);

  const togglePick = useCallback((path: string, id: string) => {
    const current = new Set(picked[path] ?? []);
    if (current.has(id)) current.delete(id); else current.add(id);
    onDecisionsChange?.({ ...humanDecisions, picked: { ...picked, [path]: Array.from(current) } });
  }, [humanDecisions, onDecisionsChange, picked]);

  const copyText = () => navigator.clipboard.writeText(selectedText).catch(() => {});

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-accent-orange/15 to-accent-teal/10 border border-accent-orange/40 rounded-xl p-5">
        <div className="text-xs uppercase tracking-wider text-accent-orange font-semibold mb-2">
          📰 Advertorial — ZAK 7-Block
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Stat label="Archetype" value={asStr(metadata.archetype_used)} />
          <Stat label="Mechanism" value={asStr(metadata.mechanism_name)} />
          <Stat label="Words EN" value={asStr(metadata.word_count_en)} />
          <Stat label={`Words ${project.targetLanguage}`} value={asStr(metadata[`word_count_${project.targetLanguage}`])} />
        </div>
      </div>

      {headlineOptions.length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="text-sm font-semibold uppercase text-accent-orange mb-3">Headline Options (pick your winner)</div>
          <div className="space-y-2">
            {headlineOptions.map((h, i) => {
              const id = `h-${i}`;
              const isPicked = (picked.headline_options ?? []).includes(id);
              return (
                <button
                  key={id}
                  onClick={() => togglePick('headline_options', id)}
                  className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded border transition ${
                    isPicked ? 'bg-accent-orange/10 border-accent-orange' : 'border-border hover:bg-bg-card-hover'
                  }`}
                >
                  <span className={isPicked ? 'text-accent-orange' : 'text-text-muted'}>{isPicked ? '★' : '☆'}</span>
                  <span className="text-text-primary">{h}</span>
                </button>
              );
            })}
          </div>
          {subheadline && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-xs text-text-muted uppercase mb-1">Subheadline</div>
              <p className="text-text-primary italic">{subheadline}</p>
            </div>
          )}
        </div>
      )}

      {/* Lang toggle + copy button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-bg-card border border-border rounded-lg p-1">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 text-sm rounded ${lang === 'en' ? 'bg-accent-orange text-white' : 'text-text-secondary hover:text-text-primary'}`}
          >
            EN
          </button>
          {advertorialLocal && (
            <button
              onClick={() => setLang('local')}
              className={`px-3 py-1.5 text-sm rounded ${lang === 'local' ? 'bg-accent-orange text-white' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {project.targetLanguage.toUpperCase()}
            </button>
          )}
        </div>
        <button
          onClick={copyText}
          className="px-3 py-1.5 text-sm bg-bg-card border border-border rounded-lg hover:bg-bg-card-hover text-text-secondary"
        >
          📋 Copy text
        </button>
      </div>

      {/* Long-form reader */}
      <article className="bg-bg-card border border-border rounded-lg p-6 md:p-8 max-w-none">
        <p className="text-text-primary whitespace-pre-wrap leading-[1.7] text-[15px]">
          {selectedText || '—'}
        </p>
      </article>

      {/* Emotional arc */}
      {Array.isArray(metadata.emotional_arc) && asArr<unknown>(metadata.emotional_arc).length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="text-xs font-semibold uppercase text-text-muted mb-2">Emotional Arc</div>
          <div className="flex flex-wrap items-center gap-2">
            {asArr<unknown>(metadata.emotional_arc).map((e, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-accent-teal/20 text-accent-teal rounded-full text-xs">{asStr(e)}</span>
                {i < asArr<unknown>(metadata.emotional_arc).length - 1 && <span className="text-text-muted">→</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// NATIVE AD
// ============================================================

function NativeAdView({ data, project, humanDecisions, onDecisionsChange }: Props) {
  const nativeEn = asStr(data.native_ad_en);
  const localeKey = `native_ad_${project.targetLanguage}`;
  const nativeLocal = asStr(data[localeKey]);
  const metadata = asDict(data.metadata);
  const primaryVariants = asArr<unknown>(data.primary_text_variants).map((x) => asStr(x));
  const creativeBrief = asDict(data.creative_brief_handoff);

  const [lang, setLang] = useState<'en' | 'local'>(nativeLocal ? 'local' : 'en');
  const text = lang === 'local' ? nativeLocal : nativeEn;

  const picked = useMemo(() => {
    const raw = humanDecisions?.picked;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, string[]>) : {};
  }, [humanDecisions]);

  const togglePick = useCallback((path: string, id: string) => {
    const current = new Set(picked[path] ?? []);
    if (current.has(id)) current.delete(id); else current.add(id);
    onDecisionsChange?.({ ...humanDecisions, picked: { ...picked, [path]: Array.from(current) } });
  }, [humanDecisions, onDecisionsChange, picked]);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-accent-teal/15 to-accent-orange/10 border border-accent-teal/40 rounded-xl p-5">
        <div className="text-xs uppercase tracking-wider text-accent-teal font-semibold mb-2">
          🗣️ Native Ad — First-Person Story
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Stat label="Character" value={asStr(metadata.character_type)} />
          <Stat label="Hook" value={asStr(metadata.hook_mechanism)} />
          <Stat label="Words EN" value={asStr(metadata.word_count_en)} />
          <Stat label={`Words ${project.targetLanguage}`} value={asStr(metadata[`word_count_${project.targetLanguage}`])} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-bg-card border border-border rounded-lg p-1">
          <button onClick={() => setLang('en')} className={`px-3 py-1.5 text-sm rounded ${lang === 'en' ? 'bg-accent-teal text-white' : 'text-text-secondary'}`}>EN</button>
          {nativeLocal && (
            <button onClick={() => setLang('local')} className={`px-3 py-1.5 text-sm rounded ${lang === 'local' ? 'bg-accent-teal text-white' : 'text-text-secondary'}`}>
              {project.targetLanguage.toUpperCase()}
            </button>
          )}
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(text).catch(() => {})}
          className="px-3 py-1.5 text-sm bg-bg-card border border-border rounded-lg hover:bg-bg-card-hover text-text-secondary"
        >
          📋 Copy
        </button>
      </div>

      {/* Story — tight reader, evokes IG/Reddit feed */}
      <article className="bg-bg-card border border-border rounded-lg p-6 max-w-2xl mx-auto">
        <p className="text-text-primary whitespace-pre-wrap leading-relaxed">{text || '—'}</p>
      </article>

      {primaryVariants.length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="text-sm font-semibold uppercase text-accent-teal mb-3">Alternative Opening Lines</div>
          <div className="space-y-2">
            {primaryVariants.map((v, i) => {
              const id = `var-${i}`;
              const isPicked = (picked.primary_variants ?? []).includes(id);
              return (
                <button
                  key={id}
                  onClick={() => togglePick('primary_variants', id)}
                  className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded border ${
                    isPicked ? 'bg-accent-teal/10 border-accent-teal' : 'border-border hover:bg-bg-card-hover'
                  }`}
                >
                  <span className={isPicked ? 'text-accent-teal' : 'text-text-muted'}>{isPicked ? '★' : '☆'}</span>
                  <span className="text-text-primary italic">&ldquo;{v}&rdquo;</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {Object.keys(creativeBrief).length > 0 && (
        <div className="bg-bg-card border border-accent-orange/30 rounded-lg p-4">
          <div className="text-sm font-semibold uppercase text-accent-orange mb-3">🎬 Image Beats (handoff to creative)</div>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { key: 'image_beat_a', label: 'Beat A — Problem Artifact' },
              { key: 'image_beat_b', label: 'Beat B — Private Evidence' },
              { key: 'image_beat_c', label: 'Beat C — Low Point' },
              { key: 'reveal_image', label: 'Reveal — Product Shot' },
            ].map(({ key, label }) => {
              const v = asStr(creativeBrief[key]);
              if (!v) return null;
              return (
                <div key={key} className="bg-bg-primary border border-border rounded p-3">
                  <div className="text-xs font-semibold text-text-muted mb-1">{label}</div>
                  <p className="text-sm text-text-primary">{v}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Array.isArray(metadata.verbatims_used) && asArr<unknown>(metadata.verbatims_used).length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="text-xs font-semibold uppercase text-text-muted mb-2">Verbatims Used</div>
          <div className="flex flex-wrap gap-1.5">
            {asArr<unknown>(metadata.verbatims_used).map((v, i) => (
              <span key={i} className="px-2 py-0.5 bg-bg-primary border border-border rounded-full text-xs text-text-secondary">
                &ldquo;{asStr(v)}&rdquo;
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LISTICLE
// ============================================================

function ListicleView({ data, project, humanDecisions: _hd, onDecisionsChange: _odc }: Props) {
  const title = asStr(data.title) || asStr((data as Dict).final_en && asDict(data.final_en).title);
  const items = asArr<Dict>(data.items);
  const close = asStr(data.close);
  const finalEn = asDict(data.final_en);
  const localeKey = `final_${project.targetLanguage}`;
  const finalLocal = asDict(data[localeKey]);

  const [lang, setLang] = useState<'en' | 'local'>(Object.keys(finalLocal).length > 0 ? 'local' : 'en');
  const active = lang === 'local' ? finalLocal : (Object.keys(finalEn).length > 0 ? finalEn : data);
  const activeTitle = asStr(active.title) || title;
  const activeItems = asArr<Dict>(active.items).length > 0 ? asArr<Dict>(active.items) : items;
  const activeClose = asStr(active.close) || close;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-accent-orange/15 to-accent-teal/10 border border-accent-orange/40 rounded-xl p-5">
        <div className="text-xs uppercase tracking-wider text-accent-orange font-semibold mb-2">
          📋 Listicle Ad — Numbered Story
        </div>
        <h1 className="text-2xl font-bold text-text-primary mt-2">{activeTitle || '—'}</h1>
      </div>

      {Object.keys(finalLocal).length > 0 && (
        <div className="flex gap-1 bg-bg-card border border-border rounded-lg p-1 w-fit">
          <button onClick={() => setLang('en')} className={`px-3 py-1.5 text-sm rounded ${lang === 'en' ? 'bg-accent-orange text-white' : 'text-text-secondary'}`}>EN</button>
          <button onClick={() => setLang('local')} className={`px-3 py-1.5 text-sm rounded ${lang === 'local' ? 'bg-accent-orange text-white' : 'text-text-secondary'}`}>
            {project.targetLanguage.toUpperCase()}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {activeItems.map((item, i) => {
          const d = asDict(item);
          return (
            <div key={i} className="bg-bg-card border border-border rounded-lg overflow-hidden flex">
              <div className="bg-accent-orange/20 text-accent-orange font-bold text-3xl flex items-center justify-center px-6 min-w-[80px]">
                {asStr(d.number) || String(i + 1)}
              </div>
              <div className="flex-1 p-4">
                <div className="font-bold text-text-primary">{asStr(d.headline)}</div>
                <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">{asStr(d.body)}</p>
                {!!d.image_beat && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-text-muted uppercase mb-1">🎬 Image Beat</div>
                    <p className="text-xs text-text-secondary italic">{asStr(d.image_beat)}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeClose && (
        <div className="bg-bg-card border border-accent-teal/30 rounded-lg p-5">
          <div className="text-xs font-semibold uppercase text-accent-teal mb-2">Close</div>
          <p className="text-text-primary whitespace-pre-wrap">{activeClose}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Shared
// ============================================================

function Stat({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg p-3">
      <div className="text-sm font-bold text-text-primary truncate" title={value}>{value}</div>
      <div className="text-xs text-text-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}
