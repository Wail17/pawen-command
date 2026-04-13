'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { Project } from '@/lib/types';
import { getProject, getAllGateOutputs, getProjectTemplates, saveTemplate, deleteTemplate } from '@/lib/store/db';
import { Template, TemplateCategory } from '@/lib/templates/types';
import { StarterTemplate } from '@/lib/templates/starterTemplates';
import { buildCreativeContext, CreativeContext } from '@/lib/gates/creativeContextAggregator';
import { extractLiquidVariables, autoMapVariables, buildTemplateVariables } from '@/lib/templates/contentInjector';
import { renderTemplate, wrapForPreview } from '@/lib/templates/renderer';
import Pipeline from '@/components/ui/Pipeline';
import TemplateGallery from '@/components/templates/TemplateGallery';
import TemplateImport from '@/components/templates/TemplateImport';
import TemplateEditor from '@/components/templates/TemplateEditor';

export default function TemplatesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [creativeCtx, setCreativeCtx] = useState<CreativeContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);

  // Load project + templates + creative context
  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);

      const [tpls, allOutputs] = await Promise.all([
        getProjectTemplates(projectId),
        getAllGateOutputs(projectId),
      ]);
      setTemplates(tpls);

      // Build creative context from all gate outputs
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

  const handleImport = useCallback(async (data: { name: string; category: TemplateCategory; liquidSource: string }) => {
    if (!project) return;

    const vars = extractLiquidVariables(data.liquidSource);
    const variableMap = autoMapVariables(vars);

    // Build initial variable values if creative context exists
    let variables: Record<string, string> = {};
    let compiledHtml = '';
    if (creativeCtx) {
      const values = buildTemplateVariables(variableMap, creativeCtx);
      variables = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
      );
      try {
        compiledHtml = await renderTemplate(data.liquidSource, values);
      } catch { /* empty */ }
    }

    const now = new Date().toISOString();
    const template: Template = {
      id: uuid(),
      projectId,
      name: data.name,
      category: data.category,
      liquidSource: data.liquidSource,
      compiledHtml,
      variables,
      variableMap,
      editHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    await saveTemplate(template);
    setTemplates(prev => [template, ...prev]);
    setShowImport(false);
    setActiveTemplate(template);
  }, [project, projectId, creativeCtx]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    await deleteTemplate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (activeTemplate?.id === id) setActiveTemplate(null);
  }, [activeTemplate]);

  const handleTemplateUpdate = useCallback(async (updated: Template) => {
    await saveTemplate(updated);
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    setActiveTemplate(updated);
  }, []);

  const handleDuplicate = useCallback(async (source: Template) => {
    const now = new Date().toISOString();
    const duplicate: Template = {
      ...source,
      id: uuid(),
      name: `${source.name} (copy)`,
      editHistory: [],
      createdAt: now,
      updatedAt: now,
    };
    await saveTemplate(duplicate);
    setTemplates(prev => [duplicate, ...prev]);
    setActiveTemplate(duplicate);
  }, []);

  const handleStarterPick = useCallback(async (starter: StarterTemplate) => {
    await handleImport({
      name: starter.name,
      category: starter.category,
      liquidSource: starter.liquidSource,
    });
  }, [handleImport]);

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
        {activeTemplate ? (
          <TemplateEditor
            template={activeTemplate}
            creativeCtx={creativeCtx}
            onUpdate={handleTemplateUpdate}
            onBack={() => setActiveTemplate(null)}
          />
        ) : (
          <div className="p-6 overflow-y-auto h-full">
            <TemplateGallery
              templates={templates}
              onSelect={setActiveTemplate}
              onImport={() => setShowImport(true)}
              onDelete={handleDeleteTemplate}
              onDuplicate={handleDuplicate}
              onStarterPick={handleStarterPick}
            />
          </div>
        )}
      </div>

      {showImport && (
        <TemplateImport
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
