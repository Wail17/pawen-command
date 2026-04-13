'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getProject } from '@/lib/store/db';
import Pipeline from '@/components/ui/Pipeline';
import {
  demoOfferStack,
  type OfferStack,
  type OfferStackBonus,
  type OfferStackGuarantee,
  type OfferStackUrgency,
  type OfferStackPricing,
} from '@/lib/gates/demoData';

// ─── Guarantee options ───
const GUARANTEE_TYPES = [
  { value: '30-day', label: '30-Day', icon: '30' },
  { value: '60-day', label: '60-Day', icon: '60' },
  { value: '90-day', label: '90-Day', icon: '90' },
  { value: 'lifetime', label: 'Lifetime', icon: '∞' },
  { value: 'double-money-back', label: 'Double Money Back', icon: '2x' },
] as const;

// ─── Scarcity options ───
const SCARCITY_TYPES = [
  { value: 'limited-stock', label: 'Limited Stock', icon: '📦' },
  { value: 'limited-time', label: 'Limited Time', icon: '⏰' },
  { value: 'exclusive-access', label: 'Exclusive Access', icon: '🔑' },
  { value: 'fast-action-bonus', label: 'Fast-Action Bonus', icon: '⚡' },
] as const;

// ─── Awareness levels ───
const AWARENESS_LEVELS = [
  { value: 'unaware', label: 'Unaware', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'problem-aware', label: 'Problem Aware', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'solution-aware', label: 'Solution Aware', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'product-aware', label: 'Product Aware', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'most-aware', label: 'Most Aware', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
] as const;

// ─── Countdown styles ───
const COUNTDOWN_STYLES = [
  { value: 'digital', label: 'Digital Clock' },
  { value: 'flip', label: 'Flip Counter' },
  { value: 'bar', label: 'Progress Bar' },
  { value: 'text', label: 'Text Only' },
] as const;

// ─── Format icons ───
const FORMAT_ICONS: Record<string, string> = {
  guide: '📖',
  audio: '🎧',
  video: '🎬',
  tracker: '📊',
  checklist: '✅',
  template: '📋',
  toolkit: '🛠️',
};

// ─── Sections ───
type Section = 'product' | 'bonuses' | 'guarantee' | 'urgency' | 'pricing' | 'summary';

export default function OfferStackPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('product');

  // Offer stack state
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [retailValue, setRetailValue] = useState(0);
  const [bonuses, setBonuses] = useState<OfferStackBonus[]>([]);
  const [guarantee, setGuarantee] = useState<OfferStackGuarantee>({
    type: '60-day',
    headline: '',
    body: '',
    powerPhrase: '',
    badgeLine: '',
  });
  const [urgency, setUrgency] = useState<OfferStackUrgency>({
    scarcityType: 'fast-action-bonus',
    headline: '',
    body: '',
    countdownLabel: '',
    ctaText: '',
  });
  const [countdownStyle, setCountdownStyle] = useState('digital');
  const [pricing, setPricing] = useState<OfferStackPricing>({
    totalPerceivedValue: 0,
    anchorPrice: 0,
    actualPrice: 0,
    valueStackIntro: '',
    dailyCostComparison: '',
    opportunityCostLine: '',
    priceRevealLine: '',
    ctaWithPrice: '',
  });

  // AI generation state
  const [generating, setGenerating] = useState<string | null>(null);
  const [awarenessAdapt, setAwarenessAdapt] = useState<Record<string, unknown> | null>(null);
  const [selectedAwareness, setSelectedAwareness] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Drag state for bonuses
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);

      // Auto-fill from project data
      const demo = demoOfferStack();
      const shopify = p.shopifyData;

      setProductName(shopify?.productTitle || p.name || demo.productName);
      setProductDescription(shopify?.productDescription || p.productDescription || demo.productDescription);
      setRetailValue(shopify?.price ? parseFloat(String(shopify.price)) : demo.retailValue);
      setBonuses(demo.bonuses);
      setGuarantee(demo.guarantee);
      setUrgency(demo.urgency);
      setPricing(demo.pricing);

      setLoading(false);
    })();
  }, [projectId, router]);

  // Auto-calculate total perceived value
  useEffect(() => {
    const bonusTotal = bonuses.reduce((sum, b) => sum + b.perceivedValue, 0);
    const fastActionValue = urgency.fastActionBonus?.perceivedValue || 0;
    const total = retailValue + bonusTotal + fastActionValue;
    setPricing(prev => ({ ...prev, totalPerceivedValue: total }));
  }, [bonuses, retailValue, urgency.fastActionBonus]);

  // ─── AI Generation ───
  const generateComponent = useCallback(async (type: string) => {
    setGenerating(type);
    try {
      const res = await fetch('/api/offer-stack/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          productName,
          productDescription,
          niche: project?.niche || 'health & wellness',
          retailValue,
          bonuses,
          guaranteeType: guarantee.type,
          brandDNA: project?.brandDNA ? JSON.stringify(project.brandDNA).slice(0, 2000) : undefined,
          mechanism: project?.brandDNA?.locked_terms?.mechanism_name || undefined,
        }),
      });

      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      const result = data.result;

      if (type === 'bonuses' && result.bonuses) {
        setBonuses(result.bonuses.map((b: Omit<OfferStackBonus, 'id'>, i: number) => ({
          ...b,
          id: `bonus-gen-${Date.now()}-${i}`,
        })));
      } else if (type === 'guarantee' && result.headline) {
        setGuarantee(prev => ({
          ...prev,
          headline: result.headline,
          body: result.body,
          powerPhrase: result.powerPhrase,
          badgeLine: result.badgeLine || prev.badgeLine,
        }));
      } else if (type === 'urgency' && result.headline) {
        setUrgency(prev => ({
          ...prev,
          headline: result.headline,
          body: result.body,
          countdownLabel: result.countdownLabel || prev.countdownLabel,
          ctaText: result.ctaText || prev.ctaText,
          fastActionBonus: result.fastActionBonus || prev.fastActionBonus,
        }));
      } else if (type === 'price-anchoring') {
        setPricing(prev => ({
          ...prev,
          valueStackIntro: result.valueStackIntro || prev.valueStackIntro,
          dailyCostComparison: result.dailyCostComparison || prev.dailyCostComparison,
          opportunityCostLine: result.opportunityCostLine || prev.opportunityCostLine,
          priceRevealLine: result.priceRevealLine || prev.priceRevealLine,
          ctaWithPrice: result.ctaWithPrice || prev.ctaWithPrice,
        }));
      }
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setGenerating(null);
    }
  }, [productName, productDescription, retailValue, bonuses, guarantee.type, project]);

  const generateAwarenessAdapt = useCallback(async (level: string) => {
    setSelectedAwareness(level);
    setGenerating('awareness-adapt');
    try {
      const res = await fetch('/api/offer-stack/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'awareness-adapt',
          productName,
          productDescription,
          niche: project?.niche || 'health & wellness',
          retailValue,
          bonuses,
          guaranteeType: guarantee.type,
          awarenessLevel: level,
          brandDNA: project?.brandDNA ? JSON.stringify(project.brandDNA).slice(0, 2000) : undefined,
          mechanism: project?.brandDNA?.locked_terms?.mechanism_name || undefined,
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setAwarenessAdapt(data.result as Record<string, unknown>);
    } catch (err) {
      console.error('Awareness adaptation error:', err);
    } finally {
      setGenerating(null);
    }
  }, [productName, productDescription, retailValue, bonuses, guarantee.type, project]);

  // ─── Bonus CRUD ───
  const addBonus = useCallback(() => {
    setBonuses(prev => [...prev, {
      id: `bonus-${Date.now()}`,
      name: '',
      description: '',
      perceivedValue: 47,
      format: 'guide',
      painPointAddressed: '',
    }]);
  }, []);

  const removeBonus = useCallback((id: string) => {
    setBonuses(prev => prev.filter(b => b.id !== id));
  }, []);

  const updateBonus = useCallback((id: string, field: keyof OfferStackBonus, value: string | number) => {
    setBonuses(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  }, []);

  // ─── Drag reorder ───
  const handleDragStart = useCallback((idx: number) => {
    dragItem.current = idx;
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    dragOverItem.current = idx;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...bonuses];
    const dragged = items.splice(dragItem.current, 1)[0];
    items.splice(dragOverItem.current, 0, dragged);
    setBonuses(items);
    dragItem.current = null;
    dragOverItem.current = null;
  }, [bonuses]);

  // ─── Copy to clipboard ───
  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  // ─── Build full offer copy ───
  const buildFullOfferCopy = useCallback(() => {
    const lines: string[] = [];
    lines.push(`Introducing: ${productName}`);
    lines.push('');
    lines.push(productDescription);
    lines.push('');
    lines.push(pricing.valueStackIntro || `Total value: $${pricing.totalPerceivedValue}`);
    lines.push('');
    lines.push('Here\'s everything you get:');
    lines.push('');
    lines.push(`Main Product: ${productName} (Value: $${retailValue})`);
    bonuses.forEach((b, i) => {
      lines.push(`Bonus #${i + 1}: ${b.name} (Value: $${b.perceivedValue})`);
      lines.push(`  ${b.description}`);
    });
    if (urgency.fastActionBonus) {
      lines.push('');
      lines.push(`FAST-ACTION BONUS: ${urgency.fastActionBonus.name} (Value: $${urgency.fastActionBonus.perceivedValue})`);
      lines.push(`  ${urgency.fastActionBonus.description}`);
    }
    lines.push('');
    lines.push(`Total Value: $${pricing.totalPerceivedValue}`);
    lines.push(pricing.priceRevealLine || `Your Price: $${pricing.actualPrice}`);
    lines.push('');
    lines.push(guarantee.headline);
    lines.push(guarantee.body);
    lines.push('');
    lines.push(guarantee.powerPhrase);
    lines.push('');
    lines.push(urgency.headline);
    lines.push(urgency.body);
    lines.push('');
    lines.push(pricing.ctaWithPrice || urgency.ctaText || 'Order Now');
    return lines.join('\n');
  }, [productName, productDescription, retailValue, bonuses, guarantee, urgency, pricing]);

  // ─── Price ratio ───
  const priceRatio = pricing.actualPrice > 0
    ? (pricing.totalPerceivedValue / pricing.actualPrice).toFixed(1)
    : '0';
  const ratioIsGood = parseFloat(priceRatio) >= 10;

  // ─── Section nav items ───
  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'product', label: 'Main Product', icon: '📦' },
    { id: 'bonuses', label: 'Bonus Stack', icon: '🎁' },
    { id: 'guarantee', label: 'Guarantee', icon: '🛡️' },
    { id: 'urgency', label: 'Urgency', icon: '⚡' },
    { id: 'pricing', label: 'Price Anchoring', icon: '💰' },
    { id: 'summary', label: 'Offer Summary', icon: '📄' },
  ];

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

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="border-b border-border bg-bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Offer Stack Builder</h1>
              <p className="text-text-muted text-sm mt-1">
                Build an irresistible offer following ZAK/direct response principles
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-lg text-sm font-mono ${ratioIsGood ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {priceRatio}:1 ratio
              </div>
              <button
                onClick={() => copyToClipboard(buildFullOfferCopy(), 'full-offer')}
                className="px-4 py-2 bg-accent-orange text-white rounded-lg text-sm font-semibold hover:bg-accent-orange-hover transition-colors"
              >
                {copiedField === 'full-offer' ? 'Copied!' : 'Copy Full Offer'}
              </button>
            </div>
          </div>

          {/* Section nav */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  activeSection === s.id
                    ? 'bg-accent-orange text-white'
                    : 'bg-bg-input text-text-secondary hover:text-text-primary border border-border'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ═══════════════════ MAIN PRODUCT ═══════════════════ */}
          {activeSection === 'product' && (
            <div className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                <span>📦</span> Main Product
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Product Name</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                    placeholder="e.g., Slapen — 30-Day Supply"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Retail Value ($)</label>
                  <input
                    type="number"
                    value={retailValue}
                    onChange={(e) => setRetailValue(Number(e.target.value))}
                    className="w-48 px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Product Description</label>
                  <textarea
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange resize-y"
                    placeholder="Describe the main product and its transformation..."
                  />
                </div>

                {/* Quick info from Brand DNA */}
                {project.brandDNA && (
                  <div className="mt-4 p-4 bg-bg-primary rounded-lg border border-border">
                    <p className="text-xs text-text-muted uppercase tracking-wider mb-2">From Brand DNA</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {project.brandDNA.locked_terms.mechanism_name && (
                        <div>
                          <span className="text-text-muted">Mechanism: </span>
                          <span className="text-accent-teal">{project.brandDNA.locked_terms.mechanism_name}</span>
                        </div>
                      )}
                      {project.brandDNA.locked_terms?.guarantee_wording && (
                        <div>
                          <span className="text-text-muted">Guarantee: </span>
                          <span className="text-text-primary">{project.brandDNA.locked_terms.guarantee_wording}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════ BONUS STACK ═══════════════════ */}
          {activeSection === 'bonuses' && (
            <div className="rounded-xl border border-border bg-bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <span>🎁</span> Bonus Stack ({bonuses.length} bonuses)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={addBonus}
                    className="px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-secondary text-sm hover:text-text-primary transition-colors"
                  >
                    + Add Bonus
                  </button>
                  <button
                    onClick={() => generateComponent('bonuses')}
                    disabled={generating !== null}
                    className="px-4 py-1.5 bg-accent-teal/20 text-accent-teal border border-accent-teal/30 rounded-lg text-sm font-semibold hover:bg-accent-teal/30 transition-colors disabled:opacity-50"
                  >
                    {generating === 'bonuses' ? 'Generating...' : 'AI Generate Bonuses'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {bonuses.map((bonus, idx) => (
                  <div
                    key={bonus.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="rounded-lg border border-border bg-bg-primary p-4 cursor-grab active:cursor-grabbing hover:border-accent-orange/30 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Drag handle + number */}
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <span className="text-text-muted text-xs cursor-grab">⠿</span>
                        <span className="text-accent-orange font-bold text-lg">#{idx + 1}</span>
                        <span className="text-lg">{FORMAT_ICONS[bonus.format] || '📦'}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={bonus.name}
                            onChange={(e) => updateBonus(bonus.id, 'name', e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                            placeholder="Bonus name..."
                          />
                          <select
                            value={bonus.format}
                            onChange={(e) => updateBonus(bonus.id, 'format', e.target.value)}
                            className="px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-secondary text-sm focus:outline-none"
                          >
                            <option value="guide">Guide</option>
                            <option value="audio">Audio</option>
                            <option value="video">Video</option>
                            <option value="tracker">Tracker</option>
                            <option value="checklist">Checklist</option>
                            <option value="template">Template</option>
                            <option value="toolkit">Toolkit</option>
                          </select>
                          <input
                            type="number"
                            value={bonus.perceivedValue}
                            onChange={(e) => updateBonus(bonus.id, 'perceivedValue', Number(e.target.value))}
                            className="w-24 px-3 py-1.5 bg-bg-input border border-border rounded-lg text-accent-teal text-sm font-mono focus:outline-none focus:border-accent-orange text-right"
                          />
                          <span className="text-text-muted text-sm self-center">$</span>
                        </div>
                        <textarea
                          value={bonus.description}
                          onChange={(e) => updateBonus(bonus.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange resize-y"
                          placeholder="Describe the bonus and its transformation..."
                        />
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeBonus(bonus.id)}
                        className="text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove bonus"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bonus value summary */}
              <div className="mt-4 p-3 bg-bg-primary rounded-lg border border-border flex justify-between text-sm">
                <span className="text-text-muted">Total bonus value:</span>
                <span className="text-accent-teal font-mono font-bold">
                  ${bonuses.reduce((s, b) => s + b.perceivedValue, 0)}
                </span>
              </div>
            </div>
          )}

          {/* ═══════════════════ GUARANTEE ═══════════════════ */}
          {activeSection === 'guarantee' && (
            <div className="rounded-xl border border-border bg-bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <span>🛡️</span> Guarantee / Risk Reversal
                </h2>
                <button
                  onClick={() => generateComponent('guarantee')}
                  disabled={generating !== null}
                  className="px-4 py-1.5 bg-accent-teal/20 text-accent-teal border border-accent-teal/30 rounded-lg text-sm font-semibold hover:bg-accent-teal/30 transition-colors disabled:opacity-50"
                >
                  {generating === 'guarantee' ? 'Generating...' : 'AI Generate Guarantee'}
                </button>
              </div>

              {/* Type selector */}
              <div className="flex gap-2 mb-4">
                {GUARANTEE_TYPES.map(gt => (
                  <button
                    key={gt.value}
                    onClick={() => setGuarantee(prev => ({ ...prev, type: gt.value }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                      guarantee.type === gt.value
                        ? 'bg-accent-orange text-white border-accent-orange'
                        : 'bg-bg-input text-text-secondary border-border hover:text-text-primary'
                    }`}
                  >
                    <span className="font-mono text-xs">{gt.icon}</span>
                    <span>{gt.label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Guarantee Headline</label>
                  <input
                    type="text"
                    value={guarantee.headline}
                    onChange={(e) => setGuarantee(prev => ({ ...prev, headline: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                    placeholder='e.g., The "Sleep Like a Kid Again" 60-Night Guarantee'
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Guarantee Body</label>
                  <textarea
                    value={guarantee.body}
                    onChange={(e) => setGuarantee(prev => ({ ...prev, body: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange resize-y"
                    placeholder="Full guarantee copy..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Risk Reversal Power Phrase</label>
                  <input
                    type="text"
                    value={guarantee.powerPhrase}
                    onChange={(e) => setGuarantee(prev => ({ ...prev, powerPhrase: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-accent-orange font-semibold text-sm focus:outline-none focus:border-accent-orange"
                    placeholder='e.g., "You either sleep better or you pay nothing."'
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Badge Line</label>
                  <input
                    type="text"
                    value={guarantee.badgeLine}
                    onChange={(e) => setGuarantee(prev => ({ ...prev, badgeLine: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                    placeholder="Short line for guarantee badge..."
                  />
                </div>
              </div>

              {/* Preview badge */}
              {guarantee.badgeLine && (
                <div className="mt-4 flex justify-center">
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/10 border-2 border-green-500/30 rounded-full">
                    <span className="text-2xl">🛡️</span>
                    <span className="text-green-400 font-bold text-sm">{guarantee.badgeLine}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════ URGENCY / SCARCITY ═══════════════════ */}
          {activeSection === 'urgency' && (
            <div className="rounded-xl border border-border bg-bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <span>⚡</span> Urgency / Scarcity
                </h2>
                <button
                  onClick={() => generateComponent('urgency')}
                  disabled={generating !== null}
                  className="px-4 py-1.5 bg-accent-teal/20 text-accent-teal border border-accent-teal/30 rounded-lg text-sm font-semibold hover:bg-accent-teal/30 transition-colors disabled:opacity-50"
                >
                  {generating === 'urgency' ? 'Generating...' : 'AI Generate Urgency'}
                </button>
              </div>

              {/* Scarcity type selector */}
              <div className="flex gap-2 mb-4">
                {SCARCITY_TYPES.map(st => (
                  <button
                    key={st.value}
                    onClick={() => setUrgency(prev => ({ ...prev, scarcityType: st.value }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                      urgency.scarcityType === st.value
                        ? 'bg-accent-orange text-white border-accent-orange'
                        : 'bg-bg-input text-text-secondary border-border hover:text-text-primary'
                    }`}
                  >
                    <span>{st.icon}</span>
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Urgency Headline</label>
                  <input
                    type="text"
                    value={urgency.headline}
                    onChange={(e) => setUrgency(prev => ({ ...prev, headline: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                    placeholder="e.g., Fast-Action Bonus: Order in the Next 24 Hours"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Urgency Body</label>
                  <textarea
                    value={urgency.body}
                    onChange={(e) => setUrgency(prev => ({ ...prev, body: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange resize-y"
                    placeholder="Explain the scarcity constraint..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Countdown Label</label>
                    <input
                      type="text"
                      value={urgency.countdownLabel}
                      onChange={(e) => setUrgency(prev => ({ ...prev, countdownLabel: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                      placeholder="e.g., Bonus expires in"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Countdown Style</label>
                    <div className="flex gap-2">
                      {COUNTDOWN_STYLES.map(cs => (
                        <button
                          key={cs.value}
                          onClick={() => setCountdownStyle(cs.value)}
                          className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                            countdownStyle === cs.value
                              ? 'bg-accent-teal/20 text-accent-teal border-accent-teal/30'
                              : 'bg-bg-input text-text-muted border-border'
                          }`}
                        >
                          {cs.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-1">CTA Text</label>
                  <input
                    type="text"
                    value={urgency.ctaText}
                    onChange={(e) => setUrgency(prev => ({ ...prev, ctaText: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                    placeholder="e.g., Claim My Slapen + All Bonuses Now"
                  />
                </div>
              </div>

              {/* Fast-action bonus card */}
              {urgency.fastActionBonus && (
                <div className="mt-4 p-4 bg-accent-orange/5 border border-accent-orange/30 rounded-lg">
                  <p className="text-xs text-accent-orange uppercase tracking-wider mb-2 font-bold">Fast-Action Bonus</p>
                  <input
                    type="text"
                    value={urgency.fastActionBonus.name}
                    onChange={(e) => setUrgency(prev => ({
                      ...prev,
                      fastActionBonus: { ...prev.fastActionBonus!, name: e.target.value },
                    }))}
                    className="w-full px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm mb-2 focus:outline-none focus:border-accent-orange"
                  />
                  <textarea
                    value={urgency.fastActionBonus.description}
                    onChange={(e) => setUrgency(prev => ({
                      ...prev,
                      fastActionBonus: { ...prev.fastActionBonus!, description: e.target.value },
                    }))}
                    rows={2}
                    className="w-full px-3 py-1.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm mb-2 focus:outline-none focus:border-accent-orange resize-y"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted text-sm">Perceived Value: $</span>
                    <input
                      type="number"
                      value={urgency.fastActionBonus.perceivedValue}
                      onChange={(e) => setUrgency(prev => ({
                        ...prev,
                        fastActionBonus: { ...prev.fastActionBonus!, perceivedValue: Number(e.target.value) },
                      }))}
                      className="w-24 px-3 py-1.5 bg-bg-input border border-border rounded-lg text-accent-teal text-sm font-mono focus:outline-none focus:border-accent-orange"
                    />
                  </div>
                </div>
              )}

              {/* Countdown preview */}
              {urgency.countdownLabel && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <p className="text-text-muted text-sm">{urgency.countdownLabel}</p>
                  {countdownStyle === 'digital' && (
                    <div className="flex gap-2 font-mono text-2xl text-accent-orange font-bold">
                      <span className="bg-bg-primary px-3 py-1 rounded-lg border border-border">23</span>
                      <span className="text-text-muted">:</span>
                      <span className="bg-bg-primary px-3 py-1 rounded-lg border border-border">59</span>
                      <span className="text-text-muted">:</span>
                      <span className="bg-bg-primary px-3 py-1 rounded-lg border border-border">47</span>
                    </div>
                  )}
                  {countdownStyle === 'flip' && (
                    <div className="flex gap-3 font-mono text-2xl text-accent-orange font-bold">
                      <div className="bg-bg-primary px-4 py-2 rounded-xl border border-border shadow-lg">
                        <div className="text-xs text-text-muted mb-0.5">HRS</div>
                        <div>23</div>
                      </div>
                      <div className="bg-bg-primary px-4 py-2 rounded-xl border border-border shadow-lg">
                        <div className="text-xs text-text-muted mb-0.5">MIN</div>
                        <div>59</div>
                      </div>
                      <div className="bg-bg-primary px-4 py-2 rounded-xl border border-border shadow-lg">
                        <div className="text-xs text-text-muted mb-0.5">SEC</div>
                        <div>47</div>
                      </div>
                    </div>
                  )}
                  {countdownStyle === 'bar' && (
                    <div className="w-full max-w-md">
                      <div className="h-3 bg-bg-primary rounded-full overflow-hidden border border-border">
                        <div className="h-full bg-accent-orange rounded-full" style={{ width: '15%' }} />
                      </div>
                      <p className="text-accent-orange text-xs font-mono mt-1 text-center">~24 hours remaining</p>
                    </div>
                  )}
                  {countdownStyle === 'text' && (
                    <p className="text-accent-orange font-bold text-lg">Only 23 hours, 59 minutes left!</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════ PRICE ANCHORING ═══════════════════ */}
          {activeSection === 'pricing' && (
            <div className="rounded-xl border border-border bg-bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <span>💰</span> Price Anchoring
                </h2>
                <button
                  onClick={() => generateComponent('price-anchoring')}
                  disabled={generating !== null}
                  className="px-4 py-1.5 bg-accent-teal/20 text-accent-teal border border-accent-teal/30 rounded-lg text-sm font-semibold hover:bg-accent-teal/30 transition-colors disabled:opacity-50"
                >
                  {generating === 'price-anchoring' ? 'Generating...' : 'AI Generate Copy'}
                </button>
              </div>

              {/* Price inputs */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <label className="block text-sm text-text-muted mb-1">Total Perceived Value</label>
                  <div className="text-3xl font-bold text-text-primary font-mono">
                    ${pricing.totalPerceivedValue}
                  </div>
                  <p className="text-xs text-text-muted mt-1">(auto-calculated)</p>
                </div>
                <div className="text-center">
                  <label className="block text-sm text-text-muted mb-1">Anchor Price</label>
                  <input
                    type="number"
                    value={pricing.anchorPrice}
                    onChange={(e) => setPricing(prev => ({ ...prev, anchorPrice: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-2xl font-mono font-bold text-center focus:outline-none focus:border-accent-orange"
                  />
                  <p className="text-xs text-text-muted mt-1">&quot;should be&quot; price</p>
                </div>
                <div className="text-center">
                  <label className="block text-sm text-text-muted mb-1">Actual Price</label>
                  <input
                    type="number"
                    value={pricing.actualPrice}
                    onChange={(e) => setPricing(prev => ({ ...prev, actualPrice: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-accent-teal/50 rounded-lg text-accent-teal text-2xl font-mono font-bold text-center focus:outline-none focus:border-accent-teal"
                  />
                  <p className="text-xs text-text-muted mt-1">what they pay</p>
                </div>
              </div>

              {/* Price ratio display */}
              <div className={`p-4 rounded-lg border mb-6 ${ratioIsGood ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary">Value-to-Price Ratio</p>
                    <p className={`text-4xl font-bold font-mono ${ratioIsGood ? 'text-green-400' : 'text-red-400'}`}>
                      {priceRatio}:1
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${ratioIsGood ? 'text-green-400' : 'text-red-400'}`}>
                      {ratioIsGood ? 'Excellent ratio!' : 'Below 10:1 — increase value or lower price'}
                    </p>
                    <p className="text-xs text-text-muted mt-1">Target: 10:1 minimum for irresistible offers</p>
                  </div>
                </div>

                {/* Visual value ladder */}
                <div className="mt-4 relative h-8 bg-bg-primary rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-accent-teal/20 rounded-full"
                    style={{ width: '100%' }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-accent-orange/40 rounded-full"
                    style={{ width: pricing.totalPerceivedValue > 0 ? `${(pricing.anchorPrice / pricing.totalPerceivedValue) * 100}%` : '0%' }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-green-500/60 rounded-full"
                    style={{ width: pricing.totalPerceivedValue > 0 ? `${(pricing.actualPrice / pricing.totalPerceivedValue) * 100}%` : '0%' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-mono">
                    <span className="text-green-300">${pricing.actualPrice}</span>
                    <span className="text-accent-orange">${pricing.anchorPrice}</span>
                    <span className="text-accent-teal">${pricing.totalPerceivedValue}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-text-muted mt-1 px-1">
                  <span>Actual price</span>
                  <span>Anchor price</span>
                  <span>Total value</span>
                </div>
              </div>

              {/* Copy fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Value Stack Intro</label>
                  <textarea
                    value={pricing.valueStackIntro}
                    onChange={(e) => setPricing(prev => ({ ...prev, valueStackIntro: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange resize-y"
                    placeholder="When you add it all up, you're getting..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Daily Cost Comparison</label>
                  <input
                    type="text"
                    value={pricing.dailyCostComparison}
                    onChange={(e) => setPricing(prev => ({ ...prev, dailyCostComparison: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                    placeholder="That's just $X/day — less than..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Opportunity Cost Line</label>
                  <input
                    type="text"
                    value={pricing.opportunityCostLine}
                    onChange={(e) => setPricing(prev => ({ ...prev, opportunityCostLine: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange"
                    placeholder="Consider this: NOT buying costs you..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Price Reveal Line</label>
                  <textarea
                    value={pricing.priceRevealLine}
                    onChange={(e) => setPricing(prev => ({ ...prev, priceRevealLine: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-orange resize-y"
                    placeholder="But you won't pay $X. Today, your total investment is just..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">CTA with Price</label>
                  <input
                    type="text"
                    value={pricing.ctaWithPrice}
                    onChange={(e) => setPricing(prev => ({ ...prev, ctaWithPrice: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-bg-input border border-border rounded-lg text-accent-orange font-semibold text-sm focus:outline-none focus:border-accent-orange"
                    placeholder="Start Sleeping Better Tonight — Just $39/month"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ OFFER SUMMARY ═══════════════════ */}
          {activeSection === 'summary' && (
            <div className="space-y-6">
              {/* Summary card */}
              <div className="rounded-xl border-2 border-accent-orange/30 bg-gradient-to-b from-bg-card to-bg-primary p-8 max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <p className="text-accent-orange text-sm font-bold uppercase tracking-wider mb-2">
                    Special Offer
                  </p>
                  <h3 className="text-2xl font-bold text-text-primary">{productName}</h3>
                  <p className="text-text-secondary text-sm mt-2 max-w-lg mx-auto">{productDescription}</p>
                </div>

                {/* Value stack */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-text-primary text-sm">📦 {productName}</span>
                    <span className="text-text-secondary text-sm font-mono">${retailValue} value</span>
                  </div>
                  {bonuses.map((b, i) => (
                    <div key={b.id} className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-text-primary text-sm">
                        {FORMAT_ICONS[b.format] || '🎁'} Bonus #{i + 1}: {b.name}
                      </span>
                      <span className="text-text-secondary text-sm font-mono">${b.perceivedValue} value</span>
                    </div>
                  ))}
                  {urgency.fastActionBonus && (
                    <div className="flex justify-between items-center py-2 border-b border-accent-orange/30 bg-accent-orange/5 px-2 rounded">
                      <span className="text-accent-orange text-sm font-semibold">
                        ⚡ FAST-ACTION: {urgency.fastActionBonus.name}
                      </span>
                      <span className="text-accent-orange text-sm font-mono font-bold">${urgency.fastActionBonus.perceivedValue} value</span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="text-center space-y-2 mb-6">
                  <p className="text-text-muted text-sm line-through">
                    Total Value: ${pricing.totalPerceivedValue}
                  </p>
                  {pricing.anchorPrice > 0 && (
                    <p className="text-text-secondary text-lg line-through">
                      ${pricing.anchorPrice}
                    </p>
                  )}
                  <p className="text-4xl font-bold text-accent-teal font-mono">
                    ${pricing.actualPrice}<span className="text-lg text-text-muted">/month</span>
                  </p>
                  {pricing.dailyCostComparison && (
                    <p className="text-text-muted text-xs">{pricing.dailyCostComparison}</p>
                  )}
                </div>

                {/* Guarantee badge */}
                {guarantee.powerPhrase && (
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center gap-2 px-5 py-2 bg-green-500/10 border border-green-500/30 rounded-full">
                      <span>🛡️</span>
                      <span className="text-green-400 text-sm font-semibold">{guarantee.badgeLine || guarantee.powerPhrase}</span>
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="text-center">
                  <button className="px-8 py-4 bg-accent-orange text-white rounded-xl text-lg font-bold hover:bg-accent-orange-hover transition-colors shadow-lg shadow-accent-orange/20">
                    {pricing.ctaWithPrice || urgency.ctaText || 'Order Now'}
                  </button>
                </div>
              </div>

              {/* Copy-ready text output */}
              <div className="rounded-xl border border-border bg-bg-card p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Copy-Ready Text</h3>
                  <button
                    onClick={() => copyToClipboard(buildFullOfferCopy(), 'summary-copy')}
                    className="px-3 py-1.5 bg-accent-teal/20 text-accent-teal border border-accent-teal/30 rounded-lg text-xs font-semibold hover:bg-accent-teal/30 transition-colors"
                  >
                    {copiedField === 'summary-copy' ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-text-secondary text-sm bg-bg-primary p-4 rounded-lg border border-border font-sans leading-relaxed max-h-80 overflow-y-auto">
                  {buildFullOfferCopy()}
                </pre>
              </div>

              {/* Awareness level adaptation */}
              <div className="rounded-xl border border-border bg-bg-card p-6">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-3">
                  Generate for Awareness Level
                </h3>
                <p className="text-text-muted text-xs mb-4">
                  Adapts the complete offer presentation for each Schwartz awareness level.
                </p>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {AWARENESS_LEVELS.map(al => (
                    <button
                      key={al.value}
                      onClick={() => generateAwarenessAdapt(al.value)}
                      disabled={generating !== null}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
                        selectedAwareness === al.value
                          ? al.color
                          : 'bg-bg-input text-text-secondary border-border hover:text-text-primary'
                      } disabled:opacity-50`}
                    >
                      {al.label}
                    </button>
                  ))}
                </div>

                {generating === 'awareness-adapt' && (
                  <div className="p-6 text-center">
                    <div className="inline-block animate-spin text-2xl mb-2">🔄</div>
                    <p className="text-text-muted text-sm">Adapting offer for {selectedAwareness} level...</p>
                  </div>
                )}

                {awarenessAdapt && !generating && (
                  <div className="space-y-3 bg-bg-primary p-4 rounded-lg border border-border">
                    {awarenessAdapt.headline ? (
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Headline</p>
                        <p className="text-text-primary font-bold">{String(awarenessAdapt.headline)}</p>
                      </div>
                    ) : null}
                    {awarenessAdapt.openingParagraph ? (
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Opening</p>
                        <p className="text-text-secondary text-sm">{String(awarenessAdapt.openingParagraph)}</p>
                      </div>
                    ) : null}
                    {awarenessAdapt.offerFraming ? (
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Offer Framing</p>
                        <p className="text-text-secondary text-sm">{String(awarenessAdapt.offerFraming)}</p>
                      </div>
                    ) : null}
                    {awarenessAdapt.primaryEmphasis ? (
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Primary Emphasis</p>
                        <p className="text-accent-teal text-sm font-semibold">{String(awarenessAdapt.primaryEmphasis)}</p>
                      </div>
                    ) : null}
                    {awarenessAdapt.fullCopy ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-text-muted uppercase tracking-wider">Full Copy Block</p>
                          <button
                            onClick={() => copyToClipboard(String(awarenessAdapt.fullCopy), 'awareness-copy')}
                            className="text-xs text-accent-teal hover:text-accent-teal/80"
                          >
                            {copiedField === 'awareness-copy' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap text-text-primary text-sm bg-bg-card p-3 rounded-lg border border-border font-sans leading-relaxed">
                          {String(awarenessAdapt.fullCopy)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
