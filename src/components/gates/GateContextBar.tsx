'use client';

// ============================================================
// PAWEN — GateContextBar
// Displays at the top of gates 2-9: funnel selector + sub-avatar
// switcher. Lets the user change focus mid-pipeline without going
// back to Gate 1.
// ============================================================

import { useCallback } from 'react';
import Link from 'next/link';
import {
  Project,
  FunnelType,
  FUNNEL_LABELS,
  FUNNEL_DESCRIPTIONS,
  FUNNEL_COLORS,
} from '@/lib/types';
import type { SubAvatarV2, AwarenessLevel } from '@/lib/avatars/types';
import { saveProject } from '@/lib/store/db';

interface GateContextBarProps {
  project: Project;
  onProjectChange: (project: Project) => void;
}

// AwarenessLevel → FunnelType. FunnelType has an extra 'retargeting' slot
// and renames 'unaware' → 'full_unaware'. Everything else is 1:1.
const AWARENESS_TO_FUNNEL: Record<AwarenessLevel, FunnelType> = {
  unaware: 'full_unaware',
  problem_aware: 'problem_aware',
  solution_aware: 'solution_aware',
  product_aware: 'product_aware',
  most_aware: 'most_aware',
};

export default function GateContextBar({ project, onProjectChange }: GateContextBarProps) {
  const subAvatars: SubAvatarV2[] = project.avatarRunResult?.sub_avatars ?? [];
  const selectedSA = subAvatars.find((sa) => sa.id === project.selectedSubAvatarId)
    ?? subAvatars.find((sa) => sa.recommended_for_test)
    ?? subAvatars[0];
  const selectedFunnel = project.selectedFunnel ?? null;
  const recommendedFunnel: FunnelType | null = selectedSA?.recommended_awareness_level
    ? AWARENESS_TO_FUNNEL[selectedSA.recommended_awareness_level]
    : null;

  const handleFunnelChange = useCallback(
    async (funnel: FunnelType) => {
      const updated: Project = {
        ...project,
        selectedFunnel: funnel,
        updatedAt: new Date().toISOString(),
      };
      await saveProject(updated);
      onProjectChange(updated);
    },
    [project, onProjectChange],
  );

  const handleSubAvatarChange = useCallback(
    async (saId: string) => {
      const updated: Project = {
        ...project,
        selectedSubAvatarId: saId,
        updatedAt: new Date().toISOString(),
      };
      await saveProject(updated);
      onProjectChange(updated);
    },
    [project, onProjectChange],
  );

  return (
    <div className="mb-4 p-4 bg-bg-card border border-border rounded-xl space-y-3">
      {/* Sub-avatar switcher — always rendered, even when empty, so the user
          knows WHY the pipeline is unfocused. */}
      {subAvatars.length === 0 ? (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-accent-orange/40 bg-accent-orange/5">
          <div className="text-accent-orange text-lg leading-none">⚠</div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-accent-orange uppercase mb-1">
              No sub-avatars yet
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Gates 2-9 need a sub-avatar picked in Gate 1. Without one, the lead agent,
              manager, director and sub-agents all run against an empty avatar context —
              you&apos;ll get generic output.
            </p>
            <Link
              href={`/project/${project.id}/gate/gate1`}
              className="inline-block mt-2 px-3 py-1 text-[11px] font-semibold bg-accent-orange/20 text-accent-orange border border-accent-orange/40 rounded-md hover:bg-accent-orange/30 transition"
            >
              → Run Gate 1 (Avatar Excavation)
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-text-muted uppercase shrink-0">
            Sub-avatar
          </label>
          <select
            value={selectedSA?.id ?? ''}
            onChange={(e) => handleSubAvatarChange(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-bg-input border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-orange"
          >
            {subAvatars.map((sa) => (
              <option key={sa.id} value={sa.id}>
                {sa.nickname || sa.name}
                {sa.recommended_for_test ? ' ★' : ''}
                {` (U${sa.urgency_score} × S${sa.scope_score})`}
              </option>
            ))}
          </select>
          {selectedSA && (
            <span className="text-[10px] text-text-muted hidden md:inline max-w-[200px] truncate">
              {selectedSA.description?.slice(0, 80)}
            </span>
          )}
        </div>
      )}

      {/* Funnel selector */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-semibold text-text-muted uppercase">
            Funnel
          </label>
          {!selectedFunnel && (
            <span className="text-[10px] text-accent-orange animate-pulse">
              Choose a funnel to focus the pipeline
            </span>
          )}
          {recommendedFunnel && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              ★ <span className="font-semibold">{FUNNEL_LABELS[recommendedFunnel]}</span>
              <span className="text-text-muted">recommended for {selectedSA?.nickname || 'this sub-avatar'}</span>
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5">
          {(Object.keys(FUNNEL_LABELS) as FunnelType[]).map((f) => {
            const active = selectedFunnel === f;
            const isRecommended = recommendedFunnel === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => handleFunnelChange(f)}
                className={`relative px-2.5 py-2 rounded-lg border text-left transition text-xs ${
                  active
                    ? FUNNEL_COLORS[f] + ' ring-1 ring-current font-semibold'
                    : isRecommended
                      ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10'
                      : 'border-border text-text-muted hover:text-text-primary hover:border-text-muted'
                }`}
                title={
                  FUNNEL_DESCRIPTIONS[f]
                  + (isRecommended ? `\n\n★ Recommended based on ${selectedSA?.nickname || 'sub-avatar'} verbatims` : '')
                }
              >
                {isRecommended && (
                  <span
                    aria-label="recommended"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm"
                  >
                    ★
                  </span>
                )}
                <div className="font-semibold">{FUNNEL_LABELS[f]}</div>
              </button>
            );
          })}
        </div>
        {selectedFunnel && (
          <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
            {FUNNEL_DESCRIPTIONS[selectedFunnel]}
          </p>
        )}
      </div>
    </div>
  );
}
