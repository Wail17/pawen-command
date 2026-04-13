'use client';

import { useState, useCallback } from 'react';
import { CompetitorIntelResult, ClonedFunnel, ReverseEngineeredFunnel, CompetitorMode } from '@/lib/competitor/types';

interface CompetitorIntelProps {
  targetLanguage: string;
  targetMarket: string;
  onInjectSubAvatar?: (funnel: ReverseEngineeredFunnel) => void;
  onInjectClone?: (clone: ClonedFunnel) => void;
}

export default function CompetitorIntel({ targetLanguage, targetMarket, onInjectSubAvatar, onInjectClone }: CompetitorIntelProps) {
  const [mode, setMode] = useState<CompetitorMode>('reverse');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompetitorIntelResult | null>(null);

  const handleAnalyze = useCallback(async () => {
    const urls = urlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://')));

    if (urls.length === 0) {
      setError('Enter at least one valid URL (https://...)');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/competitor-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, mode, targetLanguage, targetMarket }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.message || 'Analysis failed');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResult(data as CompetitorIntelResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [urlInput, mode, targetLanguage, targetMarket]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Competitor Funnel Intelligence</h2>
          <p className="text-sm text-text-muted mt-1">
            Paste a competitor&apos;s URL to clone their funnel or reverse-engineer their strategy
          </p>
        </div>
        <div className="flex items-center gap-1 bg-bg-card border border-border rounded-lg p-1">
          <button
            onClick={() => setMode('reverse')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'reverse' ? 'bg-accent-orange text-white' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Reverse Engineer
          </button>
          <button
            onClick={() => setMode('clone')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'clone' ? 'bg-accent-teal text-white' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Clone & Translate
          </button>
        </div>
      </div>

      {/* Mode description */}
      <div className={`p-4 rounded-xl border ${mode === 'reverse' ? 'bg-accent-orange/5 border-accent-orange/20' : 'bg-accent-teal/5 border-accent-teal/20'}`}>
        {mode === 'reverse' ? (
          <div>
            <h3 className="text-sm font-semibold text-accent-orange mb-1">Reverse Engineer Mode</h3>
            <p className="text-xs text-text-secondary">
              Extracts the competitor&apos;s sub-avatar (who they target), their mechanism, copy arsenal, creative strategy,
              funnel structure, and strategic insights. You can then inject the extracted sub-avatar into your project
              and deep-dive it for YOUR market ({targetMarket}).
            </p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold text-accent-teal mb-1">Clone & Translate Mode</h3>
            <p className="text-xs text-text-secondary">
              Scrapes the competitor&apos;s entire funnel (advertorial, landing page, copy, images) and translates
              everything to {targetLanguage} for {targetMarket}. You get a ready-to-deploy translated funnel with
              all hooks, headlines, body copies, CTAs, and the full HTML.
            </p>
          </div>
        )}
      </div>

      {/* URL Input */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <label className="block text-xs font-semibold text-text-secondary mb-2">
          Competitor URL(s) — one per line
        </label>
        <textarea
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          placeholder={`https://competitor.com/product-page\nhttps://competitor.com/advertorial\nhttps://competitor.com/landing-page`}
          rows={4}
          className="w-full px-4 py-3 bg-bg-input border border-border rounded-lg text-text-primary text-sm font-mono focus:outline-none focus:border-accent-teal resize-y"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-text-muted">
            Max 5 URLs. Include the main product page + any advertorials or landing pages.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={loading || !urlInput.trim()}
            className={`px-6 py-2.5 font-semibold rounded-lg text-sm text-white disabled:opacity-50 transition-colors ${
              mode === 'reverse'
                ? 'bg-accent-orange hover:bg-accent-orange-hover'
                : 'bg-accent-teal hover:bg-accent-teal-hover'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Analyzing...
              </span>
            ) : (
              mode === 'reverse' ? 'Reverse Engineer' : 'Clone & Translate'
            )}
          </button>
        </div>
        {error && (
          <p className="text-xs text-error mt-2">{error}</p>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-3 h-3 bg-accent-orange rounded-full animate-pulse" />
            <div className="w-3 h-3 bg-accent-orange rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="w-3 h-3 bg-accent-orange rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />
          </div>
          <p className="text-sm text-text-secondary font-medium">
            {mode === 'reverse' ? 'Reverse-engineering competitor funnel...' : 'Cloning and translating funnel...'}
          </p>
          <p className="text-xs text-text-muted mt-1">
            Scraping pages, analyzing with Claude Opus. This can take 30-90 seconds.
          </p>
        </div>
      )}

      {/* === REVERSE ENGINEER RESULTS === */}
      {result?.reverse && (
        <ReverseResults
          data={result.reverse as ReverseEngineeredFunnel}
          urlsScraped={result.urls_scraped}
          onInject={onInjectSubAvatar}
        />
      )}

      {/* === CLONE RESULTS === */}
      {result?.clone && (
        <CloneResults
          data={result.clone as ClonedFunnel}
          urlsScraped={result.urls_scraped}
          onInject={onInjectClone}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────
// REVERSE ENGINEER RESULTS
// ────────────────────────────────────────

function ReverseResults({
  data,
  urlsScraped,
  onInject,
}: {
  data: ReverseEngineeredFunnel;
  urlsScraped: string[];
  onInject?: (funnel: ReverseEngineeredFunnel) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    avatar: true,
    mechanism: true,
    copy: false,
    creative: false,
    funnel: false,
    insights: true,
  });

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-bg-card border border-accent-orange/30 rounded-xl p-4">
        <div>
          <h3 className="text-base font-bold text-text-primary">{data.competitor_brand}</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Analyzed {urlsScraped.length} page(s) — {data.funnel_structure?.type || 'funnel'}
          </p>
        </div>
        {onInject && (
          <button
            onClick={() => onInject(data)}
            className="px-5 py-2.5 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm"
          >
            Inject Sub-Avatar into Project
          </button>
        )}
      </div>

      {/* Sub-Avatar */}
      <Section
        title="Sub-Avatar Extracted"
        icon="👤"
        color="orange"
        expanded={expanded.avatar}
        onToggle={() => toggle('avatar')}
        badge={data.sub_avatar.awareness_level}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-text-primary">{data.sub_avatar.name}</h4>
              <p className="text-xs text-accent-orange font-medium">&ldquo;{data.sub_avatar.nickname}&rdquo;</p>
              <p className="text-sm text-text-secondary mt-2">{data.sub_avatar.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoBlock label="Demographics" value={data.sub_avatar.demographics} />
            <InfoBlock label="Psychographics" value={data.sub_avatar.psychographics} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ListBlock label="Pain Points" items={data.sub_avatar.pain_points} color="red" />
            <ListBlock label="Desires" items={data.sub_avatar.desires} color="green" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ListBlock label="Fears" items={data.sub_avatar.fears} color="red" />
            <ListBlock label="Objections" items={data.sub_avatar.objections} color="yellow" />
          </div>

          <ListBlock label="Trigger Moments" items={data.sub_avatar.trigger_moments} color="orange" />

          {data.sub_avatar.verbatim_quotes?.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Verbatim Quotes</p>
              <div className="space-y-2">
                {data.sub_avatar.verbatim_quotes.map((q, i) => (
                  <blockquote key={i} className="px-3 py-2 border-l-3 border-l-accent-orange bg-accent-orange/5 rounded-r-lg text-xs text-text-secondary italic">
                    &ldquo;{q}&rdquo;
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {data.sub_avatar.identity_statements?.length > 0 && (
            <ListBlock label="Identity Statements" items={data.sub_avatar.identity_statements} color="purple" />
          )}
        </div>
      </Section>

      {/* Mechanism */}
      <Section
        title="Mechanism"
        icon="⚙️"
        color="teal"
        expanded={expanded.mechanism}
        onToggle={() => toggle('mechanism')}
      >
        <div className="space-y-3">
          <div className="p-3 bg-accent-teal/10 rounded-lg border border-accent-teal/20">
            <p className="text-xs text-text-muted uppercase mb-1">Named Mechanism</p>
            <p className="text-sm font-bold text-accent-teal">{data.mechanism.name}</p>
          </div>
          <p className="text-sm text-text-secondary">{data.mechanism.description}</p>
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Root Cause" value={data.mechanism.root_cause} />
            <InfoBlock label="Belief Error" value={data.mechanism.belief_error} />
          </div>
          {data.mechanism.three_steps?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">3-Step Process</p>
              {data.mechanism.three_steps.map(s => (
                <div key={s.step} className="flex gap-3 items-start p-2 bg-bg-primary rounded-lg">
                  <span className="w-6 h-6 flex items-center justify-center bg-accent-teal text-white text-xs font-bold rounded-full flex-shrink-0">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{s.name}</p>
                    <p className="text-xs text-text-muted">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Copy Arsenal */}
      <Section
        title="Copy Arsenal"
        icon="✍️"
        color="orange"
        expanded={expanded.copy}
        onToggle={() => toggle('copy')}
        badge={`${data.copy_arsenal.hooks?.length || 0} hooks`}
      >
        <div className="space-y-4">
          {data.copy_arsenal.hooks?.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Hooks</p>
              <div className="space-y-2">
                {data.copy_arsenal.hooks.map((h, i) => (
                  <div key={i} className="p-3 bg-bg-primary rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-text-primary font-medium">&ldquo;{h.text}&rdquo;</p>
                      <span className="text-[10px] px-2 py-0.5 bg-accent-orange/20 text-accent-orange rounded flex-shrink-0">
                        {h.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mt-1">{h.why_it_works}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <ListBlock label="Headlines" items={data.copy_arsenal.headlines} color="teal" />
            <ListBlock label="Emotional Triggers" items={data.copy_arsenal.emotional_triggers} color="red" />
          </div>

          <ListBlock label="Proof Points" items={data.copy_arsenal.proof_points} color="green" />

          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Social Proof Strategy" value={data.copy_arsenal.social_proof_strategy} />
            <InfoBlock label="Guarantee Angle" value={data.copy_arsenal.guarantee_angle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="CTA Strategy" value={data.copy_arsenal.cta_strategy} />
            <ListBlock label="Urgency Tactics" items={data.copy_arsenal.urgency_tactics} color="red" />
          </div>
        </div>
      </Section>

      {/* Creative Strategy */}
      <Section
        title="Creative Strategy"
        icon="🎨"
        color="teal"
        expanded={expanded.creative}
        onToggle={() => toggle('creative')}
      >
        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="Visual Style" value={data.creative_strategy.visual_style} />
          <InfoBlock label="Color Psychology" value={data.creative_strategy.color_psychology} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <ListBlock label="Image Types" items={data.creative_strategy.image_types} color="teal" />
          <ListBlock label="Layout Patterns" items={data.creative_strategy.layout_patterns} color="orange" />
        </div>
      </Section>

      {/* Funnel Structure */}
      <Section
        title="Funnel Structure"
        icon="🔄"
        color="orange"
        expanded={expanded.funnel}
        onToggle={() => toggle('funnel')}
        badge={data.funnel_structure.type}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InfoBlock label="Traffic Source" value={data.funnel_structure.traffic_source_guess} />
            <InfoBlock label="Conversion Flow" value={data.funnel_structure.conversion_flow} />
          </div>
          {data.funnel_structure.stages?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Funnel Stages</p>
              {data.funnel_structure.stages.map((s, i) => (
                <div key={i} className="flex gap-3 items-start p-2 bg-bg-primary rounded-lg">
                  <span className="w-6 h-6 flex items-center justify-center bg-accent-orange text-white text-xs font-bold rounded-full flex-shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{s.name}</p>
                    <p className="text-xs text-text-muted">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Strategic Insights */}
      <Section
        title="Strategic Insights"
        icon="💡"
        color="teal"
        expanded={expanded.insights}
        onToggle={() => toggle('insights')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ListBlock label="Strengths (learn from)" items={data.insights.strengths} color="green" />
            <ListBlock label="Weaknesses (exploit)" items={data.insights.weaknesses} color="red" />
          </div>
          <ListBlock label="Opportunities for Your Market" items={data.insights.opportunities_for_your_market} color="teal" />
          <div className="grid grid-cols-2 gap-4">
            <ListBlock label="Angles to Steal" items={data.insights.angles_to_steal} color="green" />
            <ListBlock label="Angles to Avoid" items={data.insights.angles_to_avoid} color="red" />
          </div>
        </div>
      </Section>
    </div>
  );
}

// ────────────────────────────────────────
// CLONE RESULTS
// ────────────────────────────────────────

function CloneResults({
  data,
  urlsScraped,
  onInject,
}: {
  data: ClonedFunnel;
  urlsScraped: string[];
  onInject?: (clone: ClonedFunnel) => void;
}) {
  const [showHtml, setShowHtml] = useState(false);
  const [copied, setCopied] = useState('');

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-bg-card border border-accent-teal/30 rounded-xl p-4">
        <div>
          <h3 className="text-base font-bold text-text-primary">
            {data.product.name}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {data.original_language} → {data.target_language} | {urlsScraped.length} page(s) cloned
          </p>
        </div>
        <div className="flex gap-2">
          {onInject && (
            <button
              onClick={() => onInject(data)}
              className="px-4 py-2 bg-accent-teal text-white font-semibold rounded-lg hover:bg-accent-teal-hover text-sm"
            >
              Use This Funnel
            </button>
          )}
        </div>
      </div>

      {/* Product */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Product (Translated)</h4>
        <h3 className="text-lg font-bold text-text-primary">{data.product.name}</h3>
        <p className="text-sm text-text-secondary mt-1">{data.product.description}</p>
        <p className="text-lg font-bold text-accent-teal mt-2">{data.product.price}</p>
        {data.product.images?.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {data.product.images.map((img, i) => (
              <img key={i} src={img} alt={`Product ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-border" />
            ))}
          </div>
        )}
      </div>

      {/* Advertorial */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Advertorial (Translated)</h4>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowHtml(!showHtml)}
              className="px-2.5 py-1 text-[11px] font-medium text-text-secondary bg-bg-primary border border-border rounded hover:border-accent-teal transition-colors"
            >
              {showHtml ? 'Hide HTML' : 'Show HTML'}
            </button>
            <button
              onClick={() => copyToClipboard(data.advertorial.full_translated_html, 'html')}
              className="px-2.5 py-1 text-[11px] font-medium text-text-secondary bg-bg-primary border border-border rounded hover:border-accent-teal transition-colors"
            >
              {copied === 'html' ? 'Copied!' : 'Copy HTML'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-bg-primary rounded-lg">
            <p className="text-[10px] text-text-muted uppercase mb-1">Headline</p>
            <p className="text-base font-bold text-text-primary">{data.advertorial.headline}</p>
          </div>
          <div className="p-3 bg-bg-primary rounded-lg">
            <p className="text-[10px] text-text-muted uppercase mb-1">Subheadline</p>
            <p className="text-sm text-text-secondary">{data.advertorial.subheadline}</p>
          </div>
          <InfoBlock label="Story Opening" value={data.advertorial.story_opening} />
          <InfoBlock label="Root Cause Section" value={data.advertorial.root_cause_section} />
          <InfoBlock label="Mechanism Section" value={data.advertorial.mechanism_section} />
          <InfoBlock label="Proof Section" value={data.advertorial.proof_section} />
          <div className="p-3 bg-accent-teal/10 rounded-lg border border-accent-teal/20">
            <p className="text-[10px] text-text-muted uppercase mb-1">CTA</p>
            <p className="text-sm font-bold text-accent-teal">{data.advertorial.cta}</p>
          </div>
        </div>

        {showHtml && (
          <div className="mt-4">
            <pre className="text-[11px] text-text-muted bg-bg-primary p-4 rounded-lg overflow-x-auto max-h-80 font-mono whitespace-pre-wrap">
              {data.advertorial.full_translated_html}
            </pre>
          </div>
        )}
      </div>

      {/* Copy Elements */}
      <div className="grid grid-cols-2 gap-4">
        <CopyListBlock label="Hooks" items={data.hooks} onCopy={(text) => copyToClipboard(text, 'hooks')} copied={copied === 'hooks'} />
        <CopyListBlock label="Headlines" items={data.headlines} onCopy={(text) => copyToClipboard(text, 'headlines')} copied={copied === 'headlines'} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CopyListBlock label="Body Copies" items={data.body_copies} onCopy={(text) => copyToClipboard(text, 'body')} copied={copied === 'body'} />
        <CopyListBlock label="CTAs" items={data.ctas} onCopy={(text) => copyToClipboard(text, 'ctas')} copied={copied === 'ctas'} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CopyListBlock label="Testimonials" items={data.testimonials} onCopy={(text) => copyToClipboard(text, 'testimonials')} copied={copied === 'testimonials'} />
        <CopyListBlock label="Urgency Messages" items={data.urgency_messages} onCopy={(text) => copyToClipboard(text, 'urgency')} copied={copied === 'urgency'} />
      </div>

      {/* Visual Style */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Visual Style</h4>
        <div className="flex items-center gap-4">
          {data.visual_style.colors?.length > 0 && (
            <div className="flex gap-2">
              {data.visual_style.colors.map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-md border border-border" style={{ backgroundColor: c }} />
                  <span className="text-[10px] text-text-muted font-mono">{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-text-secondary mt-2">{data.visual_style.layout_style}</p>
      </div>

      {/* Images */}
      {data.images_found?.length > 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Images Found ({data.images_found.length})</h4>
          <div className="grid grid-cols-4 gap-3">
            {data.images_found.map((img, i) => (
              <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="rounded-lg overflow-hidden border border-border hover:border-accent-teal transition-colors">
                <img src={img} alt={`Found ${i + 1}`} className="w-full h-24 object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────
// SHARED UI COMPONENTS
// ────────────────────────────────────────

function Section({
  title,
  icon,
  color,
  expanded,
  onToggle,
  badge,
  children,
}: {
  title: string;
  icon: string;
  color: 'orange' | 'teal';
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-bg-card border rounded-xl overflow-hidden ${expanded ? `border-accent-${color}/30` : 'border-border'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-bg-primary/50 transition-colors"
      >
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-bold text-text-primary flex-1">{title}</span>
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium bg-accent-${color}/20 text-accent-${color}`}>
            {badge}
          </span>
        )}
        <span className="text-text-muted text-xs">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t border-border pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="p-3 bg-bg-primary rounded-lg">
      <p className="text-[10px] text-text-muted uppercase mb-1">{label}</p>
      <p className="text-xs text-text-secondary leading-relaxed">{value}</p>
    </div>
  );
}

function ListBlock({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  const colorMap: Record<string, string> = {
    red: 'text-red-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    orange: 'text-accent-orange',
    teal: 'text-accent-teal',
    purple: 'text-purple-400',
  };
  const textColor = colorMap[color] || 'text-text-secondary';

  return (
    <div>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{label}</p>
      <div className="space-y-1">
        {items.map((item, i) => (
          <p key={i} className={`text-xs ${textColor}`}>• {item}</p>
        ))}
      </div>
    </div>
  );
}

function CopyListBlock({
  label,
  items,
  onCopy,
  copied,
}: {
  label: string;
  items: string[];
  onCopy: (text: string) => void;
  copied: boolean;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">{label} ({items.length})</h4>
        <button
          onClick={() => onCopy(items.join('\n'))}
          className="text-[10px] text-accent-teal hover:underline"
        >
          {copied ? 'Copied!' : 'Copy all'}
        </button>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <p key={i} className="text-xs text-text-secondary">• {item}</p>
        ))}
      </div>
    </div>
  );
}
