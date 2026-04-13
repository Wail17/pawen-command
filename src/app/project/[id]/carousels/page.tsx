'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, GateId } from '@/lib/types';
import { getProject, getGateOutput } from '@/lib/store/db';
import Pipeline from '@/components/ui/Pipeline';

// ============================================================
// Carousel Ad Generator
// 5 carousel types × unlimited headlines = massive ad variants
// ============================================================

interface CarouselSlide {
  position: number;
  headline: string;
  body: string;
  visualBrief: string;
  emotionalBeat: string;
  ctaText?: string;
}

interface CarouselTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  slideCount: number;
  structure: string[];
  color: string;
}

interface GeneratedCarousel {
  id: string;
  templateId: string;
  templateName: string;
  headline: string;
  slides: CarouselSlide[];
  targetSubAvatar: string;
  emotionalArc: string;
  format: string;
}

const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  {
    id: 'story',
    name: 'Story Carousel',
    icon: '📖',
    description: 'Pain → Agitation → Solution → Mechanism → CTA. The classic narrative arc.',
    slideCount: 5,
    structure: ['Hook / Pain Point', 'Agitation / Stakes', 'Solution Reveal', 'Mechanism / Proof', 'CTA / Offer'],
    color: 'border-purple-500/50 bg-purple-500/10',
  },
  {
    id: 'feature',
    name: 'Feature Carousel',
    icon: '✨',
    description: 'One key feature per slide. Perfect for product-aware audiences.',
    slideCount: 5,
    structure: ['Hero / Main Benefit', 'Feature 1', 'Feature 2', 'Feature 3', 'CTA / Guarantee'],
    color: 'border-accent-teal/50 bg-accent-teal/10',
  },
  {
    id: 'testimonial',
    name: 'Testimonial Carousel',
    icon: '⭐',
    description: 'Real quotes from real people. Stacks social proof slide by slide.',
    slideCount: 5,
    structure: ['Bold Claim / Hook', 'Testimonial 1', 'Testimonial 2', 'Testimonial 3', 'CTA / Join Them'],
    color: 'border-yellow-500/50 bg-yellow-500/10',
  },
  {
    id: 'before_after',
    name: 'Before / After',
    icon: '🔄',
    description: 'Contrast transformation. Alternates between pain state and desired state.',
    slideCount: 4,
    structure: ['Before (Pain)', 'After (Desire)', 'How (Mechanism)', 'CTA / Try It'],
    color: 'border-orange-500/50 bg-orange-500/10',
  },
  {
    id: 'product_range',
    name: 'Product Range',
    icon: '📦',
    description: 'Showcase multiple products or variants. Great for bundle offers.',
    slideCount: 5,
    structure: ['Range Overview', 'Product/Variant 1', 'Product/Variant 2', 'Product/Variant 3', 'Bundle CTA'],
    color: 'border-green-500/50 bg-green-500/10',
  },
];

// Demo carousel data (Slapen)
function getDemoCarousels(): GeneratedCarousel[] {
  return [
    {
      id: 'demo-story-1',
      templateId: 'story',
      templateName: 'Story Carousel',
      headline: 'Your brain isn\'t broken — your cortisol clock is.',
      targetSubAvatar: 'The Exhausted Overthinker',
      emotionalArc: 'Frustration → Validation → Hope → Confidence → Action',
      format: 'feed_1x1',
      slides: [
        { position: 1, headline: 'Still awake at 2am?', body: 'Your brain won\'t shut up. You\'ve tried melatonin, apps, teas — nothing stops the racing thoughts.', visualBrief: 'Dark bedroom, clock showing 2:17am, person lying awake with visible frustration. Cool blue tones.', emotionalBeat: 'Recognition / "That\'s me"' },
        { position: 2, headline: 'It\'s not your fault.', body: 'You don\'t have a melatonin problem. You have a cortisol problem. Your "wake hormone" stays elevated when it should drop.', visualBrief: 'Split graphic: cortisol curve (red, elevated) vs normal curve (green, declining). Clean, scientific feel.', emotionalBeat: 'Validation / Relief' },
        { position: 3, headline: 'Meet the Dual-Phase Reset', body: 'Phase 1 calms cortisol in 20 minutes. Phase 2 prevents the 3am wake-up spike. Your body does the rest.', visualBrief: 'Product hero shot with two-phase visual: Phase 1 (calm teal glow), Phase 2 (sustained shield visual).', emotionalBeat: 'Hope / Curiosity' },
        { position: 4, headline: '94% sleep through the night by Day 7', body: '2,847 reviews. 4.8/5 average. Non-habit-forming. Clinically studied ingredients.', visualBrief: 'Social proof collage: star ratings, review snippets, "verified purchase" badges. Warm gold tones.', emotionalBeat: 'Confidence / Trust' },
        { position: 5, headline: 'Try Slapen risk-free for 60 nights', body: 'Sleep better or get a full refund. No questions asked. Your cortisol clock resets tonight.', visualBrief: 'Product with guarantee badge, warm bedroom background, person sleeping peacefully. CTA button overlay.', emotionalBeat: 'Action / Urgency', ctaText: 'Reset Your Sleep Tonight →' },
      ],
    },
    {
      id: 'demo-feature-1',
      templateId: 'feature',
      templateName: 'Feature Carousel',
      headline: 'The sleep supplement that actually works differently.',
      targetSubAvatar: 'The Stressed Professional',
      emotionalArc: 'Intrigue → Understanding → Confidence → Trust → Decision',
      format: 'feed_1x1',
      slides: [
        { position: 1, headline: 'Not another melatonin pill.', body: 'Slapen is the first dual-phase cortisol regulation formula. It works WITH your biology, not against it.', visualBrief: 'Premium product shot, dark background with subtle teal glow. "Dual-Phase" badge prominent.', emotionalBeat: 'Differentiation' },
        { position: 2, headline: 'Phase 1: Cortisol Calm', body: 'KSM-66 Ashwagandha reduces cortisol by 23% in 30 minutes. Your racing mind goes quiet — naturally.', visualBrief: 'Ingredient spotlight: Ashwagandha root with scientific data overlay. Teal accent.', emotionalBeat: 'Education' },
        { position: 3, headline: 'Phase 2: Sustained Shield', body: 'Magnesium Glycinate + Apigenin creates a cortisol ceiling. No more 3am wake-ups. 7+ hours of unbroken sleep.', visualBrief: 'Time-release graphic showing protection through the night. Moon phases visual.', emotionalBeat: 'Reassurance' },
        { position: 4, headline: 'Zero Grogginess. Zero Dependency.', body: '100% natural. Non-habit-forming. Metabolized within 6 hours — you wake up clear-headed, not foggy.', visualBrief: 'Morning scene: person waking up refreshed, sunlight streaming in. Green "clean label" badges.', emotionalBeat: 'Objection removal' },
        { position: 5, headline: '60-Night Guarantee', body: 'Track it with your Oura or Whoop. See the difference in your sleep score — or get every cent back.', visualBrief: 'Product + Oura ring showing improved sleep score. Premium lifestyle setting.', emotionalBeat: 'Risk removal', ctaText: 'Upgrade Your Sleep Stack →' },
      ],
    },
    {
      id: 'demo-testimonial-1',
      templateId: 'testimonial',
      templateName: 'Testimonial Carousel',
      headline: '2,847 people sleeping better. Here\'s what they say.',
      targetSubAvatar: 'The Exhausted Overthinker',
      emotionalArc: 'Social proof → Identification → Trust → FOMO → Action',
      format: 'feed_1x1',
      slides: [
        { position: 1, headline: 'Night 3 changed everything.', body: '"I was the biggest skeptic. Another supplement? Really? But night 3... I slept 7 hours straight for the first time in months."', visualBrief: 'Large quote text on dark background with subtle star rating. Customer photo placeholder (silhouette).', emotionalBeat: 'Curiosity / Hook' },
        { position: 2, headline: '"I forgot what real sleep felt like."', body: '"As a nurse working night shifts, I thought broken sleep was just my life now. Slapen gave me back my mornings. My kids noticed before I did." — Sarah M., verified buyer', visualBrief: 'Quote card with customer avatar, 5-star rating, "Verified Purchase" badge. Warm tones.', emotionalBeat: 'Identification' },
        { position: 3, headline: '"My Oura score went from 62 to 89."', body: '"I\'ve spent $500/month on supplements. Slapen is the only one that actually moved my sleep score. Data doesn\'t lie." — James K., biohacker', visualBrief: 'Quote card with Oura ring sleep score screenshot (before/after). Tech aesthetic.', emotionalBeat: 'Data-driven proof' },
        { position: 4, headline: '"Zero grogginess. That\'s the game-changer."', body: '"Every other sleep aid made me feel like a zombie in the morning. Slapen? I wake up BEFORE my alarm. That never happened." — Maria L.', visualBrief: 'Quote card with customer avatar, morning scene vibes, 5-star rating.', emotionalBeat: 'Objection handling via proof' },
        { position: 5, headline: 'Join 2,847+ who sleep better.', body: '4.8/5 average rating. 60-night risk-free guarantee. Non-habit-forming. Tonight could be your Night 3.', visualBrief: 'Product hero + aggregated review stats. "As seen in" bar optional. CTA button overlay.', emotionalBeat: 'FOMO + Action', ctaText: 'Start Your Night 3 →' },
      ],
    },
    {
      id: 'demo-ba-1',
      templateId: 'before_after',
      templateName: 'Before / After',
      headline: 'From dreading bedtime to loving it.',
      targetSubAvatar: 'The Exhausted Overthinker',
      emotionalArc: 'Pain recognition → Desire → Solution → Action',
      format: 'feed_1x1',
      slides: [
        { position: 1, headline: 'BEFORE: The nightly torture', body: '2am. Ceiling staring. Racing thoughts. "If I fall asleep NOW I\'ll get 4 hours." Melatonin on the nightstand. Didn\'t work. Again.', visualBrief: 'Split dark/moody: person in bed, blue light from phone, clock showing late hour. Desaturated, cold.', emotionalBeat: 'Pain / Recognition' },
        { position: 2, headline: 'AFTER: The cortisol reset', body: '10:30pm. Eyes heavy. Thoughts quiet. "Wait, it\'s morning already?" 7 hours. Unbroken. The alarm feels optional.', visualBrief: 'Warm, golden morning light. Person stretching in bed, relaxed smile. Saturated, warm tones.', emotionalBeat: 'Desire / Aspiration' },
        { position: 3, headline: 'The difference: cortisol regulation', body: 'Melatonin adds sleep signal. Slapen removes the wake signal. Phase 1 calms cortisol. Phase 2 sustains it. Your body does the rest.', visualBrief: 'Clean graphic: two curves showing cortisol with and without Slapen. Product centered.', emotionalBeat: 'Understanding' },
        { position: 4, headline: 'Your "after" starts tonight.', body: '60-night risk-free guarantee. 4.8/5 from 2,847 reviews. Non-habit-forming. Take 2 capsules, 30 minutes before bed.', visualBrief: 'Product + guarantee badge + CTA. Blends warm/aspirational tones from slide 2. Premium feel.', emotionalBeat: 'Action', ctaText: 'Get Your First Night Free →' },
      ],
    },
    {
      id: 'demo-range-1',
      templateId: 'product_range',
      templateName: 'Product Range',
      headline: 'The complete Slapen sleep system.',
      targetSubAvatar: 'The Stressed Professional',
      emotionalArc: 'Overview → Detail → Detail → Detail → Bundle',
      format: 'feed_1x1',
      slides: [
        { position: 1, headline: 'One solution. Three ways to sleep better.', body: 'Whether you\'re just starting or optimizing your entire sleep stack — Slapen has the right formula for you.', visualBrief: 'Three product bottles arranged premium-style. Dark background, teal accent lighting. "Sleep System" text.', emotionalBeat: 'Overview / Premium feel' },
        { position: 2, headline: 'Slapen Core — The Starter', body: '30-day supply. Dual-Phase Cortisol Reset formula. Perfect for first-timers who want to test the cortisol approach. $39/month.', visualBrief: 'Single bottle hero shot, "Most Popular" badge, price tag, key ingredients listed.', emotionalBeat: 'Accessible entry point' },
        { position: 3, headline: 'Slapen Pro — The Stack', body: 'Core formula + Magnesium Glycinate booster + Apigenin capsules. For biohackers who want maximum sleep architecture optimization. $69/month.', visualBrief: 'Three-product arrangement, "Best Value" badge, Oura score improvement graphic.', emotionalBeat: 'Upgrade appeal' },
        { position: 4, headline: 'Slapen Complete — The System', body: 'Pro stack + Sleep Optimization Guide + Cortisol Reset Meditation Audio + Monthly sleep coaching call. $99/month.', visualBrief: 'Full system laid out premium-style: bottles + digital products + coaching icon. "Premium" badge.', emotionalBeat: 'Aspirational / Complete' },
        { position: 5, headline: 'Save 40% on the Complete System', body: 'Bundle all three for the price of two. 60-night guarantee on everything. Cancel anytime. Your sleep stack, complete.', visualBrief: 'Bundle box with "SAVE 40%" callout. Price comparison: $207 value → $99. Timer/urgency element.', emotionalBeat: 'Urgency / Deal', ctaText: 'Get the Complete System →' },
      ],
    },
  ];
}

export default function CarouselsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('story');
  const [carousels, setCarousels] = useState<GeneratedCarousel[]>([]);
  const [expandedCarousel, setExpandedCarousel] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      const p = await getProject(projectId);
      if (!p) { router.push('/'); return; }
      setProject(p);
      setLoading(false);
    }
    load();
  }, [projectId, router]);

  const handleLoadDemo = useCallback(() => {
    setCarousels(getDemoCarousels());
    setExpandedCarousel('demo-story-1');
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setGenerating(true);

    try {
      // Load upstream gate data for context
      const [g4, g6, g3] = await Promise.all([
        getGateOutput(projectId, 'gate4' as GateId),
        getGateOutput(projectId, 'gate6' as GateId),
        getGateOutput(projectId, 'gate3' as GateId),
      ]);

      const template = CAROUSEL_TEMPLATES.find(t => t.id === selectedTemplate);
      if (!template) return;

      const res = await fetch('/api/carousels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          projectId,
          brandDNA: project.brandDNA,
          gate4Data: g4?.data,
          gate6Data: g6?.data,
          gate3Data: g3?.data,
          selectedSubAvatarId: project.selectedSubAvatarId,
          selectedFunnel: project.selectedFunnel,
          targetLanguage: project.targetLanguage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.carousels) {
          setCarousels(prev => [...prev, ...data.carousels]);
        }
      }
    } catch (err) {
      console.error('Carousel generation error:', err);
    } finally {
      setGenerating(false);
    }
  }, [project, projectId, selectedTemplate]);

  const handleCopyCarousel = useCallback((carousel: GeneratedCarousel) => {
    const text = carousel.slides.map((s, i) =>
      `SLIDE ${i + 1}: ${s.headline}\n${s.body}\n[Visual: ${s.visualBrief}]\n[Emotion: ${s.emotionalBeat}]${s.ctaText ? `\n[CTA: ${s.ctaText}]` : ''}`
    ).join('\n\n---\n\n');
    const full = `CAROUSEL: ${carousel.templateName}\nHeadline: ${carousel.headline}\nTarget: ${carousel.targetSubAvatar}\nArc: ${carousel.emotionalArc}\n\n${text}`;
    navigator.clipboard.writeText(full);
  }, []);

  const filteredCarousels = useMemo(() => {
    return carousels.filter(c => c.templateId === selectedTemplate);
  }, [carousels, selectedTemplate]);

  const allTemplateCarousels = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of carousels) {
      counts[c.templateId] = (counts[c.templateId] || 0) + 1;
    }
    return counts;
  }, [carousels]);

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

      <main className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Carousel Ad Generator</h1>
            <p className="text-text-secondary text-sm mt-1">
              5 carousel types with narrative slide sequences. Each slide = headline + copy + visual brief.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadDemo}
              className="px-4 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-secondary hover:border-accent-orange transition-colors"
            >
              Load Demo
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-2.5 bg-accent-orange text-white font-semibold rounded-lg hover:bg-accent-orange-hover text-sm disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Carousels'}
            </button>
          </div>
        </div>

        {/* Template Selector */}
        <div className="grid grid-cols-5 gap-3 mb-8">
          {CAROUSEL_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedTemplate === template.id
                  ? `${template.color} border-current`
                  : 'bg-bg-card border-border hover:border-text-muted'
              }`}
            >
              <div className="text-2xl mb-2">{template.icon}</div>
              <div className="text-sm font-semibold text-text-primary">{template.name}</div>
              <div className="text-xs text-text-muted mt-1">{template.slideCount} slides</div>
              {allTemplateCarousels[template.id] && (
                <div className="mt-2 text-xs px-2 py-0.5 rounded-full bg-accent-orange/20 text-accent-orange inline-block">
                  {allTemplateCarousels[template.id]} generated
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Template Info Card */}
        {(() => {
          const tmpl = CAROUSEL_TEMPLATES.find(t => t.id === selectedTemplate);
          if (!tmpl) return null;
          return (
            <div className={`rounded-xl border p-5 mb-8 ${tmpl.color}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{tmpl.icon}</span>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{tmpl.name}</h2>
                  <p className="text-sm text-text-secondary">{tmpl.description}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {tmpl.structure.map((slide, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className="text-xs font-mono text-text-muted mb-1">Slide {i + 1}</div>
                    <div className="text-xs text-text-secondary bg-bg-primary/50 rounded-lg py-2 px-1">
                      {slide}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Generated Carousels */}
        {filteredCarousels.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <div className="text-4xl mb-4">🎠</div>
            <p className="text-lg">No carousels yet</p>
            <p className="text-sm mt-2">Click "Generate Carousels" or "Load Demo" to get started.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredCarousels.map((carousel) => {
              const isExpanded = expandedCarousel === carousel.id;
              return (
                <div key={carousel.id} className="rounded-xl border border-border bg-bg-card overflow-hidden">
                  {/* Carousel Header */}
                  <div
                    className="p-5 cursor-pointer hover:bg-bg-card-hover transition-colors"
                    onClick={() => setExpandedCarousel(isExpanded ? null : carousel.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-teal/20 text-accent-teal">
                            {carousel.templateName}
                          </span>
                          <span className="text-xs text-text-muted">{carousel.slides.length} slides</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-bg-primary text-text-muted">
                            {carousel.format.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="text-text-primary font-semibold">{carousel.headline}</h3>
                        <p className="text-xs text-text-muted mt-1">
                          Target: {carousel.targetSubAvatar} | Arc: {carousel.emotionalArc}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyCarousel(carousel); }}
                          className="px-3 py-1.5 bg-bg-primary border border-border rounded-lg text-xs text-text-secondary hover:border-accent-teal"
                        >
                          Copy
                        </button>
                        <span className="text-text-muted text-sm">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Slides */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* Slide Preview Strip */}
                      <div className="flex gap-0 overflow-x-auto">
                        {carousel.slides.map((slide, idx) => (
                          <div key={idx} className="flex-1 min-w-[200px] border-r border-border last:border-r-0 p-4">
                            <div className="text-xs font-mono text-accent-orange mb-2">
                              Slide {slide.position}
                            </div>
                            <h4 className="text-sm font-bold text-text-primary mb-2">
                              {slide.headline}
                            </h4>
                            <p className="text-xs text-text-secondary mb-3 leading-relaxed">
                              {slide.body}
                            </p>
                            <div className="space-y-2">
                              <div className="p-2 rounded-lg bg-bg-primary/50 border border-border/50">
                                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Visual Brief</div>
                                <p className="text-xs text-text-muted leading-relaxed">{slide.visualBrief}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-wider text-text-muted">Emotion:</span>
                                <span className="text-xs text-accent-teal">{slide.emotionalBeat}</span>
                              </div>
                              {slide.ctaText && (
                                <div className="mt-2 text-xs font-semibold text-accent-orange bg-accent-orange/10 rounded-lg py-1.5 px-3 text-center">
                                  {slide.ctaText}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* All Carousels Summary */}
        {carousels.length > 0 && (
          <div className="mt-8 p-5 rounded-xl border border-border bg-bg-card">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Generation Summary</h3>
            <div className="grid grid-cols-5 gap-4">
              {CAROUSEL_TEMPLATES.map((tmpl) => {
                const count = allTemplateCarousels[tmpl.id] || 0;
                return (
                  <div key={tmpl.id} className="text-center">
                    <div className="text-2xl mb-1">{tmpl.icon}</div>
                    <div className="text-xs text-text-secondary">{tmpl.name}</div>
                    <div className={`text-lg font-bold ${count > 0 ? 'text-success' : 'text-text-muted'}`}>
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                Total: {carousels.length} carousels, {carousels.reduce((sum, c) => sum + c.slides.length, 0)} slides
              </span>
              <button
                onClick={() => {
                  const allText = carousels.map(c => {
                    const slides = c.slides.map((s, i) =>
                      `  SLIDE ${i + 1}: ${s.headline}\n  ${s.body}\n  [Visual: ${s.visualBrief}]`
                    ).join('\n\n');
                    return `=== ${c.templateName}: ${c.headline} ===\nTarget: ${c.targetSubAvatar}\nArc: ${c.emotionalArc}\n\n${slides}`;
                  }).join('\n\n' + '='.repeat(60) + '\n\n');
                  navigator.clipboard.writeText(allText);
                }}
                className="px-4 py-2 bg-accent-teal text-white rounded-lg text-sm font-medium hover:bg-accent-teal-hover"
              >
                Copy All Carousels
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
