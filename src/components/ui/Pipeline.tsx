'use client';

import { Project, GateId, GateStatus } from '@/lib/types';
import { ALL_GATES, GATE_LABELS, GATE_SHORT_NAMES, getProgressPercentage } from '@/lib/store/project-utils';
import Link from 'next/link';

interface PipelineProps {
  project: Project;
  activeGate?: GateId;
}

const STATUS_STYLES: Record<GateStatus, { dot: string; text: string; bg: string }> = {
  locked: {
    dot: 'bg-text-muted',
    text: 'text-text-muted',
    bg: 'bg-bg-card opacity-40',
  },
  available: {
    dot: 'bg-text-secondary',
    text: 'text-text-secondary',
    bg: 'bg-bg-card hover:bg-bg-card-hover cursor-pointer',
  },
  in_progress: {
    dot: 'bg-accent-orange animate-pulse',
    text: 'text-accent-orange',
    bg: 'bg-bg-card border-accent-orange hover:bg-bg-card-hover cursor-pointer',
  },
  pending_review: {
    dot: 'bg-warning',
    text: 'text-warning',
    bg: 'bg-bg-card border-warning hover:bg-bg-card-hover cursor-pointer',
  },
  approved: {
    dot: 'bg-success',
    text: 'text-success',
    bg: 'bg-bg-card border-success/30 hover:bg-bg-card-hover cursor-pointer',
  },
};

const STATUS_ICONS: Record<GateStatus, string> = {
  locked: '🔒',
  available: '○',
  in_progress: '🔄',
  pending_review: '⏳',
  approved: '✅',
};

export default function Pipeline({ project, activeGate }: PipelineProps) {
  const progress = getProgressPercentage(project);

  return (
    <aside className="w-64 min-h-screen bg-bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <Link href="/" className="text-accent-orange font-bold text-lg hover:text-accent-orange-hover">
          🐾 Pawen
        </Link>
        <p className="text-text-muted text-xs mt-1">Command Center v3.0</p>
      </div>

      {/* Project Name */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-text-secondary text-xs uppercase tracking-wider">Project</p>
        <p className="text-text-primary font-medium text-sm truncate mt-1">
          {project.name}
        </p>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 bg-bg-primary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-orange rounded-full"
            style={{ width: `${progress}%`, transition: 'width 500ms ease' }}
          />
        </div>
        <p className="text-text-muted text-xs mt-1">{progress}% complete</p>
      </div>

      {/* Pipeline Gates */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <p className="px-4 text-text-muted text-xs uppercase tracking-wider mb-2">Pipeline</p>
        <ul className="space-y-1 px-2">
          {ALL_GATES.map((gateId) => {
            const status = project.gateStatuses[gateId];
            const styles = STATUS_STYLES[status];
            const isActive = activeGate === gateId;
            const isDNA = gateId === 'brand-dna';

            return (
              <li key={gateId}>
                <Link
                  href={
                    status === 'locked' && !project.startAnywhereMode
                      ? '#'
                      : gateId === 'brand-dna'
                        ? `/project/${project.id}/brand-dna`
                        : `/project/${project.id}/gate/${gateId}`
                  }
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm
                    ${styles.bg}
                    ${isActive ? 'border-accent-orange bg-bg-card-hover' : 'border-transparent'}
                    ${status === 'locked' && !project.startAnywhereMode ? 'pointer-events-none' : ''}
                  `}
                >
                  <span className="text-base">{STATUS_ICONS[status]}</span>
                  <div className="flex-1 min-w-0">
                    <span className={`font-mono text-xs ${styles.text}`}>
                      {GATE_SHORT_NAMES[gateId]}
                    </span>
                    <span className={`ml-2 ${styles.text} ${isDNA ? 'font-semibold' : ''}`}>
                      {GATE_LABELS[gateId]}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer links */}
      <div className="p-4 border-t border-border space-y-2">
        <Link
          href={`/project/${project.id}/competitor-intel`}
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-accent-orange"
        >
          🕵️ Competitor Intel
        </Link>
        <Link
          href={`/project/${project.id}/brand-dna`}
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-accent-teal"
        >
          🧬 Brand DNA
        </Link>
        <Link
          href={`/project/${project.id}/templates`}
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-accent-orange"
        >
          📐 Templates
        </Link>
        <Link
          href={`/project/${project.id}/emails`}
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-accent-orange"
        >
          📧 Email Sequences
        </Link>
        <Link
          href={`/project/${project.id}/offer-stack`}
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-accent-teal"
        >
          💰 Offer Stack
        </Link>
        <Link
          href={`/project/${project.id}/ugc-briefs`}
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-accent-orange"
        >
          🎬 UGC Briefs
        </Link>
        <Link
          href={`/project/${project.id}/carousels`}
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-accent-teal"
        >
          🎠 Carousels
        </Link>
        <Link
          href={`/project/${project.id}/calculator`}
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-accent-orange"
        >
          🧮 ROAS Calculator
        </Link>
        <Link
          href={`/project/${project.id}/theme-editor`}
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-accent-teal"
        >
          🎨 Theme Editor
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-text-secondary text-sm hover:text-text-primary"
        >
          📁 All Projects
        </Link>
      </div>
    </aside>
  );
}
