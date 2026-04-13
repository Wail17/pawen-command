'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getProject, getAllGateOutputs } from '@/lib/store/db';
import { demoUgcBriefs, type UgcBrief } from '@/lib/gates/demoData';
import Pipeline from '@/components/ui/Pipeline';

type UgcFormat = 'talking_head' | 'grwm' | 'unboxing_review';

const FORMAT_OPTIONS: { value: UgcFormat; label: string; icon: string; description: string }[] = [
  { value: 'talking_head', label: 'Talking Head', icon: '🗣️', description: '30-60s direct-to-camera testimonial style' },
  { value: 'grwm', label: 'Get Ready With Me', icon: '💄', description: '60-90s lifestyle routine with product integration' },
  { value: 'unboxing_review', label: 'Unboxing / Review', icon: '📦', description: '45-75s honest first impressions + results' },
];

export default function UgcBriefsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<UgcFormat>('talking_head');
  const [briefs, setBriefs] = useState<UgcBrief[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const briefRef = useRef<HTMLDivElement>(null);

  // Load project
  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);
      setLoading(false);
    })();
  }, [projectId, router]);

  // Toggle section expansion
  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Build project context for API
  const buildProjectContext = useCallback(async () => {
    const allOutputs = await getAllGateOutputs(projectId);
    const outputs: Record<string, unknown> = {};
    for (const o of allOutputs) {
      outputs[o.gateId] = o.data;
    }

    const gate3 = outputs['gate3'] as Record<string, unknown> | undefined;
    const gate4 = outputs['gate4'] as Record<string, unknown> | undefined;
    const gate6 = outputs['gate6'] as Record<string, unknown> | undefined;
    const brandDna = outputs['brand-dna'] as Record<string, unknown> | undefined;

    return {
      productName: project?.name || '',
      targetAudience: project?.niche || '',
      brandDna: brandDna ? JSON.stringify(brandDna, null, 2).slice(0, 4000) : '',
      mechanism: gate3 ? JSON.stringify(gate3, null, 2).slice(0, 3000) : '',
      hooks: gate4 ? JSON.stringify(gate4, null, 2).slice(0, 3000) : '',
      scripts: gate6 ? JSON.stringify(gate6, null, 2).slice(0, 3000) : '',
      tone: (brandDna as Record<string, unknown>)?.voice_guidelines
        ? JSON.stringify((brandDna as Record<string, unknown>).voice_guidelines, null, 2).slice(0, 1500)
        : '',
    };
  }, [projectId, project]);

  // Generate brief via API
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const projectContext = await buildProjectContext();
      const res = await fetch('/api/ugc-briefs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: selectedFormat, projectContext }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Generation failed');
      }
      const data = await res.json();
      if (data.brief) {
        setBriefs(prev => {
          const filtered = prev.filter(b => b.format !== selectedFormat);
          return [...filtered, data.brief];
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  }, [selectedFormat, buildProjectContext]);

  // Load demo briefs
  const handleLoadDemo = useCallback(() => {
    const demo = demoUgcBriefs();
    setBriefs(demo);
    // Expand all sections for the first brief
    setExpandedSections({
      overview: true,
      script_structure: true,
      talking_points: true,
      emotional_beats: false,
      broll_shot_list: false,
      dos_and_donts: false,
      wardrobe_setting: false,
      cta_instructions: true,
      technical_specs: false,
    });
  }, []);

  // Copy brief to clipboard as formatted text
  const handleCopy = useCallback(async () => {
    const currentBrief = briefs.find(b => b.format === selectedFormat);
    if (!currentBrief) return;
    const text = formatBriefAsText(currentBrief);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [briefs, selectedFormat]);

  // Export as printable HTML
  const handleExportPdf = useCallback(() => {
    const currentBrief = briefs.find(b => b.format === selectedFormat);
    if (!currentBrief) return;
    const html = generatePrintableHtml(currentBrief);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  }, [briefs, selectedFormat]);

  const currentBrief = briefs.find(b => b.format === selectedFormat);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-bg-primary">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-muted animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Pipeline project={project} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text-primary">UGC Creator Brief Generator</h1>
            <p className="text-text-secondary mt-1">
              Generate professional briefs to send directly to UGC content creators.
            </p>
          </div>

          {/* Format Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {FORMAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedFormat(opt.value)}
                className={`
                  rounded-xl border p-5 text-left transition-all
                  ${selectedFormat === opt.value
                    ? 'border-accent-teal bg-accent-teal/10 ring-1 ring-accent-teal'
                    : 'border-border bg-bg-card hover:bg-bg-card-hover'
                  }
                `}
              >
                <span className="text-2xl">{opt.icon}</span>
                <h3 className={`font-semibold mt-2 ${selectedFormat === opt.value ? 'text-accent-teal' : 'text-text-primary'}`}>
                  {opt.label}
                </h3>
                <p className="text-text-muted text-sm mt-1">{opt.description}</p>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-2.5 rounded-lg bg-accent-teal text-white font-medium hover:bg-accent-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                'Generate Brief'
              )}
            </button>

            <button
              onClick={handleLoadDemo}
              className="px-6 py-2.5 rounded-lg border border-accent-orange text-accent-orange font-medium hover:bg-accent-orange/10 transition-colors"
            >
              Load Demo
            </button>

            {currentBrief && (
              <>
                <button
                  onClick={handleExportPdf}
                  className="px-6 py-2.5 rounded-lg border border-border text-text-secondary font-medium hover:bg-bg-card-hover transition-colors"
                >
                  Export PDF
                </button>
                <button
                  onClick={handleCopy}
                  className="px-6 py-2.5 rounded-lg border border-border text-text-secondary font-medium hover:bg-bg-card-hover transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy Brief'}
                </button>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
              {error}
            </div>
          )}

          {/* Brief Display */}
          {currentBrief && (
            <div ref={briefRef} className="space-y-4">
              {/* Brief Header */}
              <div className="rounded-xl border border-border bg-bg-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">{currentBrief.format_label}</h2>
                    <p className="text-text-muted text-sm mt-1">Duration: {currentBrief.duration}</p>
                  </div>
                  <span className="text-3xl">
                    {FORMAT_OPTIONS.find(f => f.value === currentBrief.format)?.icon}
                  </span>
                </div>
              </div>

              {/* Overview */}
              <BriefSection
                title="Overview"
                sectionKey="overview"
                expanded={expandedSections['overview'] !== false}
                onToggle={toggleSection}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldCard label="Product" value={currentBrief.brief.overview.product_name} />
                  <FieldCard label="Target Audience" value={currentBrief.brief.overview.target_audience} />
                  <FieldCard label="Key Message" value={currentBrief.brief.overview.key_message} className="md:col-span-2" accent />
                  <FieldCard label="Tone" value={currentBrief.brief.overview.tone} className="md:col-span-2" />
                </div>
              </BriefSection>

              {/* Script Structure */}
              <BriefSection
                title="Script Structure"
                sectionKey="script_structure"
                badge={`${currentBrief.brief.script_structure.length} beats`}
                expanded={expandedSections['script_structure'] !== false}
                onToggle={toggleSection}
              >
                <div className="space-y-3">
                  {currentBrief.brief.script_structure.map((beat, i) => (
                    <div key={i} className="flex gap-4 p-3 rounded-lg bg-bg-primary/50">
                      <div className="flex-shrink-0 w-20">
                        <span className="text-accent-teal font-mono text-sm font-semibold">{beat.timing}</span>
                      </div>
                      <div className="flex-shrink-0 w-32">
                        <span className="inline-block px-2 py-0.5 rounded bg-accent-orange/20 text-accent-orange text-xs font-bold">
                          {beat.beat}
                        </span>
                      </div>
                      <p className="text-text-secondary text-sm flex-1">{beat.description}</p>
                    </div>
                  ))}
                </div>
              </BriefSection>

              {/* Talking Points */}
              <BriefSection
                title="Talking Points"
                sectionKey="talking_points"
                badge={`${currentBrief.brief.talking_points.length} phrases`}
                expanded={expandedSections['talking_points'] !== false}
                onToggle={toggleSection}
              >
                <div className="space-y-2">
                  {currentBrief.brief.talking_points.map((point, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-bg-primary/50">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-teal/20 text-accent-teal text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="text-text-primary text-sm italic">{point}</p>
                    </div>
                  ))}
                </div>
              </BriefSection>

              {/* Emotional Beats */}
              <BriefSection
                title="Emotional Beats"
                sectionKey="emotional_beats"
                badge={`${currentBrief.brief.emotional_beats.length} moments`}
                expanded={expandedSections['emotional_beats'] ?? false}
                onToggle={toggleSection}
              >
                <div className="space-y-3">
                  {currentBrief.brief.emotional_beats.map((beat, i) => (
                    <div key={i} className="flex gap-4 p-3 rounded-lg bg-bg-primary/50">
                      <div className="flex-shrink-0 w-20">
                        <span className="text-accent-orange font-mono text-sm">{beat.timing}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-text-primary text-sm font-semibold">{beat.emotion}</p>
                        <p className="text-text-muted text-xs mt-1">{beat.direction}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </BriefSection>

              {/* B-Roll Shot List */}
              <BriefSection
                title="B-Roll Shot List"
                sectionKey="broll_shot_list"
                badge={`${currentBrief.brief.broll_shot_list.length} shots`}
                expanded={expandedSections['broll_shot_list'] ?? false}
                onToggle={toggleSection}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentBrief.brief.broll_shot_list.map((shot, i) => (
                    <div key={i} className="p-3 rounded-lg bg-bg-primary/50 border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-text-primary text-sm font-medium">{shot.shot}</span>
                        <span className="text-accent-teal text-xs font-mono">{shot.duration}</span>
                      </div>
                      <p className="text-text-muted text-xs">{shot.notes}</p>
                    </div>
                  ))}
                </div>
              </BriefSection>

              {/* Do's and Don'ts */}
              <BriefSection
                title="Do's and Don'ts"
                sectionKey="dos_and_donts"
                expanded={expandedSections['dos_and_donts'] ?? false}
                onToggle={toggleSection}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-green-400 font-semibold text-sm mb-3">DO</h4>
                    <ul className="space-y-2">
                      {currentBrief.brief.dos_and_donts.dos.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-text-secondary">
                          <span className="text-green-400 flex-shrink-0">+</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-red-400 font-semibold text-sm mb-3">DON&apos;T</h4>
                    <ul className="space-y-2">
                      {currentBrief.brief.dos_and_donts.donts.map((item, i) => (
                        <li key={i} className="flex gap-2 text-sm text-text-secondary">
                          <span className="text-red-400 flex-shrink-0">-</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </BriefSection>

              {/* Wardrobe & Setting */}
              <BriefSection
                title="Wardrobe & Setting"
                sectionKey="wardrobe_setting"
                expanded={expandedSections['wardrobe_setting'] ?? false}
                onToggle={toggleSection}
              >
                <div className="space-y-4">
                  <FieldCard label="Wardrobe" value={currentBrief.brief.wardrobe_setting.wardrobe} />
                  <FieldCard label="Setting" value={currentBrief.brief.wardrobe_setting.setting} />
                  <div>
                    <span className="text-text-muted text-xs uppercase tracking-wider">Props</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {currentBrief.brief.wardrobe_setting.props.map((prop, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-bg-primary border border-border text-text-secondary text-xs">
                          {prop}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </BriefSection>

              {/* CTA Instructions */}
              <BriefSection
                title="CTA Instructions"
                sectionKey="cta_instructions"
                expanded={expandedSections['cta_instructions'] !== false}
                onToggle={toggleSection}
              >
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-accent-teal/10 border border-accent-teal/20">
                    <span className="text-accent-teal text-xs uppercase tracking-wider font-semibold">Script</span>
                    <p className="text-text-primary text-sm mt-2 italic">{currentBrief.brief.cta_instructions.script}</p>
                  </div>
                  <FieldCard label="Delivery" value={currentBrief.brief.cta_instructions.delivery} />
                  <FieldCard label="Visual" value={currentBrief.brief.cta_instructions.visual} />
                </div>
              </BriefSection>

              {/* Technical Specs */}
              <BriefSection
                title="Technical Specs"
                sectionKey="technical_specs"
                expanded={expandedSections['technical_specs'] ?? false}
                onToggle={toggleSection}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldCard label="Aspect Ratio" value={currentBrief.brief.technical_specs.aspect_ratio} />
                  <FieldCard label="Duration" value={`${currentBrief.brief.technical_specs.min_duration} - ${currentBrief.brief.technical_specs.max_duration}`} />
                  <FieldCard label="Lighting" value={currentBrief.brief.technical_specs.lighting} className="md:col-span-2" />
                  <FieldCard label="Audio" value={currentBrief.brief.technical_specs.audio} className="md:col-span-2" />
                </div>
              </BriefSection>
            </div>
          )}

          {/* Empty State */}
          {!currentBrief && !generating && (
            <div className="rounded-xl border border-border bg-bg-card p-12 text-center">
              <p className="text-4xl mb-4">🎬</p>
              <h3 className="text-text-primary font-semibold text-lg">No brief generated yet</h3>
              <p className="text-text-muted mt-2 max-w-md mx-auto">
                Select a UGC format above, then click &quot;Generate Brief&quot; to create a professional creator brief,
                or click &quot;Load Demo&quot; to see example briefs for the Slapen product.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ---- Sub-components ----

function BriefSection({
  title,
  sectionKey,
  badge,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  sectionKey: string;
  badge?: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between p-4 hover:bg-bg-card-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-text-primary font-semibold">{title}</h3>
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-accent-teal/20 text-accent-teal text-xs font-medium">
              {badge}
            </span>
          )}
        </div>
        <span className={`text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}>
          &#x25BC;
        </span>
      </button>
      {expanded && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

function FieldCard({
  label,
  value,
  className = '',
  accent = false,
}: {
  label: string;
  value: string;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg bg-bg-primary/50 ${className}`}>
      <span className="text-text-muted text-xs uppercase tracking-wider">{label}</span>
      <p className={`text-sm mt-1 ${accent ? 'text-accent-teal font-medium' : 'text-text-secondary'}`}>
        {value}
      </p>
    </div>
  );
}

// ---- Utilities ----

function formatBriefAsText(brief: UgcBrief): string {
  const b = brief.brief;
  const lines: string[] = [
    `UGC CREATOR BRIEF: ${brief.format_label}`,
    `Duration: ${brief.duration}`,
    '',
    '=== OVERVIEW ===',
    `Product: ${b.overview.product_name}`,
    `Target Audience: ${b.overview.target_audience}`,
    `Key Message: ${b.overview.key_message}`,
    `Tone: ${b.overview.tone}`,
    '',
    '=== SCRIPT STRUCTURE ===',
    ...b.script_structure.map(s => `[${s.timing}] ${s.beat}: ${s.description}`),
    '',
    '=== TALKING POINTS ===',
    ...b.talking_points.map((p, i) => `${i + 1}. ${p}`),
    '',
    '=== EMOTIONAL BEATS ===',
    ...b.emotional_beats.map(e => `[${e.timing}] ${e.emotion} — ${e.direction}`),
    '',
    '=== B-ROLL SHOT LIST ===',
    ...b.broll_shot_list.map(s => `- ${s.shot} (${s.duration}) — ${s.notes}`),
    '',
    "=== DO'S AND DON'TS ===",
    'DO:',
    ...b.dos_and_donts.dos.map(d => `  + ${d}`),
    "DON'T:",
    ...b.dos_and_donts.donts.map(d => `  - ${d}`),
    '',
    '=== WARDROBE & SETTING ===',
    `Wardrobe: ${b.wardrobe_setting.wardrobe}`,
    `Setting: ${b.wardrobe_setting.setting}`,
    `Props: ${b.wardrobe_setting.props.join(', ')}`,
    '',
    '=== CTA INSTRUCTIONS ===',
    `Script: ${b.cta_instructions.script}`,
    `Delivery: ${b.cta_instructions.delivery}`,
    `Visual: ${b.cta_instructions.visual}`,
    '',
    '=== TECHNICAL SPECS ===',
    `Aspect Ratio: ${b.technical_specs.aspect_ratio}`,
    `Duration: ${b.technical_specs.min_duration} - ${b.technical_specs.max_duration}`,
    `Lighting: ${b.technical_specs.lighting}`,
    `Audio: ${b.technical_specs.audio}`,
  ];
  return lines.join('\n');
}

function generatePrintableHtml(brief: UgcBrief): string {
  const b = brief.brief;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>UGC Brief — ${brief.format_label}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 30px; color: #1a1a1a; line-height: 1.5; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #0d9488; color: #0d9488; text-transform: uppercase; letter-spacing: 0.05em; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
  .field { margin-bottom: 10px; }
  .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
  .field-value { font-size: 14px; }
  .accent { color: #0d9488; font-weight: 600; }
  .beat-row { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #eee; }
  .beat-timing { width: 70px; flex-shrink: 0; font-family: monospace; font-size: 13px; color: #0d9488; font-weight: 600; }
  .beat-name { width: 120px; flex-shrink: 0; font-size: 12px; font-weight: 700; color: #f97316; text-transform: uppercase; }
  .beat-desc { font-size: 13px; color: #444; flex: 1; }
  .point { padding: 6px 0; font-size: 13px; font-style: italic; }
  .point-num { display: inline-block; width: 20px; font-style: normal; font-weight: 700; color: #0d9488; }
  .shot-card { padding: 8px 0; border-bottom: 1px solid #eee; }
  .shot-name { font-size: 13px; font-weight: 500; }
  .shot-meta { font-size: 12px; color: #666; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .do-item { font-size: 13px; padding: 3px 0; }
  .do-item::before { content: "+  "; color: #22c55e; font-weight: 700; }
  .dont-item { font-size: 13px; padding: 3px 0; }
  .dont-item::before { content: "-  "; color: #ef4444; font-weight: 700; }
  .cta-box { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .cta-label { font-size: 11px; text-transform: uppercase; color: #0d9488; font-weight: 700; margin-bottom: 6px; }
  .prop-tag { display: inline-block; padding: 2px 10px; margin: 2px; border-radius: 12px; border: 1px solid #ddd; font-size: 12px; }
  @media print { body { padding: 20px; } h2 { break-after: avoid; } }
</style>
</head>
<body>
<h1>${brief.format_label}</h1>
<p class="subtitle">Duration: ${brief.duration}</p>

<h2>Overview</h2>
<div class="field"><div class="field-label">Product</div><div class="field-value">${esc(b.overview.product_name)}</div></div>
<div class="field"><div class="field-label">Target Audience</div><div class="field-value">${esc(b.overview.target_audience)}</div></div>
<div class="field"><div class="field-label">Key Message</div><div class="field-value accent">${esc(b.overview.key_message)}</div></div>
<div class="field"><div class="field-label">Tone</div><div class="field-value">${esc(b.overview.tone)}</div></div>

<h2>Script Structure</h2>
${b.script_structure.map(s => `<div class="beat-row"><div class="beat-timing">${esc(s.timing)}</div><div class="beat-name">${esc(s.beat)}</div><div class="beat-desc">${esc(s.description)}</div></div>`).join('')}

<h2>Talking Points</h2>
${b.talking_points.map((p, i) => `<div class="point"><span class="point-num">${i + 1}.</span> ${esc(p)}</div>`).join('')}

<h2>Emotional Beats</h2>
${b.emotional_beats.map(e => `<div class="beat-row"><div class="beat-timing">${esc(e.timing)}</div><div class="beat-name" style="color:#f97316">${esc(e.emotion)}</div><div class="beat-desc">${esc(e.direction)}</div></div>`).join('')}

<h2>B-Roll Shot List</h2>
${b.broll_shot_list.map(s => `<div class="shot-card"><div class="shot-name">${esc(s.shot)} <span class="shot-meta">(${esc(s.duration)})</span></div><div class="shot-meta">${esc(s.notes)}</div></div>`).join('')}

<h2>Do's and Don'ts</h2>
<div class="two-col">
<div>${b.dos_and_donts.dos.map(d => `<div class="do-item">${esc(d)}</div>`).join('')}</div>
<div>${b.dos_and_donts.donts.map(d => `<div class="dont-item">${esc(d)}</div>`).join('')}</div>
</div>

<h2>Wardrobe &amp; Setting</h2>
<div class="field"><div class="field-label">Wardrobe</div><div class="field-value">${esc(b.wardrobe_setting.wardrobe)}</div></div>
<div class="field"><div class="field-label">Setting</div><div class="field-value">${esc(b.wardrobe_setting.setting)}</div></div>
<div class="field"><div class="field-label">Props</div><div>${b.wardrobe_setting.props.map(p => `<span class="prop-tag">${esc(p)}</span>`).join(' ')}</div></div>

<h2>CTA Instructions</h2>
<div class="cta-box"><div class="cta-label">Script</div><div class="field-value" style="font-style:italic">${esc(b.cta_instructions.script)}</div></div>
<div class="field"><div class="field-label">Delivery</div><div class="field-value">${esc(b.cta_instructions.delivery)}</div></div>
<div class="field"><div class="field-label">Visual</div><div class="field-value">${esc(b.cta_instructions.visual)}</div></div>

<h2>Technical Specs</h2>
<div class="field"><div class="field-label">Aspect Ratio</div><div class="field-value">${esc(b.technical_specs.aspect_ratio)}</div></div>
<div class="field"><div class="field-label">Duration</div><div class="field-value">${esc(b.technical_specs.min_duration)} - ${esc(b.technical_specs.max_duration)}</div></div>
<div class="field"><div class="field-label">Lighting</div><div class="field-value">${esc(b.technical_specs.lighting)}</div></div>
<div class="field"><div class="field-label">Audio</div><div class="field-value">${esc(b.technical_specs.audio)}</div></div>

</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
