'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, GateId, AdPerformance } from '@/lib/types';
import { getProject, saveProject } from '@/lib/store/db';
import Pipeline from '@/components/ui/Pipeline';
import { GATE_LABELS, ALL_GATES, canAccessGate } from '@/lib/store/project-utils';
import Link from 'next/link';
import { canStartAutoPipeline, runAutoPipeline, AutoPipelineState } from '@/lib/pipeline/autoPipeline';
import { buildMetaAdsExport, exportToCSV, exportToText } from '@/lib/export/metaAdsExport';
import { demoGate1, demoGateData, demoBrandDNA } from '@/lib/gates/demoData';
import { saveGateOutput } from '@/lib/store/db';
import type { GateOutput } from '@/lib/types';

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-pipeline state
  const [pipelineState, setPipelineState] = useState<AutoPipelineState | null>(null);

  // Performance input state
  const [showPerfInput, setShowPerfInput] = useState(false);
  const [perfForm, setPerfForm] = useState({
    adName: '', impressions: '', clicks: '', ctr: '', cpc: '',
    cpa: '', roas: '', spend: '', conversions: '', dateRange: '', notes: '',
  });

  // Export state
  const [exporting, setExporting] = useState(false);

  // Competitor ads state
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [competitorQuery, setCompetitorQuery] = useState('');
  const [competitorAds, setCompetitorAds] = useState<{ headline: string; body: string; cta: string; advertiser: string }[]>([]);
  const [searchingAds, setSearchingAds] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Load Full Demo — populates ALL gates with Slapen demo data
  const handleLoadFullDemo = useCallback(async () => {
    if (!project) return;
    setLoadingDemo(true);
    try {
      const projectId = project.id;
      const now = new Date().toISOString();

      // Gate 1 — Avatar Excavation
      const avatarResult = demoGate1();
      const g1Output: GateOutput = {
        gateId: 'gate1', projectId, status: 'approved',
        data: avatarResult as unknown as Record<string, unknown>,
        generationLog: [{ timestamp: now, agent: 'lead', model: 'demo-data', iteration: 1, input_summary: 'Full demo load', output_summary: '3 sub-avatars (Slapen)' }],
        reviewResult: null, congruenceResult: null, humanDecisions: {}, checkpoint: null,
        createdAt: now, updatedAt: now,
      };
      await saveGateOutput(g1Output);

      // Brand DNA
      const brandDNA = demoBrandDNA();
      const bdnaOutput: GateOutput = {
        gateId: 'brand-dna', projectId, status: 'approved',
        data: brandDNA as unknown as Record<string, unknown>,
        generationLog: [{ timestamp: now, agent: 'lead', model: 'demo-data', iteration: 1, input_summary: 'Full demo load', output_summary: 'Brand DNA locked' }],
        reviewResult: null, congruenceResult: null, humanDecisions: {}, checkpoint: null,
        createdAt: now, updatedAt: now,
      };
      await saveGateOutput(bdnaOutput);

      // Gates 2-9
      const gateIds: GateId[] = ['gate2', 'gate3', 'gate4', 'gate5', 'gate6', 'gate7', 'gate8', 'gate9'];
      for (const gid of gateIds) {
        const data = demoGateData(gid);
        if (!data || Object.keys(data).length === 0) continue;
        const gOutput: GateOutput = {
          gateId: gid, projectId, status: 'approved',
          data,
          generationLog: [{ timestamp: now, agent: 'lead', model: 'demo-data', iteration: 1, input_summary: 'Full demo load', output_summary: `Demo data for ${gid}` }],
          reviewResult: null, congruenceResult: null, humanDecisions: {}, checkpoint: null,
          createdAt: now, updatedAt: now,
        };
        await saveGateOutput(gOutput);
      }

      // Update project with all gates approved
      const allApproved = Object.fromEntries(
        ALL_GATES.map(g => [g, 'approved' as const])
      ) as typeof project.gateStatuses;

      const updatedProject: Project = {
        ...project,
        avatarRunResult: avatarResult,
        brandDNA: { ...brandDNA, locked: true },
        selectedSubAvatarId: 'sa-1',
        selectedFunnel: 'problem_aware',
        gateStatuses: allApproved,
        name: project.name || 'Slapen Demo',
        productDescription: project.productDescription || 'Dual-phase cortisol regulation sleep supplement',
        niche: project.niche || 'Natural sleep supplements',
      };
      await saveProject(updatedProject);
      setProject(updatedProject);
    } catch (err) {
      console.error('Demo load error:', err);
    } finally {
      setLoadingDemo(false);
    }
  }, [project]);

  useEffect(() => {
    async function load() {
      try {
        const id = params.id as string;
        if (!id) { router.push('/'); return; }
        const p = await getProject(id);
        if (!p) { router.push('/'); return; }
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

  // Auto-pipeline handler
  const handleAutoPipeline = useCallback(async () => {
    if (!project) return;
    const check = canStartAutoPipeline(project);
    if (!check.ok) {
      alert(check.reason);
      return;
    }

    await runAutoPipeline(project, {
      onStateChange: setPipelineState,
      onGateComplete: () => {},
      onProjectUpdate: (p) => setProject(p),
    });
  }, [project]);

  // Performance submission
  const handleAddPerformance = useCallback(async () => {
    if (!project || !perfForm.adName) return;

    const entry: AdPerformance = {
      id: `perf_${Date.now()}`,
      adName: perfForm.adName,
      funnel: project.selectedFunnel || 'any',
      impressions: parseInt(perfForm.impressions) || 0,
      clicks: parseInt(perfForm.clicks) || 0,
      ctr: parseFloat(perfForm.ctr) || 0,
      cpc: parseFloat(perfForm.cpc) || 0,
      cpa: parseFloat(perfForm.cpa) || 0,
      roas: parseFloat(perfForm.roas) || 0,
      spend: parseFloat(perfForm.spend) || 0,
      conversions: parseInt(perfForm.conversions) || 0,
      dateRange: perfForm.dateRange,
      notes: perfForm.notes,
      addedAt: new Date().toISOString(),
    };

    const updated = {
      ...project,
      adPerformance: [...(project.adPerformance || []), entry],
    };
    await saveProject(updated);
    setProject(updated);
    setShowPerfInput(false);
    setPerfForm({ adName: '', impressions: '', clicks: '', ctr: '', cpc: '', cpa: '', roas: '', spend: '', conversions: '', dateRange: '', notes: '' });
  }, [project, perfForm]);

  // Export handlers
  const handleExportJSON = useCallback(async () => {
    if (!project) return;
    setExporting(true);
    try {
      const exp = await buildMetaAdsExport(project);
      const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `${project.name}-meta-ads.json`);
    } finally { setExporting(false); }
  }, [project]);

  const handleExportCSV = useCallback(async () => {
    if (!project) return;
    setExporting(true);
    try {
      const exp = await buildMetaAdsExport(project);
      const csv = exportToCSV(exp);
      const blob = new Blob([csv], { type: 'text/csv' });
      downloadBlob(blob, `${project.name}-meta-ads.csv`);
    } finally { setExporting(false); }
  }, [project]);

  const handleExportClipboard = useCallback(async () => {
    if (!project) return;
    setExporting(true);
    try {
      const exp = await buildMetaAdsExport(project);
      const text = exportToText(exp);
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } finally { setExporting(false); }
  }, [project]);

  // Competitor ads search
  const handleSearchCompetitors = useCallback(async () => {
    if (!competitorQuery.trim()) return;
    setSearchingAds(true);
    try {
      const res = await fetch('/api/meta-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: competitorQuery,
          niche: project?.niche,
          limit: 15,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompetitorAds(data.ads || []);
      }
    } catch { /* ignore */ }
    finally { setSearchingAds(false); }
  }, [competitorQuery, project?.niche]);

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

  const pipelineCheck = canStartAutoPipeline(project);

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <Pipeline project={project} />

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Project header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">{project.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className="px-2 py-1 bg-bg-card border border-border rounded-md text-text-secondary">
              {project.targetLanguage}
            </span>
            <span className="px-2 py-1 bg-bg-card border border-border rounded-md text-text-secondary">
              {project.targetMarket}
            </span>
            {project.productUrl && (
              <a href={project.productUrl} target="_blank" rel="noopener noreferrer"
                className="text-accent-teal hover:text-accent-teal-hover truncate max-w-md">
                {project.productUrl}
              </a>
            )}
          </div>
        </div>

        {/* Action bar: Start Anywhere + Auto-Pipeline + Export */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {/* Start Anywhere toggle */}
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
            <span className="text-text-secondary text-sm">Start Anywhere</span>
          </label>

          {/* Auto-Pipeline button */}
          <button
            onClick={handleAutoPipeline}
            disabled={!pipelineCheck.ok || !!pipelineState?.isRunning}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pipelineCheck.ok && !pipelineState?.isRunning
                ? 'bg-accent-orange text-white hover:bg-accent-orange-hover'
                : 'bg-border text-text-muted cursor-not-allowed'
            }`}
            title={pipelineCheck.reason || 'Run all remaining gates automatically'}
          >
            {pipelineState?.isRunning ? 'Running...' : 'Auto-Pipeline'}
          </button>

          {/* Load Full Demo — all 9 gates at once */}
          <button
            onClick={handleLoadFullDemo}
            disabled={loadingDemo}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loadingDemo ? 'Loading Demo...' : 'Load Full Demo'}
          </button>

          {/* Export buttons */}
          <div className="flex items-center gap-1">
            <button onClick={handleExportJSON} disabled={exporting}
              className="px-3 py-2 bg-bg-card border border-border rounded-l-lg text-xs text-text-secondary hover:border-accent-teal transition-colors">
              JSON
            </button>
            <button onClick={handleExportCSV} disabled={exporting}
              className="px-3 py-2 bg-bg-card border-y border-border text-xs text-text-secondary hover:border-accent-teal transition-colors">
              CSV
            </button>
            <button onClick={handleExportClipboard} disabled={exporting}
              className="px-3 py-2 bg-bg-card border border-border rounded-r-lg text-xs text-text-secondary hover:border-accent-teal transition-colors">
              Copy
            </button>
          </div>

          {/* Performance + Competitors toggles */}
          <button onClick={() => setShowPerfInput(!showPerfInput)}
            className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs text-text-secondary hover:border-success transition-colors">
            + Performance
          </button>
          <button onClick={() => setShowCompetitors(!showCompetitors)}
            className="px-3 py-2 bg-bg-card border border-border rounded-lg text-xs text-text-secondary hover:border-purple-500 transition-colors">
            Competitor Ads
          </button>
        </div>

        {/* Auto-Pipeline progress */}
        {pipelineState && (
          <div className={`mb-6 p-4 rounded-xl border ${
            pipelineState.isRunning ? 'border-accent-orange bg-accent-orange/5' :
            pipelineState.stoppedAt ? 'border-warning bg-warning/5' :
            'border-success bg-success/5'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">
                {pipelineState.isRunning ? 'Auto-Pipeline Running' :
                 pipelineState.stoppedAt ? 'Pipeline Paused' : 'Pipeline Complete'}
              </span>
              <span className="text-xs text-text-muted">
                {pipelineState.completedGates.length}/{pipelineState.totalGates} gates
              </span>
            </div>
            <p className="text-xs text-text-secondary">{pipelineState.status}</p>
            {pipelineState.isRunning && (
              <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent-orange rounded-full transition-all animate-pulse"
                  style={{ width: `${(pipelineState.completedGates.length / Math.max(pipelineState.totalGates, 1)) * 100}%` }} />
              </div>
            )}
            {pipelineState.stoppedAt && (
              <Link href={`/project/${project.id}/gate/${pipelineState.stoppedAt}`}
                className="inline-block mt-2 text-xs text-accent-orange hover:underline">
                Review {pipelineState.stoppedAt}
              </Link>
            )}
          </div>
        )}

        {/* Performance input form */}
        {showPerfInput && (
          <div className="mb-6 p-4 bg-bg-card border border-success/30 rounded-xl">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Add Ad Performance Data</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input placeholder="Ad name *" value={perfForm.adName}
                onChange={e => setPerfForm(p => ({ ...p, adName: e.target.value }))}
                className="col-span-2 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <input placeholder="Date range" value={perfForm.dateRange}
                onChange={e => setPerfForm(p => ({ ...p, dateRange: e.target.value }))}
                className="col-span-2 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <input placeholder="Impressions" type="number" value={perfForm.impressions}
                onChange={e => setPerfForm(p => ({ ...p, impressions: e.target.value }))}
                className="px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <input placeholder="Clicks" type="number" value={perfForm.clicks}
                onChange={e => setPerfForm(p => ({ ...p, clicks: e.target.value }))}
                className="px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <input placeholder="CTR %" type="number" step="0.01" value={perfForm.ctr}
                onChange={e => setPerfForm(p => ({ ...p, ctr: e.target.value }))}
                className="px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <input placeholder="CPC $" type="number" step="0.01" value={perfForm.cpc}
                onChange={e => setPerfForm(p => ({ ...p, cpc: e.target.value }))}
                className="px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <input placeholder="CPA $" type="number" step="0.01" value={perfForm.cpa}
                onChange={e => setPerfForm(p => ({ ...p, cpa: e.target.value }))}
                className="px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <input placeholder="ROAS" type="number" step="0.1" value={perfForm.roas}
                onChange={e => setPerfForm(p => ({ ...p, roas: e.target.value }))}
                className="px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <input placeholder="Spend $" type="number" step="0.01" value={perfForm.spend}
                onChange={e => setPerfForm(p => ({ ...p, spend: e.target.value }))}
                className="px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <input placeholder="Conversions" type="number" value={perfForm.conversions}
                onChange={e => setPerfForm(p => ({ ...p, conversions: e.target.value }))}
                className="px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <textarea placeholder="Notes" value={perfForm.notes}
                onChange={e => setPerfForm(p => ({ ...p, notes: e.target.value }))}
                className="col-span-2 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary resize-none"
                rows={1} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={handleAddPerformance}
                className="px-4 py-2 bg-success text-white rounded-lg text-sm hover:bg-success/80">
                Save Performance Data
              </button>
              <button onClick={() => setShowPerfInput(false)}
                className="px-4 py-2 bg-border text-text-secondary rounded-lg text-sm hover:bg-border/80">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Existing performance data */}
        {project.adPerformance && project.adPerformance.length > 0 && (
          <div className="mb-6 p-4 bg-bg-card border border-success/20 rounded-xl">
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              Performance Data ({project.adPerformance.length} ads tracked)
            </h3>
            <div className="space-y-2">
              {project.adPerformance.slice(-5).map(ad => (
                <div key={ad.id} className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="font-medium text-text-primary">{ad.adName}</span>
                  <span>CTR {ad.ctr}%</span>
                  <span>CPA ${ad.cpa}</span>
                  <span>ROAS {ad.roas}x</span>
                  <span className="text-text-muted">{ad.dateRange}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitor Ads search */}
        {showCompetitors && (
          <div className="mb-6 p-4 bg-bg-card border border-purple-500/30 rounded-xl">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Competitor Ad Research</h3>
            <div className="flex gap-2 mb-3">
              <input placeholder="Search competitor ads (brand, product, niche...)"
                value={competitorQuery}
                onChange={e => setCompetitorQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchCompetitors()}
                className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary" />
              <button onClick={handleSearchCompetitors} disabled={searchingAds}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                {searchingAds ? 'Searching...' : 'Search'}
              </button>
            </div>
            {competitorAds.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {competitorAds.map((ad, i) => (
                  <div key={i} className="p-3 bg-bg-primary border border-border rounded-lg">
                    <p className="text-xs text-purple-400 mb-1">{ad.advertiser}</p>
                    <p className="text-sm font-medium text-text-primary">{ad.headline}</p>
                    {ad.body && <p className="text-xs text-text-secondary mt-1 line-clamp-3">{ad.body}</p>}
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">{ad.cta}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gates grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ALL_GATES.map((gateId) => {
            const status = project.gateStatuses[gateId];
            const accessible = canAccessGate(project, gateId);
            const isDNA = gateId === 'brand-dna';
            const isRunning = pipelineState?.isRunning && pipelineState.currentGate === gateId;

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
                  bg-bg-card border rounded-xl p-5 block relative
                  ${status === 'approved' ? 'border-success/30' : ''}
                  ${status === 'in_progress' || isRunning ? 'border-accent-orange' : ''}
                  ${status === 'pending_review' ? 'border-warning' : ''}
                  ${status === 'available' ? 'border-border hover:border-accent-orange' : ''}
                  ${status === 'locked' && !accessible ? 'border-border opacity-40 pointer-events-none' : ''}
                  ${accessible ? 'hover:bg-bg-card-hover cursor-pointer' : ''}
                `}
              >
                {isRunning && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent-orange animate-pulse" />
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-text-muted">
                    {isDNA ? 'DNA' : gateId.replace('gate', 'G')}
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

        {/* Tools & Modules */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-text-primary mb-4">Tools & Modules</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {[
              { href: `/project/${project.id}/emails`, icon: '📧', name: 'Email Sequences', desc: '7 sequences, 28+ emails with A/B/C subjects' },
              { href: `/project/${project.id}/offer-stack`, icon: '💰', name: 'Offer Stack Builder', desc: 'Bonuses, guarantee, urgency, price anchoring' },
              { href: `/project/${project.id}/ugc-briefs`, icon: '🎬', name: 'UGC Creator Briefs', desc: 'Talking Head, GRWM, Unboxing formats' },
              { href: `/project/${project.id}/carousels`, icon: '🎠', name: 'Carousel Ads', desc: '5 carousel types with narrative slides' },
              { href: `/project/${project.id}/calculator`, icon: '🧮', name: 'ROAS Calculator', desc: 'COGS, break-even, CPA, scaling scenarios' },
              { href: `/project/${project.id}/competitor-intel`, icon: '🕵️', name: 'Competitor Intel', desc: 'Ad cloner + reverse engineering' },
              { href: `/project/${project.id}/templates`, icon: '📐', name: 'Landing Pages', desc: 'Live template editor with Liquid' },
              { href: `/project/${project.id}/theme-editor`, icon: '🎨', name: 'Theme Editor', desc: 'Custom visual themes' },
            ].map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="bg-bg-card border border-border rounded-xl p-4 hover:border-accent-orange hover:bg-bg-card-hover transition-all"
              >
                <div className="text-2xl mb-2">{tool.icon}</div>
                <h3 className="text-sm font-semibold text-text-primary">{tool.name}</h3>
                <p className="text-xs text-text-muted mt-1">{tool.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
