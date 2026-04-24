'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  parseMetaAdsCSV,
  aggregateByDate,
  aggregateByFunnel,
  detectUnderperformers,
  type ParsedAdsData,
} from '@/lib/ads/csvParser';
import {
  buildInsightReport,
  compareLastTwoPeriods,
  type AdInsightReport,
  type PeriodCompare,
  type AdLearningRule,
} from '@/lib/ads/insightExtractor';
import { rollupsToAdPerformance, mergeCsvPerformance } from '@/lib/ads/applyToProject';
import { buildPerformancePrompt } from '@/lib/learning/inject';
import { getProject, saveProject } from '@/lib/store/db';
import type { Project } from '@/lib/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  Area, AreaChart, ComposedChart,
} from 'recharts';

type Tab = 'overview' | 'timeline' | 'funnel' | 'creative' | 'compare' | 'alerts' | 'ads' | 'feedback';

const FUNNEL_COLORS: Record<string, string> = {
  tof: '#3b82f6',
  mof: '#f59e0b',
  bof: '#10b981',
  retarget: '#8b5cf6',
  unknown: '#6b7280',
};

const FUNNEL_LABELS: Record<string, string> = {
  tof: 'TOF',
  mof: 'MOF',
  bof: 'BOF',
  retarget: 'RT',
  unknown: '?',
};

const VERDICT_COLORS = {
  winner: 'text-success',
  loser: 'text-error',
  mid: 'text-text-muted',
  unscored: 'text-text-muted',
};

const VERDICT_BADGES = {
  winner: 'bg-success/20 text-success border-success/30',
  loser: 'bg-error/20 text-error border-error/30',
  mid: 'bg-bg-primary text-text-muted border-border',
  unscored: 'bg-bg-primary text-text-muted border-border',
};

export default function AdPerformancePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [data, setData] = useState<ParsedAdsData | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [verdictFilter, setVerdictFilter] = useState<'all' | 'winner' | 'loser'>('all');
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  useEffect(() => {
    getProject(projectId).then(p => p && setProject(p));
  }, [projectId]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const parsed = parseMetaAdsCSV(text);
        setData(parsed);
        setTab('overview');
        setSelectedCampaign('all');
        setApplyMessage(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv'))) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (selectedCampaign === 'all') return data.rows;
    return data.rows.filter(r => r.campaign_name === selectedCampaign);
  }, [data, selectedCampaign]);

  const timeData = useMemo(() => aggregateByDate(filteredRows), [filteredRows]);
  const funnelData = useMemo(() => aggregateByFunnel(filteredRows), [filteredRows]);
  const alerts = useMemo(() => detectUnderperformers(filteredRows), [filteredRows]);

  const insights = useMemo<AdInsightReport | null>(
    () => filteredRows.length > 0 ? buildInsightReport(filteredRows) : null,
    [filteredRows],
  );

  const compare = useMemo<PeriodCompare | null>(
    () => filteredRows.length > 0 ? compareLastTwoPeriods(filteredRows) : null,
    [filteredRows],
  );

  const totals = useMemo(() => {
    const spend = filteredRows.reduce((s, r) => s + r.spend, 0);
    const impressions = filteredRows.reduce((s, r) => s + r.impressions, 0);
    const clicks = filteredRows.reduce((s, r) => s + r.clicks, 0);
    const conversions = filteredRows.reduce((s, r) => s + r.conversions, 0);
    const conversion_value = filteredRows.reduce((s, r) => s + r.conversion_value, 0);
    const reach = filteredRows.reduce((s, r) => s + r.reach, 0);
    return {
      spend, impressions, clicks, conversions, conversion_value, reach,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
      roas: spend > 0 ? conversion_value / spend : 0,
      frequency: reach > 0 ? impressions / reach : 0,
    };
  }, [filteredRows]);

  const currency = data?.currency ?? 'USD';
  const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  const filteredRollups = useMemo(() => {
    if (!insights) return [];
    if (verdictFilter === 'all') return insights.rollups;
    return insights.rollups.filter(r => r.verdict === verdictFilter);
  }, [insights, verdictFilter]);

  // Prompt preview for the AI Feedback tab
  const promptPreview = useMemo(() => {
    if (!insights || !data) return '';
    const dateRange = `${data.dateRange.min} to ${data.dateRange.max}`;
    const fakePerf = rollupsToAdPerformance(insights.rollups, dateRange);
    return buildPerformancePrompt(fakePerf);
  }, [insights, data]);

  const handleApplyToProject = useCallback(async () => {
    if (!project || !insights || !data) return;
    setApplying(true);
    setApplyMessage(null);
    try {
      const dateRange = `${data.dateRange.min} to ${data.dateRange.max}`;
      const fresh = rollupsToAdPerformance(insights.rollups, dateRange);
      const updated = mergeCsvPerformance(project, fresh);
      await saveProject(updated);
      setProject(updated);
      setApplyMessage(`✓ ${fresh.length} ads applied to "${project.name}". Agents will now use these insights on the next gate run.`);
    } catch (err) {
      setApplyMessage(`✗ Failed to apply: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApplying(false);
    }
  }, [project, insights, data]);

  // --- RENDER ---

  if (!data) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-accent-orange">Ad Performance — Feedback Loop</h1>
              <p className="text-text-muted text-sm mt-1">
                Upload your Meta Ads CSV. Pawen extracts winners/losers patterns and feeds them back to the agents.
              </p>
            </div>
            <Link href={`/project/${projectId}`} className="text-text-muted hover:text-text-secondary text-sm">
              Back to project
            </Link>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${
              dragActive ? 'border-accent-orange bg-accent-orange/5' : 'border-border hover:border-text-muted'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <div className="text-5xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Drop your Meta Ads CSV here
            </h2>
            <p className="text-text-muted mb-6 max-w-md mx-auto">
              Export from Meta Ads Manager: Ads Reporting → Export → CSV.<br />
              Include: Campaign, Ad Set, Ad Name, Date, Impressions, Spend, Clicks, Results, ROAS, Frequency
            </p>
            <label className="inline-block px-6 py-3 bg-accent-orange text-white font-semibold rounded-lg cursor-pointer hover:bg-accent-orange-hover">
              Select CSV File
              <input type="file" accept=".csv,.tsv" className="hidden" onChange={handleInputChange} />
            </label>
            <p className="text-text-muted text-xs mt-4">
              Supports EN / FR / ES / DE / IT / PT exports. Data stays in your browser.
            </p>
          </div>

          <div className="mt-8 p-4 bg-bg-card border border-border rounded-xl">
            <h3 className="text-sm font-semibold text-text-primary mb-2">How the feedback loop works</h3>
            <ol className="text-text-secondary text-sm space-y-1.5 list-decimal list-inside">
              <li>You upload Meta Ads Manager CSV (any language).</li>
              <li>Pawen tags every ad by hook type, format, angle, awareness level — extracted from the ad name.</li>
              <li>Top quartile by ROAS = <span className="text-success font-semibold">winners</span>. Bottom quartile or no conversions = <span className="text-error font-semibold">losers</span>.</li>
              <li>You review the insights, then click <strong>Apply to Pawen</strong>.</li>
              <li>Every gate from now on receives the winning patterns + losing patterns + concrete rules in its prompt.</li>
            </ol>
            <p className="text-text-muted text-xs mt-3">
              Tip: name your ads with a clear pattern (e.g. <code className="bg-bg-primary px-1.5 py-0.5 rounded">TOF_UGC_Q-hook_transformation_v3</code>) so tagging is accurate.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; badge?: number; accent?: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'funnel', label: 'TOF / MOF / BOF' },
    { id: 'creative', label: 'Creative Patterns', badge: insights?.rules.length },
    { id: 'compare', label: 'WoW Compare' },
    { id: 'alerts', label: 'Alerts', badge: alerts.filter(a => a.level === 'critical').length },
    { id: 'ads', label: 'Per Ad' },
    { id: 'feedback', label: '→ AI Feedback', accent: 'text-accent-orange' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-accent-orange">Ad Performance — Feedback Loop</h1>
            <p className="text-text-muted text-xs">
              {data.dateRange.min} → {data.dateRange.max} · {data.campaigns.length} campaigns · {data.ads.length} ads · {currency}
              {insights && (
                <>
                  {' '}· <span className="text-success">{insights.totals.winnerCount} winners</span>
                  {' / '}<span className="text-error">{insights.totals.loserCount} losers</span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-text-primary text-sm"
            >
              <option value="all">All Campaigns ({data.campaigns.length})</option>
              {data.campaigns.map(c => (
                <option key={c} value={c}>{c.length > 40 ? c.slice(0, 40) + '...' : c}</option>
              ))}
            </select>
            <label className="px-3 py-1.5 border border-border rounded-lg text-text-secondary text-sm cursor-pointer hover:border-accent-orange">
              Upload new CSV
              <input type="file" accept=".csv,.tsv" className="hidden" onChange={handleInputChange} />
            </label>
            <Link href={`/project/${projectId}`} className="text-text-muted hover:text-text-secondary text-sm">
              Back
            </Link>
          </div>
        </div>

        {/* Errors */}
        {data.errors.length > 0 && (
          <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm">
            {data.errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}

        {/* Apply banner — primary CTA */}
        {insights && project && (
          <div className="mb-4 p-3 bg-accent-orange/10 border border-accent-orange/30 rounded-lg flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-accent-orange font-semibold">Feed these insights into Pawen.</span>
              <span className="text-text-secondary">
                {' '}{insights.rules.length} actionable rules ready · {insights.totals.winnerCount} winners + {insights.totals.loserCount} losers tagged
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTab('feedback')}
                className="text-text-secondary hover:text-text-primary text-xs underline"
              >
                Preview prompt
              </button>
              <button
                onClick={handleApplyToProject}
                disabled={applying}
                className="px-4 py-1.5 bg-accent-orange text-white font-semibold rounded-lg text-sm hover:bg-accent-orange-hover disabled:opacity-50"
              >
                {applying ? 'Applying...' : 'Apply to Pawen'}
              </button>
            </div>
          </div>
        )}

        {applyMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            applyMessage.startsWith('✓')
              ? 'bg-success/10 border border-success/30 text-success'
              : 'bg-error/10 border border-error/30 text-error'
          }`}>
            {applyMessage}
          </div>
        )}

        {/* Critical alert banner */}
        {alerts.filter(a => a.level === 'critical').length > 0 && (
          <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg flex items-center gap-2 cursor-pointer" onClick={() => setTab('alerts')}>
            <span className="text-error font-bold text-sm">
              {alerts.filter(a => a.level === 'critical').length} critical alert{alerts.filter(a => a.level === 'critical').length > 1 ? 's' : ''}
            </span>
            <span className="text-error/70 text-xs">— click to view</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-accent-orange text-accent-orange'
                  : `border-transparent ${t.accent ?? 'text-text-muted'} hover:text-text-secondary`
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className="ml-1.5 px-1.5 py-0.5 bg-accent-orange text-white text-[10px] font-bold rounded-full">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ===== OVERVIEW TAB ===== */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: 'Spend', value: `${sym}${totals.spend.toFixed(2)}`, color: 'text-text-primary' },
                { label: 'ROAS', value: `${totals.roas.toFixed(2)}x`, color: totals.roas >= 2 ? 'text-success' : totals.roas >= 1 ? 'text-warning' : 'text-error' },
                { label: 'CPA', value: `${sym}${totals.cpa.toFixed(2)}`, color: 'text-text-primary' },
                { label: 'CTR', value: `${totals.ctr.toFixed(2)}%`, color: totals.ctr >= 1 ? 'text-success' : 'text-warning' },
                { label: 'CPM', value: `${sym}${totals.cpm.toFixed(2)}`, color: 'text-text-primary' },
                { label: 'Conversions', value: `${totals.conversions}`, color: 'text-success' },
                { label: 'Clicks', value: totals.clicks.toLocaleString(), color: 'text-text-primary' },
                { label: 'Impressions', value: totals.impressions.toLocaleString(), color: 'text-text-primary' },
                { label: 'Reach', value: totals.reach.toLocaleString(), color: 'text-text-primary' },
                { label: 'Frequency', value: totals.frequency.toFixed(2), color: totals.frequency > 3 ? 'text-error' : 'text-text-primary' },
                { label: 'CPC', value: `${sym}${totals.cpc.toFixed(2)}`, color: 'text-text-primary' },
                { label: 'Revenue', value: `${sym}${totals.conversion_value.toFixed(2)}`, color: 'text-success' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-bg-card border border-border rounded-lg p-3">
                  <div className="text-text-muted text-[10px] uppercase tracking-wider">{kpi.label}</div>
                  <div className={`text-lg font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {timeData.length > 1 && (
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Spend vs ROAS over time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis yAxisId="spend" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis yAxisId="roas" orientation="right" tick={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} labelStyle={{ color: '#888' }} />
                    <Legend />
                    <Area yAxisId="spend" type="monotone" dataKey="spend" fill="#f97316" fillOpacity={0.15} stroke="#f97316" name={`Spend (${sym})`} />
                    <Line yAxisId="roas" type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={2} dot={false} name="ROAS" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {funnelData.length > 0 && (
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Funnel Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {funnelData.map(f => (
                    <div key={f.stage} className="p-3 rounded-lg border" style={{ borderColor: f.color + '60', backgroundColor: f.color + '10' }}>
                      <div className="text-xs font-bold" style={{ color: f.color }}>{f.label}</div>
                      <div className="text-lg font-bold text-text-primary mt-1">{sym}{f.spend.toFixed(0)}</div>
                      <div className="text-text-muted text-[10px] mt-1">
                        {f.adCount} ads · ROAS {f.roas.toFixed(2)}x · CPA {sym}{f.cpa.toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== TIMELINE TAB ===== */}
        {tab === 'timeline' && timeData.length > 0 && (
          <div className="space-y-6">
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">CPM / CTR / CPC</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="cpm" stroke="#ef4444" strokeWidth={2} dot={false} name="CPM" />
                  <Line type="monotone" dataKey="ctr" stroke="#3b82f6" strokeWidth={2} dot={false} name="CTR %" />
                  <Line type="monotone" dataKey="cpc" stroke="#f59e0b" strokeWidth={2} dot={false} name="CPC" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Conversions / CPA</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis yAxisId="conv" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis yAxisId="cpa" orientation="right" tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                  <Legend />
                  <Bar yAxisId="conv" dataKey="conversions" fill="#10b981" name="Conversions" />
                  <Line yAxisId="cpa" type="monotone" dataKey="cpa" stroke="#ef4444" strokeWidth={2} dot={false} name="CPA" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Frequency (Ad Fatigue Indicator)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="frequency" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} name="Frequency" />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-text-muted text-xs mt-2">Above 3.0 = audience fatigue. Above 5.0 = creative needs refresh urgently.</p>
            </div>
          </div>
        )}

        {/* ===== FUNNEL TAB ===== */}
        {tab === 'funnel' && (
          <div className="space-y-6">
            {funnelData.length === 0 ? (
              <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-muted">
                <p>No funnel data detected. Name your campaigns with TOF/MOF/BOF/Retarget keywords for auto-classification.</p>
                <p className="text-xs mt-2">Examples: &quot;TOF - Broad Interest&quot;, &quot;BOF - Retarget ATC&quot;, &quot;MOF - Video Viewers&quot;</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-bg-card border border-border rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-text-primary mb-3">Spend by Funnel Stage</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={funnelData}
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={100}
                          dataKey="spend" nameKey="label"
                          label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        >
                          {funnelData.map(f => <Cell key={f.stage} fill={f.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-bg-card border border-border rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-text-primary mb-3">ROAS by Funnel Stage</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={funnelData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                        <Bar dataKey="roas" name="ROAS">
                          {funnelData.map(f => <Cell key={f.stage} fill={f.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-bg-card border border-border rounded-xl p-4 overflow-x-auto">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Funnel Metrics Comparison</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-text-muted text-xs border-b border-border">
                        <th className="text-left py-2 pr-4">Stage</th>
                        <th className="text-right py-2 px-2">Spend</th>
                        <th className="text-right py-2 px-2">Conv.</th>
                        <th className="text-right py-2 px-2">CPA</th>
                        <th className="text-right py-2 px-2">ROAS</th>
                        <th className="text-right py-2 px-2">CTR</th>
                        <th className="text-right py-2 px-2">CPM</th>
                        <th className="text-right py-2 px-2">Ads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funnelData.map(f => (
                        <tr key={f.stage} className="border-b border-border/50">
                          <td className="py-2 pr-4">
                            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: f.color }} />
                            <span className="font-medium text-text-primary">{f.label}</span>
                          </td>
                          <td className="text-right py-2 px-2 text-text-primary">{sym}{f.spend.toFixed(0)}</td>
                          <td className="text-right py-2 px-2 text-text-primary">{f.conversions}</td>
                          <td className="text-right py-2 px-2 text-text-primary">{sym}{f.cpa.toFixed(2)}</td>
                          <td className={`text-right py-2 px-2 font-bold ${f.roas >= 2 ? 'text-success' : f.roas >= 1 ? 'text-warning' : 'text-error'}`}>
                            {f.roas.toFixed(2)}x
                          </td>
                          <td className="text-right py-2 px-2 text-text-primary">{f.ctr.toFixed(2)}%</td>
                          <td className="text-right py-2 px-2 text-text-primary">{sym}{f.cpm.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-text-muted">{f.adCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== CREATIVE PATTERNS TAB ===== */}
        {tab === 'creative' && insights && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <PatternCard title="Hook Type" insights={insights.hookInsights} sym={sym} />
              <PatternCard title="Format" insights={insights.formatInsights} sym={sym} />
              <PatternCard title="Angle" insights={insights.angleInsights} sym={sym} />
              <PatternCard title="Awareness Level" insights={insights.awarenessInsights} sym={sym} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-bg-card border border-success/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-success mb-3">🏆 Top Winners</h3>
                <div className="space-y-2">
                  {insights.topWinners.length === 0 && (
                    <p className="text-text-muted text-xs">Need ≥ 3 ads with $20+ spend each to score winners.</p>
                  )}
                  {insights.topWinners.map(w => (
                    <div key={w.name} className="p-2 bg-success/5 border border-success/20 rounded-lg">
                      <div className="text-xs text-text-primary font-medium truncate">{w.name}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">{w.verdictReason}</div>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {w.hookType !== 'unknown' && <span className="px-1.5 py-0.5 bg-bg-primary text-[9px] rounded text-text-secondary">{w.hookType}</span>}
                        {w.formatType !== 'unknown' && <span className="px-1.5 py-0.5 bg-bg-primary text-[9px] rounded text-text-secondary">{w.formatType}</span>}
                        {w.angle !== 'unknown' && <span className="px-1.5 py-0.5 bg-bg-primary text-[9px] rounded text-text-secondary">{w.angle}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-bg-card border border-error/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-error mb-3">💀 Top Losers</h3>
                <div className="space-y-2">
                  {insights.topLosers.length === 0 && (
                    <p className="text-text-muted text-xs">No clear losers detected.</p>
                  )}
                  {insights.topLosers.map(l => (
                    <div key={l.name} className="p-2 bg-error/5 border border-error/20 rounded-lg">
                      <div className="text-xs text-text-primary font-medium truncate">{l.name}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">{l.verdictReason}</div>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {l.hookType !== 'unknown' && <span className="px-1.5 py-0.5 bg-bg-primary text-[9px] rounded text-text-secondary">{l.hookType}</span>}
                        {l.formatType !== 'unknown' && <span className="px-1.5 py-0.5 bg-bg-primary text-[9px] rounded text-text-secondary">{l.formatType}</span>}
                        {l.angle !== 'unknown' && <span className="px-1.5 py-0.5 bg-bg-primary text-[9px] rounded text-text-secondary">{l.angle}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Verdict filter table */}
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">Tagged Ad Inventory</h3>
                <div className="flex gap-1">
                  {(['all', 'winner', 'loser'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setVerdictFilter(f)}
                      className={`px-2.5 py-1 text-xs rounded-lg border ${
                        verdictFilter === f
                          ? 'bg-accent-orange/20 border-accent-orange text-accent-orange'
                          : 'border-border text-text-muted hover:border-text-muted'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'winner' ? '🏆 Winners' : '💀 Losers'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-muted border-b border-border">
                      <th className="text-left py-1.5 pr-2">Ad</th>
                      <th className="text-left py-1.5 px-1">Verdict</th>
                      <th className="text-left py-1.5 px-1">Hook</th>
                      <th className="text-left py-1.5 px-1">Format</th>
                      <th className="text-left py-1.5 px-1">Angle</th>
                      <th className="text-right py-1.5 px-2">Spend</th>
                      <th className="text-right py-1.5 px-2">ROAS</th>
                      <th className="text-right py-1.5 px-2">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRollups.slice(0, 50).map(r => (
                      <tr key={r.name} className="border-b border-border/30">
                        <td className="py-1.5 pr-2 max-w-[220px] truncate text-text-primary">{r.name}</td>
                        <td className="py-1.5 px-1">
                          <span className={`px-1.5 py-0.5 text-[9px] rounded border ${VERDICT_BADGES[r.verdict]}`}>
                            {r.verdict}
                          </span>
                        </td>
                        <td className="py-1.5 px-1 text-text-secondary">{r.hookType}</td>
                        <td className="py-1.5 px-1 text-text-secondary">{r.formatType}</td>
                        <td className="py-1.5 px-1 text-text-secondary">{r.angle}</td>
                        <td className="text-right py-1.5 px-2 text-text-primary">{sym}{r.spend.toFixed(0)}</td>
                        <td className={`text-right py-1.5 px-2 font-medium ${VERDICT_COLORS[r.verdict]}`}>{r.roas.toFixed(2)}x</td>
                        <td className="text-right py-1.5 px-2 text-text-secondary">{r.ctr.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== COMPARE TAB ===== */}
        {tab === 'compare' && (
          <div className="space-y-6">
            {!compare ? (
              <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-muted">
                Need at least 4 days of data to split into two comparable periods.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-bg-card border border-border rounded-xl p-4">
                    <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Previous</div>
                    <div className="text-text-primary text-sm">{compare.previous.from} → {compare.previous.to}</div>
                  </div>
                  <div className="bg-bg-card border border-accent-orange/30 rounded-xl p-4">
                    <div className="text-accent-orange text-xs uppercase tracking-wider mb-1">Current</div>
                    <div className="text-text-primary text-sm">{compare.current.from} → {compare.current.to}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Spend', curr: `${sym}${compare.current.spend.toFixed(0)}`, prev: `${sym}${compare.previous.spend.toFixed(0)}`, delta: compare.deltas.spend, lowerBetter: false },
                    { label: 'Conversions', curr: compare.current.conversions.toString(), prev: compare.previous.conversions.toString(), delta: compare.deltas.conversions, lowerBetter: false },
                    { label: 'ROAS', curr: `${compare.current.roas.toFixed(2)}x`, prev: `${compare.previous.roas.toFixed(2)}x`, delta: compare.deltas.roas, lowerBetter: false },
                    { label: 'CTR', curr: `${compare.current.ctr.toFixed(2)}%`, prev: `${compare.previous.ctr.toFixed(2)}%`, delta: compare.deltas.ctr, lowerBetter: false },
                    { label: 'CPA', curr: `${sym}${compare.current.cpa.toFixed(2)}`, prev: `${sym}${compare.previous.cpa.toFixed(2)}`, delta: compare.deltas.cpa, lowerBetter: true },
                  ].map(k => {
                    const positive = k.lowerBetter ? k.delta < 0 : k.delta > 0;
                    const color = Math.abs(k.delta) < 0.1 ? 'text-text-muted' : positive ? 'text-success' : 'text-error';
                    const arrow = k.delta > 0.1 ? '↑' : k.delta < -0.1 ? '↓' : '→';
                    return (
                      <div key={k.label} className="bg-bg-card border border-border rounded-lg p-3">
                        <div className="text-text-muted text-[10px] uppercase tracking-wider">{k.label}</div>
                        <div className="text-lg font-bold text-text-primary mt-0.5">{k.curr}</div>
                        <div className={`text-xs mt-1 font-semibold ${color}`}>
                          {arrow} {Math.abs(k.delta).toFixed(1)}%
                        </div>
                        <div className="text-text-muted text-[10px] mt-0.5">prev: {k.prev}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== ALERTS TAB ===== */}
        {tab === 'alerts' && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="bg-bg-card border border-success/30 rounded-xl p-8 text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-success font-semibold">No performance alerts</p>
                <p className="text-text-muted text-sm mt-1">All ads are performing within normal ranges</p>
              </div>
            ) : (
              alerts.map((alert, i) => {
                const fix = recommendFix(alert.metric, alert.value);
                return (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border ${
                      alert.level === 'critical'
                        ? 'bg-error/10 border-error/30'
                        : alert.level === 'warning'
                        ? 'bg-warning/10 border-warning/30'
                        : 'bg-bg-card border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                            alert.level === 'critical' ? 'bg-error text-white' : 'bg-warning text-black'
                          }`}>
                            {alert.level}
                          </span>
                          <span className="text-text-primary font-medium text-sm">{alert.ad_name}</span>
                        </div>
                        <p className="text-text-secondary text-sm mt-1">{alert.message}</p>
                        <p className="text-text-muted text-xs mt-0.5">Campaign: {alert.campaign_name}</p>
                        {fix && (
                          <p className="text-accent-orange text-xs mt-2 flex items-start gap-1">
                            <span className="font-bold">→ Fix:</span>
                            <span>{fix}</span>
                          </p>
                        )}
                      </div>
                      <span className="text-text-muted text-xs bg-bg-primary px-2 py-1 rounded">{alert.metric}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== PER AD TAB ===== */}
        {tab === 'ads' && insights && (
          <div className="bg-bg-card border border-border rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border">
                  <th className="text-left py-2 pr-3">Ad</th>
                  <th className="text-center py-2 px-1 w-8">F</th>
                  <th className="text-right py-2 px-2">Spend</th>
                  <th className="text-right py-2 px-2">Impr.</th>
                  <th className="text-right py-2 px-2">Clicks</th>
                  <th className="text-right py-2 px-2">CTR</th>
                  <th className="text-right py-2 px-2">CPC</th>
                  <th className="text-right py-2 px-2">CPM</th>
                  <th className="text-right py-2 px-2">Conv.</th>
                  <th className="text-right py-2 px-2">CPA</th>
                  <th className="text-right py-2 px-2">ROAS</th>
                  <th className="text-right py-2 px-2">Freq.</th>
                </tr>
              </thead>
              <tbody>
                {insights.rollups.sort((a, b) => b.spend - a.spend).map((ad, i) => {
                  const hasAlert = alerts.some(a => a.ad_name === ad.name && a.level === 'critical');
                  return (
                    <tr key={i} className={`border-b border-border/30 ${hasAlert ? 'bg-error/5' : ''}`}>
                      <td className="py-2 pr-3 max-w-[200px]">
                        <div className="text-text-primary font-medium text-xs truncate">{ad.name}</div>
                        <div className="text-text-muted text-[10px] truncate">{ad.campaign}</div>
                      </td>
                      <td className="text-center py-2 px-1">
                        <span
                          className="inline-block w-5 h-5 rounded text-[9px] font-bold leading-5 text-center"
                          style={{
                            backgroundColor: (FUNNEL_COLORS[ad.funnel ?? 'unknown'] ?? '#6b7280') + '30',
                            color: FUNNEL_COLORS[ad.funnel ?? 'unknown'] ?? '#6b7280',
                          }}
                        >
                          {FUNNEL_LABELS[ad.funnel ?? 'unknown'] ?? '?'}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 text-text-primary">{sym}{ad.spend.toFixed(0)}</td>
                      <td className="text-right py-2 px-2 text-text-muted">{ad.impressions.toLocaleString()}</td>
                      <td className="text-right py-2 px-2 text-text-muted">{ad.clicks.toLocaleString()}</td>
                      <td className={`text-right py-2 px-2 ${ad.ctr >= 1 ? 'text-success' : ad.ctr >= 0.5 ? 'text-text-primary' : 'text-error'}`}>
                        {ad.ctr.toFixed(2)}%
                      </td>
                      <td className="text-right py-2 px-2 text-text-primary">{sym}{ad.cpc.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-text-primary">{sym}{ad.cpm.toFixed(0)}</td>
                      <td className="text-right py-2 px-2 text-text-primary font-medium">{ad.conversions}</td>
                      <td className="text-right py-2 px-2 text-text-primary">
                        {ad.cpa === Infinity ? '-' : `${sym}${ad.cpa.toFixed(0)}`}
                      </td>
                      <td className={`text-right py-2 px-2 font-bold ${ad.roas >= 2 ? 'text-success' : ad.roas >= 1 ? 'text-warning' : 'text-error'}`}>
                        {ad.roas.toFixed(2)}x
                      </td>
                      <td className={`text-right py-2 px-2 ${ad.frequency > 4 ? 'text-error' : ad.frequency > 3 ? 'text-warning' : 'text-text-muted'}`}>
                        {ad.frequency.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== AI FEEDBACK TAB ===== */}
        {tab === 'feedback' && insights && (
          <div className="space-y-6">
            <div className="bg-bg-card border border-accent-orange/30 rounded-xl p-5">
              <h2 className="text-base font-bold text-accent-orange mb-2">What Pawen will learn from this CSV</h2>
              <p className="text-text-secondary text-sm">
                Apply these insights to <strong>{project?.name ?? 'your project'}</strong>. Every gate run after that will receive the prompt block below — agents calibrate copy and creatives accordingly.
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleApplyToProject}
                  disabled={applying || !project}
                  className="px-4 py-2 bg-accent-orange text-white font-semibold rounded-lg text-sm hover:bg-accent-orange-hover disabled:opacity-50"
                >
                  {applying ? 'Applying...' : `Apply to ${project?.name ?? '…'}`}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(promptPreview)}
                  className="px-4 py-2 border border-border rounded-lg text-text-secondary text-sm hover:border-accent-orange"
                >
                  Copy prompt block
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">Generated Rules ({insights.rules.length})</h3>
              <div className="space-y-2">
                {insights.rules.length === 0 && (
                  <p className="text-text-muted text-sm">Need more spend across more ads to extract reliable rules. Upload more data and re-try.</p>
                )}
                {insights.rules.map((r, i) => (
                  <RuleCard key={i} rule={r} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">Prompt Block Preview</h3>
              <p className="text-text-muted text-xs mb-2">This is the exact text injected into every agent prompt after applying.</p>
              <pre className="bg-bg-primary border border-border rounded-lg p-4 text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {promptPreview || '(no patterns yet — apply produces an empty block)'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// SUB-COMPONENTS
// =====================================================================

function PatternCard<K extends string>({
  title,
  insights,
  sym,
}: {
  title: string;
  insights: Array<{ key: K; label: string; spend: number; conversions: number; roas: number; ctr: number; adCount: number; winnerCount: number; loserCount: number; winRate: number; confidence: 'high' | 'medium' | 'low' }>;
  sym: string;
}) {
  if (insights.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-2">{title}</h3>
        <p className="text-text-muted text-xs">No tagged data — name your ads with hook/format keywords for auto-tagging.</p>
      </div>
    );
  }
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{title}</h3>
      <div className="space-y-2">
        {insights.slice(0, 5).map(p => {
          const winColor = p.winRate >= 0.6 ? 'text-success' : p.winRate <= 0.25 ? 'text-error' : 'text-text-muted';
          const confDot = p.confidence === 'high' ? 'bg-success' : p.confidence === 'medium' ? 'bg-warning' : 'bg-text-muted';
          return (
            <div key={p.key} className="border-b border-border/40 pb-2 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-text-primary truncate">{p.label}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${confDot}`} title={`Confidence: ${p.confidence}`} />
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] text-text-muted">
                <span>{sym}{p.spend.toFixed(0)} · {p.adCount} ads</span>
                <span className={winColor}>
                  {p.winnerCount}W / {p.loserCount}L
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5 text-[10px]">
                <span className="text-text-muted">CTR {p.ctr.toFixed(2)}%</span>
                <span className={`font-bold ${p.roas >= 2 ? 'text-success' : p.roas >= 1 ? 'text-warning' : 'text-error'}`}>
                  ROAS {p.roas.toFixed(2)}x
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RuleCard({ rule }: { rule: AdLearningRule }) {
  const styles = {
    do_more: { bg: 'bg-success/5', border: 'border-success/30', icon: '✓', accent: 'text-success' },
    avoid: { bg: 'bg-error/5', border: 'border-error/30', icon: '✗', accent: 'text-error' },
    fix: { bg: 'bg-warning/5', border: 'border-warning/30', icon: '⚙', accent: 'text-warning' },
  }[rule.type];
  return (
    <div className={`p-3 rounded-lg border ${styles.bg} ${styles.border}`}>
      <div className="flex items-start gap-3">
        <div className={`text-lg ${styles.accent} font-bold leading-none mt-0.5`}>{styles.icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-text-primary text-sm font-medium">{rule.message}</span>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-bg-primary text-text-muted">{rule.scope}</span>
            {rule.priority === 'high' && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-orange/20 text-accent-orange">high priority</span>
            )}
          </div>
          <p className="text-text-muted text-xs mt-1">{rule.evidence}</p>
        </div>
      </div>
    </div>
  );
}

// Action recommendations per alert metric — keeps the suggestion in one place
function recommendFix(metric: string, value: number): string | null {
  switch (metric) {
    case 'frequency':
      return value > 6
        ? 'Pause this ad immediately and launch fresh creative — audience has seen it too many times.'
        : 'Refresh the creative (new hook, new visual) within 48h before frequency hits 6x.';
    case 'ctr':
      return 'Re-write the opening hook. Test a question, stat, or pattern-interrupt variant.';
    case 'cpm':
      return value > 50
        ? 'Audience is too narrow or auction is too competitive. Broaden targeting or shift budget to MOF/BOF.'
        : 'Consider broader interest stacking or lookalike expansion to lower CPM.';
    case 'no_conversions':
      return 'Kill this ad. Reallocate spend to a winning creative or test a new angle.';
    case 'ctr_decline':
      return 'Creative fatigue confirmed. Generate a new variant (different hook + visual) and rotate in.';
    default:
      return null;
  }
}
