'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Pipeline from '@/components/ui/Pipeline';
import { getProject, getAllGateOutputs } from '@/lib/store/db';
import { Project } from '@/lib/types';

interface GeneratedImageEntry {
  url: string;
  briefId: string;
  briefName?: string;
  format: string;
  gateId: string;
  generatedAt?: string;
}

export default function GalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<GeneratedImageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);

      const outputs = await getAllGateOutputs(projectId);
      const all: GeneratedImageEntry[] = [];

      for (const out of outputs) {
        const decisions = out.humanDecisions as Record<string, unknown> | undefined;
        if (!decisions) continue;
        const generated = decisions.generatedImages as Record<string, string[]> | undefined;
        if (!generated) continue;

        // Try to find brief names from gate 7 data (preset briefs)
        const briefNames: Record<string, string> = {};
        const g7Data = out.data as Record<string, unknown> | undefined;
        const presets =
          ((g7Data?.static_ad_studio as Record<string, unknown>)?.presets as Record<string, { briefs?: { id: string; name: string }[] }>) ??
          (g7Data?.presets as Record<string, { briefs?: { id: string; name: string }[] }>);
        if (presets) {
          for (const preset of Object.values(presets)) {
            for (const brief of preset.briefs ?? []) {
              briefNames[brief.id] = brief.name;
            }
          }
        }

        for (const [key, urls] of Object.entries(generated)) {
          const lastUnderscore = key.lastIndexOf('_');
          const briefId = lastUnderscore > 0 ? key.slice(0, lastUnderscore) : key;
          const format = lastUnderscore > 0 ? key.slice(lastUnderscore + 1) : 'unknown';
          for (const url of urls) {
            all.push({
              url,
              briefId,
              briefName: briefNames[briefId],
              format,
              gateId: out.gateId,
              generatedAt: out.updatedAt,
            });
          }
        }
      }

      // Newest first
      all.sort((a, b) => (b.generatedAt ?? '').localeCompare(a.generatedAt ?? ''));
      setImages(all);
      setLoading(false);
    })();
  }, [projectId, router]);

  if (loading || !project) {
    return (
      <div className="flex h-screen">
        <div className="flex-1 flex items-center justify-center text-text-muted">Loading gallery...</div>
      </div>
    );
  }

  const downloadAll = async () => {
    for (const img of images) {
      const a = document.createElement('a');
      a.href = img.url;
      a.download = `${img.briefId}_${img.format}.png`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise(r => setTimeout(r, 150));
    }
  };

  return (
    <div className="flex h-screen">
      <Pipeline project={project} />
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">🖼️ Image Gallery</h1>
            <p className="text-sm text-text-muted">{images.length} image{images.length !== 1 ? 's' : ''} generated for this project</p>
          </div>
          {images.length > 0 && (
            <button
              onClick={downloadAll}
              className="px-4 py-2 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm"
            >
              📥 Download All
            </button>
          )}
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted">
            <p className="text-base mb-2">Aucune image générée pour ce projet.</p>
            <p className="text-sm">Va sur Gate 7 ou 8, pick un brief et clique sur un bouton Generate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((img, i) => (
              <div key={`${img.url}-${i}`} className="bg-bg-card border border-border rounded-xl overflow-hidden hover:border-accent-teal transition-colors">
                <a href={img.url} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={img.url} alt={img.briefName || img.briefId} className="w-full h-auto bg-bg-primary" />
                </a>
                <div className="p-3">
                  <p className="text-xs font-semibold text-text-primary truncate">{img.briefName || img.briefId}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-bg-primary rounded text-text-muted font-mono">{img.format}</span>
                    <span className="text-[10px] text-text-muted">{img.gateId}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
