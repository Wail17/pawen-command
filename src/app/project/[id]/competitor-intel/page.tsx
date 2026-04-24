'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getProject, saveProject } from '@/lib/store/db';
import { ReverseEngineeredFunnel, ClonedFunnel } from '@/lib/competitor/types';
import Pipeline from '@/components/ui/Pipeline';
import CompetitorIntel from '@/components/gates/CompetitorIntel';
import AdCloner from '@/components/gates/AdCloner';

type Tab = 'ad-cloner' | 'reverse-engineer';

export default function CompetitorIntelPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [injected, setInjected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('ad-cloner');

  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);
      setLoading(false);
    })();
  }, [projectId, router]);

  // Persist the full reverse-engineered funnel on the project so Gate 1 can
  // promote it into a real SubAvatarV2 (see fromReverseEngineered.ts). We
  // keep the whole object — not just sub_avatar + mechanism — so downstream
  // gates get copy_arsenal, creative_strategy, insights etc. for free.
  const handleInjectSubAvatar = useCallback(async (funnel: ReverseEngineeredFunnel) => {
    if (!project) return;

    const updated: Project = {
      ...project,
      competitorIntel: {
        ...project.competitorIntel,
        reverseEngineered: {
          ...funnel,
          injected_at: new Date().toISOString(),
        },
      },
    };

    await saveProject(updated);
    setProject(updated);
    setInjected('Reverse-engineered funnel saved! Open Gate 1 — you can now use this avatar directly as your sub-avatar.');

    setTimeout(() => setInjected(null), 5000);
  }, [project]);

  // Store cloned funnel data
  const handleInjectClone = useCallback(async (clone: ClonedFunnel) => {
    if (!project) return;

    const updated: Project = {
      ...project,
      competitorIntel: {
        ...project.competitorIntel,
        clonedFunnel: {
          ...clone,
          cloned_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>,
      },
    };

    await saveProject(updated);
    setProject(updated);
    setInjected('Funnel cloned and saved! Go to Templates to import the translated HTML.');

    setTimeout(() => setInjected(null), 5000);
  }, [project]);

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <Pipeline project={project} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Injection success banner */}
        {injected && (
          <div className="mb-4 p-4 bg-success/10 border border-success/30 rounded-xl">
            <p className="text-sm text-success font-medium">{injected}</p>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('ad-cloner')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'ad-cloner'
                ? 'bg-accent-orange text-white'
                : 'bg-bg-card text-text-secondary border border-border hover:text-text-primary'
            }`}
          >
            Ad Cloner
          </button>
          <button
            onClick={() => setActiveTab('reverse-engineer')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'reverse-engineer'
                ? 'bg-accent-teal text-white'
                : 'bg-bg-card text-text-secondary border border-border hover:text-text-primary'
            }`}
          >
            Reverse Engineer
          </button>
        </div>

        {activeTab === 'ad-cloner' ? (
          <AdCloner
            targetLanguage={project.targetLanguage || 'English'}
            targetMarket={project.targetMarket || 'Global'}
          />
        ) : (
          <CompetitorIntel
            targetLanguage={project.targetLanguage || 'English'}
            targetMarket={project.targetMarket || 'Global'}
            projectSubAvatars={project.avatarRunResult?.sub_avatars ?? []}
            onInjectSubAvatar={handleInjectSubAvatar}
            onInjectClone={handleInjectClone}
          />
        )}
      </div>
    </div>
  );
}
