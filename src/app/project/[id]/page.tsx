'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getProject, saveProject } from '@/lib/store/db';
import Pipeline from '@/components/ui/Pipeline';
import { GATE_LABELS, ALL_GATES, canAccessGate } from '@/lib/store/project-utils';
import Link from 'next/link';

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const id = params.id as string;
        if (!id) {
          router.push('/');
          return;
        }
        const p = await getProject(id);
        if (!p) {
          router.push('/');
          return;
        }
        setProject(p);
      } catch (err) {
        console.error('Failed to load project:', err);
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <p className="text-error mb-4">{error || 'Project not found'}</p>
          <a href="/" className="text-accent-orange hover:underline">Back to dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <Pipeline project={project} />

      <main className="flex-1 p-8">
        {/* Project header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary">{project.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className="px-2 py-1 bg-bg-card border border-border rounded-md text-text-secondary">
              {project.targetLanguage}
            </span>
            <span className="px-2 py-1 bg-bg-card border border-border rounded-md text-text-secondary">
              {project.targetMarket}
            </span>
            <a
              href={project.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-teal hover:text-accent-teal-hover truncate max-w-md"
            >
              {project.productUrl}
            </a>
          </div>
        </div>

        {/* Start Anywhere toggle */}
        <div className="mb-6 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={`relative w-10 h-5 rounded-full transition-colors ${
                project.startAnywhereMode ? 'bg-accent-orange' : 'bg-border'
              }`}
              onClick={async () => {
                const updated = {
                  ...project,
                  startAnywhereMode: !project.startAnywhereMode,
                  gateStatuses: !project.startAnywhereMode
                    ? Object.fromEntries(
                        ALL_GATES.map((g) => [
                          g,
                          project.gateStatuses[g] === 'locked' ? 'available' : project.gateStatuses[g],
                        ])
                      ) as typeof project.gateStatuses
                    : project.gateStatuses,
                };
                await saveProject(updated);
                setProject(updated);
              }}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  project.startAnywhereMode ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-text-secondary text-sm">Start Anywhere Mode</span>
          </label>
        </div>

        {/* Gates grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ALL_GATES.map((gateId) => {
            const status = project.gateStatuses[gateId];
            const accessible = canAccessGate(project, gateId);
            const isDNA = gateId === 'brand-dna';

            return (
              <Link
                key={gateId}
                href={
                  !accessible
                    ? '#'
                    : isDNA
                      ? `/project/${project.id}/brand-dna`
                      : `/project/${project.id}/gate/${gateId}`
                }
                className={`
                  bg-bg-card border rounded-xl p-5 block
                  ${status === 'approved' ? 'border-success/30' : ''}
                  ${status === 'in_progress' ? 'border-accent-orange' : ''}
                  ${status === 'pending_review' ? 'border-warning' : ''}
                  ${status === 'available' ? 'border-border hover:border-accent-orange' : ''}
                  ${status === 'locked' && !accessible ? 'border-border opacity-40 pointer-events-none' : ''}
                  ${accessible ? 'hover:bg-bg-card-hover cursor-pointer' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-text-muted">
                    {isDNA ? '🧬' : gateId.replace('gate', 'G')}
                  </span>
                  <StatusBadge status={status} />
                </div>
                <h3 className={`font-semibold text-sm ${accessible ? 'text-text-primary' : 'text-text-muted'}`}>
                  {GATE_LABELS[gateId]}
                </h3>
                <p className="text-text-muted text-xs mt-1">
                  {getGateDescription(gateId)}
                </p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    locked: 'bg-bg-primary text-text-muted',
    available: 'bg-bg-primary text-text-secondary',
    in_progress: 'bg-accent-orange/20 text-accent-orange',
    pending_review: 'bg-warning/20 text-warning',
    approved: 'bg-success/20 text-success',
  };

  const labels: Record<string, string> = {
    locked: 'Locked',
    available: 'Ready',
    in_progress: 'In Progress',
    pending_review: 'Review',
    approved: 'Done',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-md ${styles[status] || ''}`}>
      {labels[status] || status}
    </span>
  );
}

function getGateDescription(gateId: string): string {
  const descriptions: Record<string, string> = {
    'gate1': 'Product analysis, market intel, competitor scan, buyer psychology',
    'gate2': 'Avatar deep dive, voice extraction, customer language mining',
    'gate3': 'Root cause (3-phase), belief error, solution mechanism',
    'brand-dna': 'Compile & lock the Brand DNA — single source of truth',
    'gate4': 'Hooks, open loops, sensory language, future pacing, bucket brigades',
    'gate5': '7-block advertorial with Background Story + 9-step Close',
    'gate6': 'Ad concepts, body copies, headlines, video scripts (EVOLVE)',
    'gate7': '10 headlines, 5 ad structures, 6 image briefs with AI prompts',
    'gate8': 'Generate static ads via fal.ai + vision review',
    'gate9': 'Campaign structure, testing strategy, creator briefs, scaling',
  };
  return descriptions[gateId] || '';
}
