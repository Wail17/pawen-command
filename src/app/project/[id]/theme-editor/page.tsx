'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getProject, getAllGateOutputs } from '@/lib/store/db';
import { buildCreativeContext, CreativeContext } from '@/lib/gates/creativeContextAggregator';
import type { ShopifyTheme } from '@/lib/themes/types';
import Pipeline from '@/components/ui/Pipeline';
import ThemeUploader from '@/components/themes/ThemeUploader';
import ThemeEditor from '@/components/themes/ThemeEditor';

export default function ThemeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [creativeCtx, setCreativeCtx] = useState<CreativeContext | null>(null);
  const [theme, setTheme] = useState<ShopifyTheme | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);

      // Build creative context from all gate outputs
      const allOutputs = await getAllGateOutputs(projectId);
      const previousOutputs: Record<string, unknown> = {};
      for (const o of allOutputs) {
        previousOutputs[o.gateId] = o.data;
      }
      try {
        const ctx = buildCreativeContext(p, previousOutputs);
        setCreativeCtx(ctx);
      } catch {
        // No gates run yet — context will be empty
      }

      setLoading(false);
    })();
  }, [projectId, router]);

  const handleThemeLoaded = useCallback((loaded: ShopifyTheme) => {
    setTheme(loaded);
  }, []);

  const handleThemeChange = useCallback((updated: ShopifyTheme) => {
    setTheme(updated);
  }, []);

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

      <div className="flex-1 overflow-hidden">
        {theme ? (
          <ThemeEditor
            theme={theme}
            creativeContext={creativeCtx}
            onThemeChange={handleThemeChange}
          />
        ) : (
          <div className="p-6 overflow-y-auto h-full">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-text-primary">Shopify Theme Editor</h1>
              <p className="text-sm text-text-muted mt-1">
                Upload your Shopify theme or connect your store to edit in real-time with AI assistance.
              </p>
            </div>

            <ThemeUploader
              projectId={projectId}
              onThemeLoaded={handleThemeLoaded}
            />
          </div>
        )}
      </div>
    </div>
  );
}
