'use client';

import { useCallback } from 'react';
import type { Project } from '@/lib/types';
import { setAdScriptFormat } from '@/lib/store/project-utils';
import { saveProject } from '@/lib/store/db';

interface Props {
  project: Project;
  onProjectChange: (project: Project) => void;
}

type Format = 'ugc' | 'vsl' | 'both' | 'skipped';

const OPTIONS: Array<{
  id: Format;
  title: string;
  tagline: string;
  detail: string;
  color: string;
  comingSoon?: boolean;
}> = [
  {
    id: 'ugc',
    title: 'UGC Scripts',
    tagline: 'Talking-head ~45s, first-person',
    detail: 'Hook + story + soft CTA. Pour creators Billo/Backstage. Inclut primary text + headlines.',
    color: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
  },
  {
    id: 'vsl',
    title: 'VSL Scripts',
    tagline: 'Long-form 5-15 min',
    detail: 'Hook → agitation → mécanisme → proof → offer → close. Teleprompter-ready.',
    color: 'border-purple-500/60 bg-purple-500/10 text-purple-300',
    comingSoon: true,
  },
  {
    id: 'both',
    title: 'UGC + VSL',
    tagline: 'Les deux formats',
    detail: 'Génère UGC + VSL. Coût ~2x mais couvre tout le funnel (TOF UGC + BOF VSL).',
    color: 'border-blue-500/60 bg-blue-500/10 text-blue-300',
    comingSoon: true,
  },
  {
    id: 'skipped',
    title: 'Skip — statics only',
    tagline: 'Pas de scripts vidéo',
    detail: 'Pour stratégie 100% static / carousels. Débloque G7 directement. Coût zéro.',
    color: 'border-slate-500/60 bg-slate-500/10 text-slate-300',
  },
];

export default function Gate6FormatSelector({ project, onProjectChange }: Props) {
  const current = project.selectedAdScriptFormat;

  const handlePick = useCallback(
    async (format: Format) => {
      const updated = setAdScriptFormat(project, format);
      await saveProject(updated);
      onProjectChange(updated);
    },
    [project, onProjectChange],
  );

  return (
    <div className="mb-6 rounded-lg border border-border bg-bg-secondary p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Gate 6 — Ad Script Format</h3>
        <p className="text-xs text-text-secondary">
          Choisis le format de script. Si tu fais du static-only, skip — G7 se débloque direct.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        {OPTIONS.map((opt) => {
          const active = current === opt.id;
          const disabled = opt.comingSoon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => !disabled && handlePick(opt.id)}
              disabled={disabled}
              className={`text-left rounded-md border p-3 transition ${
                active
                  ? `${opt.color} ring-2 ring-offset-0`
                  : disabled
                    ? 'border-border bg-bg-primary text-text-muted opacity-50 cursor-not-allowed'
                    : 'border-border bg-bg-primary text-text-secondary hover:border-text-secondary'
              }`}
            >
              <div className="text-sm font-semibold flex items-center gap-2">
                {opt.title}
                {opt.comingSoon && (
                  <span className="text-[9px] uppercase bg-bg-elevated text-text-muted px-1.5 py-0.5 rounded">soon</span>
                )}
              </div>
              <div className="text-xs opacity-80 mt-0.5">{opt.tagline}</div>
              <div className="text-[11px] opacity-70 mt-2 leading-snug">{opt.detail}</div>
              {active && (
                <div className="text-[10px] mt-2 font-semibold uppercase tracking-wide">
                  ✓ Selected
                </div>
              )}
            </button>
          );
        })}
      </div>
      {current === 'skipped' && (
        <div className="mt-3 text-xs text-emerald-400">
          G6 skipped. G7 (Creative Briefs) est débloqué — go straight to statics.
        </div>
      )}
    </div>
  );
}
