'use client';

// ============================================================
// PAWEN — Gate 5 Format Selector
// 4 choices: Advertorial (ZAK) | Native Ad | Listicle | Skip
// Skip unlocks G6 AND G7 immediately (bypass long-form copy).
// Renders above GateView on the gate5 page.
// ============================================================

import { useCallback } from 'react';
import type { Project } from '@/lib/types';
import { setCopyFormat } from '@/lib/store/project-utils';
import { saveProject } from '@/lib/store/db';

interface Props {
  project: Project;
  onProjectChange: (project: Project) => void;
}

type Format = 'advertorial' | 'native' | 'listicle' | 'skipped';

const OPTIONS: Array<{
  id: Format;
  title: string;
  tagline: string;
  detail: string;
  color: string;
}> = [
  {
    id: 'advertorial',
    title: 'Advertorial (ZAK)',
    tagline: '3,000-5,000 word sales page',
    detail: 'Long-form story → mechanism → close. Best for cold traffic + strong claims + high AOV.',
    color: 'border-purple-500/60 bg-purple-500/10 text-purple-300',
  },
  {
    id: 'native',
    title: 'Native Ad',
    tagline: '300-600 word story primary text',
    detail: 'First-person fragmented post. Character + hook + soft close. Reads organic on feed.',
    color: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300',
  },
  {
    id: 'listicle',
    title: 'Listicle',
    tagline: 'Numbered list, screenshot-style',
    detail: '5-9 items, each with its own image beat. iPhone-Notes aesthetic. Mobile-first.',
    color: 'border-amber-500/60 bg-amber-500/10 text-amber-300',
  },
  {
    id: 'skipped',
    title: 'Skip — statics only',
    tagline: 'Jump straight to creatives',
    detail: 'No long-form copy. Unlocks G6 and G7 immediately. Creative carries 100% of the job.',
    color: 'border-slate-500/60 bg-slate-500/10 text-slate-300',
  },
];

export default function Gate5FormatSelector({ project, onProjectChange }: Props) {
  const current = project.selectedCopyFormat;

  const handlePick = useCallback(
    async (format: Format) => {
      const updated = setCopyFormat(project, format);
      await saveProject(updated);
      onProjectChange(updated);
    },
    [project, onProjectChange],
  );

  return (
    <div className="mb-6 rounded-lg border border-border bg-bg-secondary p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Gate 5 — Copy Format</h3>
        <p className="text-xs text-text-secondary">
          Pick the copy format for this funnel. Creative register stays organic DR across all four.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        {OPTIONS.map((opt) => {
          const active = current === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handlePick(opt.id)}
              className={`text-left rounded-md border p-3 transition ${
                active
                  ? `${opt.color} ring-2 ring-offset-0`
                  : 'border-border bg-bg-primary text-text-secondary hover:border-text-secondary'
              }`}
            >
              <div className="text-sm font-semibold">{opt.title}</div>
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
          G5 skipped. G6 and G7 are unlocked — go straight to statics.
        </div>
      )}
    </div>
  );
}
