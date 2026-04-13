// ============================================================
// PAWEN — Gate 2 Avatar Deep Dive dedicated view
//
// Replaces SmartGateOutput for gate2 specifically. Takes the unified
// dossier that Gate 2's lead compile returns (17 categories of verbatims,
// desire research, voice profile, customer language mining, angle
// candidates, buyer psychology, quote bank) and renders a purpose-built
// UX with sticky sidebar, category groups, emotion-color verbatim cards,
// iceberg fears, timeline past attempts, intensity bars for objections,
// ladder+bar-chart desires, and a sticky quality review bar.
// ============================================================

'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { ReviewResult } from '@/lib/types';
import { TranslateCtx, InlineTranslate } from '@/components/ui/TranslateToggle';

// ============================================================
// TYPES
// ============================================================

interface Gate2DeepDiveViewProps {
  data: Record<string, unknown>;
  reviewResult?: ReviewResult | null;
  sourceLanguage?: string | null;
  humanDecisions?: Record<string, unknown>;
  onDecisionsChange?: (next: Record<string, unknown>) => void;
}

type Verbatim = {
  quote: string;
  source?: string;
  source_url?: string;
  insight?: string;
  emotion?: string;
  intensity?: number;
  tier?: string;
};

type DesireChain = {
  surface?: string;
  middle?: string;
  core?: string;
  mass_instinct?: string;
  instinct_rank?: number;
  connection_chain?: string;
  copy_angle?: string;
};

type DesirePowerRanking = {
  desire: string;
  scope?: number;
  urgency?: number;
  staying_power?: number;
  total?: number;
  reasoning?: string;
};

// ============================================================
// EMOTION + SOURCE COLOR MAPS
// ============================================================

// Match common English, French, Italian, Spanish emotion words to a
// semantic color. Covers the pain-side (rage/fear/shame) and the
// positive-side (hope/pride/desire) equally.
type EmotionTone = {
  label: string;
  border: string;
  bg: string;
  text: string;
};

const EMOTION_TONES: Record<string, EmotionTone> = {
  rage: { label: 'rage', border: 'border-red-500/60', bg: 'bg-red-500/15', text: 'text-red-300' },
  anger: { label: 'anger', border: 'border-red-500/60', bg: 'bg-red-500/15', text: 'text-red-300' },
  colère: { label: 'colère', border: 'border-red-500/60', bg: 'bg-red-500/15', text: 'text-red-300' },
  ira: { label: 'ira', border: 'border-red-500/60', bg: 'bg-red-500/15', text: 'text-red-300' },
  frustration: { label: 'frustration', border: 'border-orange-500/60', bg: 'bg-orange-500/15', text: 'text-orange-300' },
  frustrazione: { label: 'frustrazione', border: 'border-orange-500/60', bg: 'bg-orange-500/15', text: 'text-orange-300' },
  frustración: { label: 'frustración', border: 'border-orange-500/60', bg: 'bg-orange-500/15', text: 'text-orange-300' },
  fear: { label: 'fear', border: 'border-purple-500/60', bg: 'bg-purple-500/15', text: 'text-purple-300' },
  peur: { label: 'peur', border: 'border-purple-500/60', bg: 'bg-purple-500/15', text: 'text-purple-300' },
  paura: { label: 'paura', border: 'border-purple-500/60', bg: 'bg-purple-500/15', text: 'text-purple-300' },
  miedo: { label: 'miedo', border: 'border-purple-500/60', bg: 'bg-purple-500/15', text: 'text-purple-300' },
  shame: { label: 'shame', border: 'border-fuchsia-500/60', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300' },
  honte: { label: 'honte', border: 'border-fuchsia-500/60', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300' },
  vergogna: { label: 'vergogna', border: 'border-fuchsia-500/60', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300' },
  vergüenza: { label: 'vergüenza', border: 'border-fuchsia-500/60', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300' },
  grief: { label: 'grief', border: 'border-blue-500/60', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  sadness: { label: 'sadness', border: 'border-blue-500/60', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  lutto: { label: 'lutto', border: 'border-blue-500/60', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  tristesse: { label: 'tristesse', border: 'border-blue-500/60', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  tristezza: { label: 'tristezza', border: 'border-blue-500/60', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  tristeza: { label: 'tristeza', border: 'border-blue-500/60', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  despair: { label: 'despair', border: 'border-slate-500/60', bg: 'bg-slate-500/15', text: 'text-slate-300' },
  hopelessness: { label: 'hopelessness', border: 'border-slate-500/60', bg: 'bg-slate-500/15', text: 'text-slate-300' },
  resignation: { label: 'resignation', border: 'border-slate-500/60', bg: 'bg-slate-500/15', text: 'text-slate-300' },
  hope: { label: 'hope', border: 'border-emerald-500/60', bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  espoir: { label: 'espoir', border: 'border-emerald-500/60', bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  speranza: { label: 'speranza', border: 'border-emerald-500/60', bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  esperanza: { label: 'esperanza', border: 'border-emerald-500/60', bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  pride: { label: 'pride', border: 'border-amber-500/60', bg: 'bg-amber-500/15', text: 'text-amber-300' },
  desire: { label: 'desire', border: 'border-pink-500/60', bg: 'bg-pink-500/15', text: 'text-pink-300' },
  skepticism: { label: 'skepticism', border: 'border-cyan-500/60', bg: 'bg-cyan-500/15', text: 'text-cyan-300' },
  distrust: { label: 'distrust', border: 'border-cyan-500/60', bg: 'bg-cyan-500/15', text: 'text-cyan-300' },
  exhaustion: { label: 'exhaustion', border: 'border-indigo-500/60', bg: 'bg-indigo-500/15', text: 'text-indigo-300' },
};

function resolveEmotion(raw: string | undefined): EmotionTone | null {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  if (EMOTION_TONES[key]) return EMOTION_TONES[key];
  for (const [k, tone] of Object.entries(EMOTION_TONES)) {
    if (key.includes(k)) return tone;
  }
  return null;
}

function resolveSourceBadge(raw: string | undefined): { label: string; className: string } {
  const src = (raw || 'unknown').toLowerCase();
  if (src.includes('reddit')) {
    return { label: raw || 'Reddit', className: 'bg-blue-500/15 border-blue-500/50 text-blue-300' };
  }
  if (src.includes('forum') || src.includes('doctissimo') || src.includes('.it') || src.includes('.fr')) {
    return { label: raw || 'Forum', className: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' };
  }
  if (src.includes('amazon') || src.includes('review') || src.includes('trustpilot')) {
    return { label: raw || 'Reviews', className: 'bg-yellow-500/15 border-yellow-500/50 text-yellow-300' };
  }
  if (src.includes('youtube') || src.includes('tiktok') || src.includes('instagram')) {
    return { label: raw || 'Social', className: 'bg-pink-500/15 border-pink-500/50 text-pink-300' };
  }
  if (src.includes('quora')) {
    return { label: raw || 'Quora', className: 'bg-red-500/15 border-red-500/50 text-red-300' };
  }
  if (src.includes('recon') || src.includes('rebuild') || src.includes('synth') || src.includes('inferred')) {
    return { label: raw || 'Reconstructed', className: 'bg-orange-500/15 border-orange-500/50 text-orange-300' };
  }
  return { label: raw || 'source', className: 'bg-border/40 border-border text-text-muted' };
}

// Intensity → visual weight. If the avatar_deep_dive entry has no explicit
// intensity score, we infer one from the length + emotion strength so the
// card still gets a differentiated border.
function intensityToStyle(score: number): { border: string; bg: string; ring: string } {
  if (score >= 9) return { border: 'border-red-500/80', bg: 'bg-red-500/10', ring: 'shadow-[0_0_0_1px_rgba(239,68,68,0.35)]' };
  if (score >= 7) return { border: 'border-orange-500/70', bg: 'bg-orange-500/8', ring: '' };
  if (score >= 5) return { border: 'border-amber-500/60', bg: 'bg-amber-500/5', ring: '' };
  if (score >= 3) return { border: 'border-border', bg: 'bg-bg-primary', ring: '' };
  return { border: 'border-border/60', bg: 'bg-bg-primary', ring: '' };
}

// ============================================================
// 17-CATEGORY GROUPING
// ============================================================

type CategoryGroup = 'pain' | 'history' | 'psychology' | 'market' | 'language';

interface CategoryDef {
  id: string;               // matches dossier key e.g. '1_core_problems'
  label: string;
  group: CategoryGroup;
  special?: 'timeline' | 'iceberg' | 'intensity_bars';
}

const CATEGORIES: CategoryDef[] = [
  { id: '1_core_problems', label: 'Core Problems & Pains', group: 'pain' },
  { id: '2_daily_struggles', label: 'Day-to-Day Struggles', group: 'pain' },
  { id: '3_emotional_impact', label: 'Emotional Impact', group: 'pain' },
  { id: '4_social_impact', label: 'Social Impact', group: 'pain' },
  { id: '5_financial_impact', label: 'Financial Impact', group: 'pain' },
  { id: '8_trigger_moments', label: 'Trigger Moments', group: 'pain' },
  { id: '6_failed_solutions', label: 'Failed Solutions', group: 'history', special: 'timeline' },
  { id: '7_current_coping', label: 'Current Coping Mechanisms', group: 'history' },
  { id: '9_core_desires', label: 'Core Desires', group: 'psychology' },
  { id: '10_dream_outcomes', label: 'Dream Outcomes', group: 'psychology' },
  { id: '11_fears_anxieties', label: 'Fears & Anxieties', group: 'psychology', special: 'iceberg' },
  { id: '12_skepticism_objections', label: 'Skepticism & Objections', group: 'psychology', special: 'intensity_bars' },
  { id: '13_trust_signals', label: 'Trust Signals', group: 'market' },
  { id: '15_community_beliefs', label: 'Community Beliefs', group: 'market' },
  { id: '16_competitor_sentiment', label: 'Competitor Sentiment', group: 'market' },
  { id: '17_purchase_triggers', label: 'Purchase Triggers', group: 'market' },
  { id: '14_language_vocabulary', label: 'Language & Vocabulary', group: 'language' },
];

const GROUP_LABELS: Record<CategoryGroup, string> = {
  pain: 'Pain',
  history: 'History',
  psychology: 'Psychology',
  market: 'Market',
  language: 'Language',
};

const GROUP_COLORS: Record<CategoryGroup, string> = {
  pain: 'text-red-300 border-red-500/40',
  history: 'text-orange-300 border-orange-500/40',
  psychology: 'text-purple-300 border-purple-500/40',
  market: 'text-blue-300 border-blue-500/40',
  language: 'text-emerald-300 border-emerald-500/40',
};

// The dossier lead output nests the 17 categories under avatar_deep_dive.
// LLM output keys are fuzzy — a researcher sometimes emits '6_failed_solutions'
// and sometimes 'failed_solutions'. This resolver tries both.
function getCategoryEntries(
  deepDive: Record<string, unknown> | undefined,
  id: string,
): Verbatim[] {
  if (!deepDive) return [];
  const directKey = id;
  const strippedKey = id.replace(/^\d+_/, '');
  const raw = (deepDive[directKey] ?? deepDive[strippedKey]) as unknown;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): Verbatim => {
      if (typeof item === 'string') return { quote: item };
      const rec = item as Record<string, unknown>;
      return {
        quote: String(rec.quote ?? rec.text ?? rec.insight ?? ''),
        source: rec.source ? String(rec.source) : undefined,
        insight: rec.insight ? String(rec.insight) : undefined,
        emotion: rec.emotion ? String(rec.emotion) : undefined,
        intensity: typeof rec.intensity === 'number' ? rec.intensity : undefined,
      };
    })
    .filter((v) => v.quote.length > 0);
}

// If the LLM didn't attach an intensity score, infer it from text length
// + emotion presence — not accurate but gives the card a non-flat border.
function inferIntensity(v: Verbatim): number {
  if (typeof v.intensity === 'number') return Math.max(1, Math.min(10, v.intensity));
  const lengthScore = Math.min(6, Math.round(v.quote.length / 50));
  const emotionBonus = v.emotion ? 2 : 0;
  const insightBonus = v.insight && v.insight.length > 20 ? 1 : 0;
  return Math.max(3, Math.min(10, lengthScore + emotionBonus + insightBonus + 2));
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Gate2DeepDiveView({
  data,
  reviewResult,
  sourceLanguage,
  humanDecisions,
  onDecisionsChange,
}: Gate2DeepDiveViewProps) {
  const deepDive = (data.avatar_deep_dive ?? data.deep_dive ?? {}) as Record<string, unknown>;
  const desireResearch = data.desire_research as Record<string, unknown> | undefined;
  const voiceProfile = data.voice_profile as Record<string, unknown> | undefined;
  const languageMining = data.customer_language_mining as Record<string, unknown> | undefined;
  const angleCandidates = Array.isArray(data.angle_candidates)
    ? (data.angle_candidates as Record<string, unknown>[])
    : [];
  const topAngles = Array.isArray(data.top_angles)
    ? (data.top_angles as Record<string, unknown>[])
    : [];
  const buyerPsychology = data.buyer_psychology_analysis as Record<string, unknown> | undefined;
  const strategicRecs = typeof data.strategic_recommendations === 'string'
    ? (data.strategic_recommendations as string)
    : '';
  const patternsIdentified = Array.isArray(data.patterns_identified)
    ? (data.patterns_identified as string[])
    : [];

  // Reviewed = collapsed. Stored in humanDecisions so it persists.
  const reviewedSet = useMemo<Set<string>>(() => {
    const raw = (humanDecisions?.gate2_reviewed as string[] | undefined) ?? [];
    return new Set(Array.isArray(raw) ? raw : []);
  }, [humanDecisions]);

  const toggleReviewed = useCallback(
    (catId: string) => {
      if (!onDecisionsChange) return;
      const next = new Set(reviewedSet);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      onDecisionsChange({
        ...(humanDecisions ?? {}),
        gate2_reviewed: Array.from(next),
      });
    },
    [humanDecisions, onDecisionsChange, reviewedSet],
  );

  // Active anchor for sidebar highlight.
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    const handler = () => {
      const anchors = document.querySelectorAll<HTMLElement>('[data-cat-anchor]');
      let current: string | null = null;
      for (const el of anchors) {
        const rect = el.getBoundingClientRect();
        if (rect.top < 200) current = el.dataset.catAnchor ?? null;
      }
      setActiveId(current);
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const groupedCategories = useMemo(() => {
    const groups: Record<CategoryGroup, CategoryDef[]> = {
      pain: [],
      history: [],
      psychology: [],
      market: [],
      language: [],
    };
    for (const c of CATEGORIES) groups[c.group].push(c);
    return groups;
  }, []);

  return (
    <TranslateCtx.Provider value={sourceLanguage ?? null}>
      <div className="space-y-4">
        {/* ============================================================ */}
        {/* QUALITY REVIEW BAR (sticky top)                                */}
        {/* ============================================================ */}
        {reviewResult && <QualityReviewBar review={reviewResult} />}

        {/* ============================================================ */}
        {/* TWO-COLUMN LAYOUT: sticky sidebar + main                       */}
        {/* ============================================================ */}
        <div className="flex gap-6">
          {/* Sidebar — sticky, anchor links grouped */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-[88px] space-y-4">
              {(Object.keys(groupedCategories) as CategoryGroup[]).map((group) => (
                <div key={group}>
                  <div
                    className={`text-[10px] uppercase tracking-widest font-bold mb-1.5 pb-1 border-b ${GROUP_COLORS[group]}`}
                  >
                    {GROUP_LABELS[group]}
                  </div>
                  <ul className="space-y-0.5">
                    {groupedCategories[group].map((c) => {
                      const entries = getCategoryEntries(deepDive, c.id);
                      const reviewed = reviewedSet.has(c.id);
                      const isActive = activeId === c.id;
                      return (
                        <li key={c.id}>
                          <a
                            href={`#${c.id}`}
                            className={`block text-[11px] py-0.5 pl-2 border-l-2 transition ${
                              isActive
                                ? 'border-accent-orange text-accent-orange font-semibold'
                                : 'border-border text-text-muted hover:text-text-primary hover:border-text-muted'
                            } ${reviewed ? 'line-through opacity-50' : ''}`}
                          >
                            {c.label}
                            {entries.length > 0 && (
                              <span className="text-text-muted ml-1">· {entries.length}</span>
                            )}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {/* Extra sections — sidebar shortcuts */}
              <div>
                <div className="text-[10px] uppercase tracking-widest font-bold mb-1.5 pb-1 border-b border-accent-teal/40 text-accent-teal">
                  Extras
                </div>
                <ul className="space-y-0.5 text-[11px]">
                  {desireResearch && <SidebarLink href="#desire-research" label="Desire Research" active={activeId === 'desire-research'} />}
                  {voiceProfile && <SidebarLink href="#voice-profile" label="Voice Profile" active={activeId === 'voice-profile'} />}
                  {languageMining && <SidebarLink href="#language-mining" label="Language Mining" active={activeId === 'language-mining'} />}
                  {angleCandidates.length > 0 && <SidebarLink href="#angles" label="Angles" active={activeId === 'angles'} />}
                  {buyerPsychology && <SidebarLink href="#buyer-psych" label="Buyer Psychology" active={activeId === 'buyer-psych'} />}
                </ul>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-6">
            {(['pain', 'history', 'psychology', 'market', 'language'] as CategoryGroup[]).map((group) => {
              const cats = groupedCategories[group];
              const hasAny = cats.some((c) => getCategoryEntries(deepDive, c.id).length > 0);
              if (!hasAny) return null;
              return (
                <section key={group} className="space-y-3">
                  <h2 className={`text-sm font-bold uppercase tracking-wider pb-2 border-b ${GROUP_COLORS[group]}`}>
                    {GROUP_LABELS[group]}
                  </h2>
                  {cats.map((c) => {
                    const entries = getCategoryEntries(deepDive, c.id);
                    if (entries.length === 0) return null;
                    return (
                      <CategorySection
                        key={c.id}
                        def={c}
                        entries={entries}
                        reviewed={reviewedSet.has(c.id)}
                        onToggleReviewed={() => toggleReviewed(c.id)}
                      />
                    );
                  })}
                </section>
              );
            })}

            {/* ============================================================ */}
            {/* DESIRE RESEARCH — chains (accordion ladder) + power ranking   */}
            {/* ============================================================ */}
            {desireResearch && (
              <DesireResearchSection desireResearch={desireResearch} />
            )}

            {/* Voice profile */}
            {voiceProfile && <VoiceProfileSection voice={voiceProfile} />}

            {/* Customer language mining */}
            {languageMining && <LanguageMiningSection mining={languageMining} />}

            {/* Angles */}
            {(angleCandidates.length > 0 || topAngles.length > 0) && (
              <AnglesSection candidates={angleCandidates} top={topAngles} />
            )}

            {/* Buyer psychology */}
            {buyerPsychology && <BuyerPsychologySection psych={buyerPsychology} />}

            {/* Patterns + strategic recommendations */}
            {(patternsIdentified.length > 0 || strategicRecs) && (
              <section className="p-4 bg-bg-card border border-border rounded-xl space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                  Strategic summary
                </h3>
                {patternsIdentified.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-text-muted mb-1">
                      Patterns identified
                    </div>
                    <ul className="space-y-1 text-xs text-text-secondary">
                      {patternsIdentified.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-accent-teal">▸</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {strategicRecs && (
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-text-muted mb-1">
                      Recommendation
                    </div>
                    <p className="text-xs text-text-secondary italic leading-relaxed">
                      {strategicRecs}
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </TranslateCtx.Provider>
  );
}

function SidebarLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <li>
      <a
        href={href}
        className={`block py-0.5 pl-2 border-l-2 transition ${
          active
            ? 'border-accent-teal text-accent-teal font-semibold'
            : 'border-border text-text-muted hover:text-text-primary'
        }`}
      >
        {label}
      </a>
    </li>
  );
}

// ============================================================
// QUALITY REVIEW BAR — sticky, radar chart + blockers
// ============================================================

function QualityReviewBar({ review }: { review: ReviewResult }) {
  const pct = review.percentage ?? Math.round((review.score / Math.max(1, review.maxScore)) * 100);
  const passed = review.passed;
  const dims = review.dimensions ?? [];
  const blockers = dims.filter((d) => d.score < 6);

  return (
    <div className="sticky top-4 z-20 p-4 bg-bg-card/95 backdrop-blur border border-border rounded-xl shadow-lg space-y-3">
      {/* Blockers FIRST, in red, at the top */}
      {blockers.length > 0 && (
        <div className="p-2.5 bg-red-500/10 border border-red-500/40 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 font-bold">⚠</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">
              {blockers.length} blocker{blockers.length > 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-0.5">
            {blockers.map((b) => (
              <li key={b.criterionId} className="text-xs text-red-200">
                <span className="font-semibold">{b.name}</span>
                <span className="text-red-300/70"> — {b.score}/{b.maxScore}</span>
                {b.feedback && <div className="text-[10px] text-red-200/80 pl-2 italic">{b.feedback}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Score ring */}
        <div className="shrink-0">
          <ScoreRing percentage={pct} passed={passed} />
        </div>

        {/* Radar chart for all sub-dimensions */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase font-bold tracking-widest text-text-muted mb-1">
            Sub-scores
          </div>
          <RadarChart dimensions={dims} />
        </div>

        {/* Legend with dim names */}
        <div className="hidden xl:block shrink-0 max-w-[200px]">
          <div className="text-[10px] uppercase font-bold tracking-widest text-text-muted mb-1">
            Dimensions
          </div>
          <ul className="space-y-0.5 text-[10px] text-text-secondary">
            {dims.slice(0, 10).map((d) => (
              <li key={d.criterionId} className="flex gap-2 justify-between">
                <span className="truncate">{d.name}</span>
                <span
                  className={`font-bold ${d.score < 6 ? 'text-red-300' : d.score < 8 ? 'text-amber-300' : 'text-emerald-300'}`}
                >
                  {d.score}/{d.maxScore}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ percentage, passed }: { percentage: number; passed: boolean }) {
  const size = 72;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const dash = (percentage / 100) * circ;
  const color = passed ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-text-primary leading-none">{percentage}</span>
        <span className="text-[8px] uppercase font-bold text-text-muted">score</span>
      </div>
    </div>
  );
}

function RadarChart({ dimensions }: { dimensions: ReviewResult['dimensions'] }) {
  if (!dimensions || dimensions.length < 3) return null;
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 8;
  const n = dimensions.length;

  const points = dimensions.map((d, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const pct = d.score / Math.max(1, d.maxScore);
    const x = cx + radius * pct * Math.cos(angle);
    const y = cy + radius * pct * Math.sin(angle);
    return { x, y, pct };
  });

  const gridRings = [0.25, 0.5, 0.75, 1.0].map((r) => {
    const ringPoints = dimensions.map((_, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      return `${cx + radius * r * Math.cos(angle)},${cy + radius * r * Math.sin(angle)}`;
    });
    return ringPoints.join(' ');
  });

  const axisLines = dimensions.map((_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      x2: cx + radius * Math.cos(angle),
      y2: cy + radius * Math.sin(angle),
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={size} height={size}>
      {gridRings.map((ring, i) => (
        <polygon key={i} points={ring} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {axisLines.map((l, i) => (
        <line key={i} x1={cx} y1={cy} x2={l.x2} y2={l.y2} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      <polygon
        points={polygonPoints}
        fill="rgba(20,184,166,0.25)"
        stroke="#14b8a6"
        strokeWidth={1.5}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2.5}
          fill={p.pct < 0.6 ? '#ef4444' : p.pct < 0.8 ? '#f59e0b' : '#10b981'}
        />
      ))}
    </svg>
  );
}

// ============================================================
// CATEGORY SECTION — collapsible, with special variants
// ============================================================

function CategorySection({
  def,
  entries,
  reviewed,
  onToggleReviewed,
}: {
  def: CategoryDef;
  entries: Verbatim[];
  reviewed: boolean;
  onToggleReviewed: () => void;
}) {
  const [open, setOpen] = useState(!reviewed);

  // When marking reviewed, auto-collapse. Uncollapse on un-review.
  useEffect(() => {
    setOpen(!reviewed);
  }, [reviewed]);

  return (
    <div
      id={def.id}
      data-cat-anchor={def.id}
      className="bg-bg-card border border-border rounded-xl overflow-hidden scroll-mt-24"
    >
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <span className={`text-text-muted text-xs transition ${open ? 'rotate-90' : ''}`}>▸</span>
          <h3 className="text-sm font-semibold text-text-primary">{def.label}</h3>
          <span className="text-[10px] text-text-muted">· {entries.length}</span>
        </button>
        <button
          type="button"
          onClick={onToggleReviewed}
          className={`text-[10px] px-2 py-1 rounded border transition ${
            reviewed
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
              : 'border-border text-text-muted hover:text-text-primary hover:border-text-muted'
          }`}
        >
          {reviewed ? '✓ reviewed' : 'mark reviewed'}
        </button>
      </div>

      {open && (
        <div className="p-3">
          {def.special === 'timeline' && <PastAttemptsTimeline entries={entries} />}
          {def.special === 'iceberg' && <FearsIceberg entries={entries} />}
          {def.special === 'intensity_bars' && <ObjectionsBars entries={entries} />}
          {!def.special && <VerbatimGrid entries={entries} />}
        </div>
      )}
    </div>
  );
}

// ============================================================
// VERBATIM CARD GRID (default)
// ============================================================

function VerbatimGrid({ entries }: { entries: Verbatim[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {entries.map((v, i) => (
        <VerbatimCard key={i} v={v} />
      ))}
    </div>
  );
}

function TierBadge({ tier }: { tier?: string }) {
  if (!tier) return null;
  const isVerbatim = tier.toLowerCase().includes('verbatim') || tier.toLowerCase() === 'v' || tier.toLowerCase() === 'tier1';
  return (
    <span
      className={`text-[8px] uppercase font-bold px-1 py-px rounded tracking-wide ${
        isVerbatim
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
      }`}
      title={isVerbatim ? 'Tier 1 — Verbatim from real source' : 'Tier 2 — Reconstructed from patterns'}
    >
      {isVerbatim ? 'T1 verbatim' : 'T2 reconstructed'}
    </span>
  );
}

function VerbatimCard({ v }: { v: Verbatim }) {
  const intensity = inferIntensity(v);
  const style = intensityToStyle(intensity);
  const tone = resolveEmotion(v.emotion);
  const sourceBadge = resolveSourceBadge(v.source);

  return (
    <div className={`relative p-3 border rounded-lg ${style.border} ${style.bg} ${style.ring} space-y-1.5`}>
      {/* Intensity indicator */}
      <div className="absolute top-2 right-2 text-[9px] font-bold text-text-muted uppercase">
        {intensity}/10
      </div>

      <p className="text-xs text-text-primary italic leading-snug pr-10">
        &ldquo;{v.quote}&rdquo;
      </p>
      <InlineTranslate text={v.quote} />

      {v.insight && (
        <p className="text-[10px] text-text-muted leading-snug border-l-2 border-border pl-2">
          {v.insight}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <TierBadge tier={v.tier} />
        {tone && (
          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${tone.border} ${tone.bg} ${tone.text}`}>
            {v.emotion}
          </span>
        )}
        <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded border ${sourceBadge.className}`}>
          {sourceBadge.label}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// PAST ATTEMPTS — timeline layout
// ============================================================

function PastAttemptsTimeline({ entries }: { entries: Verbatim[] }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-accent-orange via-amber-500 to-red-500" />
      <div className="space-y-3">
        {entries.map((v, i) => {
          const tone = resolveEmotion(v.emotion);
          const sourceBadge = resolveSourceBadge(v.source);
          return (
            <div key={i} className="relative">
              <div className="absolute -left-[18px] top-2 w-3 h-3 rounded-full bg-accent-orange ring-2 ring-bg-card" />
              <div className="p-3 bg-bg-primary border border-border rounded-lg">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[9px] font-bold uppercase text-text-muted">
                    Attempt #{i + 1}
                  </span>
                  <TierBadge tier={v.tier} />
                  {tone && (
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${tone.border} ${tone.bg} ${tone.text}`}>
                      {v.emotion}
                    </span>
                  )}
                  <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded border ${sourceBadge.className} ml-auto`}>
                    {sourceBadge.label}
                  </span>
                </div>
                <p className="text-xs text-text-primary italic leading-snug">
                  &ldquo;{v.quote}&rdquo;
                </p>
                <InlineTranslate text={v.quote} />
                {v.insight && (
                  <p className="text-[10px] text-text-muted mt-1 pl-2 border-l-2 border-border">
                    Why it failed: {v.insight}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// FEARS — iceberg visual depth (surface → existential)
// ============================================================

function FearsIceberg({ entries }: { entries: Verbatim[] }) {
  // Sort fears by "depth" — inferred from length + emotion intensity.
  // Longer/more-emotional fears sink toward the bottom (existential).
  const sorted = [...entries].sort((a, b) => inferIntensity(b) - inferIntensity(a));
  // Reverse for visual — deepest on bottom
  const layers = sorted.reverse();

  return (
    <div className="relative">
      {/* Waterline */}
      <div className="relative h-6 bg-gradient-to-b from-cyan-500/10 to-cyan-500/30 border-b-2 border-cyan-400/60 rounded-t-lg flex items-center justify-center">
        <span className="text-[9px] uppercase font-bold tracking-widest text-cyan-300">
          ≈ waterline — conscious fears ≈
        </span>
      </div>
      {/* Iceberg body with increasing depth + darkness */}
      <div className="bg-gradient-to-b from-blue-900/20 via-blue-900/40 to-slate-900/60 border-x border-b border-border rounded-b-lg p-3 space-y-2">
        {layers.map((v, i) => {
          const depthRatio = (i + 1) / layers.length;
          const indent = Math.round(depthRatio * 20);
          const opacity = 0.5 + (1 - depthRatio) * 0.5;
          const tone = resolveEmotion(v.emotion);
          const label = depthRatio < 0.33 ? 'Surface' : depthRatio < 0.66 ? 'Buried' : 'Existential';
          const labelColor =
            depthRatio < 0.33 ? 'text-cyan-300' : depthRatio < 0.66 ? 'text-indigo-300' : 'text-purple-300';
          return (
            <div
              key={i}
              className="p-2.5 bg-bg-primary/60 border border-border rounded-lg"
              style={{ marginLeft: `${indent}px`, marginRight: `${indent}px`, opacity }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-bold uppercase tracking-wider ${labelColor}`}>
                  {label}
                </span>
                <span className="text-[9px] text-text-muted">depth {Math.round(depthRatio * 100)}%</span>
                {tone && (
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${tone.border} ${tone.bg} ${tone.text} ml-auto`}>
                    {v.emotion}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-primary italic leading-snug">
                &ldquo;{v.quote}&rdquo;
              </p>
              <InlineTranslate text={v.quote} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// OBJECTIONS — intensity bars instead of text
// ============================================================

function ObjectionsBars({ entries }: { entries: Verbatim[] }) {
  return (
    <div className="space-y-2">
      {entries.map((v, i) => {
        const intensity = inferIntensity(v);
        const tone = resolveEmotion(v.emotion);
        const sourceBadge = resolveSourceBadge(v.source);
        const barColor =
          intensity >= 8 ? 'bg-red-500' : intensity >= 6 ? 'bg-orange-500' : intensity >= 4 ? 'bg-amber-500' : 'bg-slate-500';
        return (
          <div key={i} className="p-2.5 bg-bg-primary border border-border rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-primary italic leading-snug">
                  &ldquo;{v.quote}&rdquo;
                </p>
                <InlineTranslate text={v.quote} />
                {v.insight && (
                  <p className="text-[10px] text-text-muted mt-1">{v.insight}</p>
                )}
              </div>
              <div className="shrink-0 w-24">
                <div className="text-[9px] uppercase font-bold text-text-muted mb-0.5 text-right">
                  {intensity}/10
                </div>
                <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} transition-all`}
                    style={{ width: `${intensity * 10}%` }}
                  />
                </div>
              </div>
            </div>
            {(tone || v.source) && (
              <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border/50">
                {tone && (
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${tone.border} ${tone.bg} ${tone.text}`}>
                    {v.emotion}
                  </span>
                )}
                <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded border ${sourceBadge.className}`}>
                  {sourceBadge.label}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// DESIRE RESEARCH — ladder + horizontal bar chart
// ============================================================

function DesireResearchSection({ desireResearch }: { desireResearch: Record<string, unknown> }) {
  const deepDesires = (desireResearch.deep_desires as DesireChain[] | undefined) ?? [];
  const powerRanking = (desireResearch.desire_power_ranking as DesirePowerRanking[] | undefined) ?? [];
  const sorted = [...powerRanking].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const maxTotal = Math.max(1, ...sorted.map((d) => d.total ?? 0));

  return (
    <section
      id="desire-research"
      data-cat-anchor="desire-research"
      className="p-4 bg-bg-card border border-purple-500/30 rounded-xl space-y-4 scroll-mt-24"
    >
      <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300">
        Desire Research
      </h3>

      {/* Desire chains — ladder accordion */}
      {deepDesires.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-text-muted mb-2">
            Desire chains ({deepDesires.length})
          </div>
          <div className="space-y-2">
            {deepDesires.map((chain, i) => (
              <DesireChainLadder key={i} chain={chain} index={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Desire power ranking — horizontal bar chart */}
      {sorted.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-text-muted mb-2">
            Power ranking (scope × urgency × staying power)
          </div>
          <div className="space-y-1.5">
            {sorted.map((d, i) => {
              const width = ((d.total ?? 0) / maxTotal) * 100;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-text-primary truncate pr-2">{d.desire}</span>
                    <span className="text-text-muted font-mono shrink-0">
                      {d.total ?? 0}
                    </span>
                  </div>
                  <div className="h-3 bg-border/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${Math.max(5, width)}%` }}
                    />
                  </div>
                  {(d.scope !== undefined || d.urgency !== undefined || d.staying_power !== undefined) && (
                    <div className="flex gap-3 text-[9px] text-text-muted mt-0.5">
                      <span>scope {d.scope ?? '–'}/10</span>
                      <span>urg {d.urgency ?? '–'}/10</span>
                      <span>stay {d.staying_power ?? '–'}/10</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function DesireChainLadder({ chain, index }: { chain: DesireChain; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-2.5 bg-bg-primary flex items-center gap-2 text-left hover:bg-bg-primary/70"
      >
        <span className={`text-text-muted text-xs transition ${open ? 'rotate-90' : ''}`}>▸</span>
        <span className="text-[10px] font-bold text-text-muted uppercase">#{index}</span>
        <span className="text-xs text-text-primary flex-1 truncate">
          {chain.surface || '(no surface desire)'}
        </span>
        {chain.instinct_rank !== undefined && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/40">
            instinct #{chain.instinct_rank}
          </span>
        )}
      </button>
      {open && (
        <div className="p-3 bg-bg-card space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 p-2 bg-cyan-500/10 border border-cyan-500/40 rounded">
              <div className="text-[9px] uppercase font-bold text-cyan-300">Surface</div>
              <div className="text-xs text-text-primary">{chain.surface}</div>
            </div>
            <span className="text-purple-400 text-xl">→</span>
            <div className="flex-1 p-2 bg-purple-500/10 border border-purple-500/40 rounded">
              <div className="text-[9px] uppercase font-bold text-purple-300">Middle</div>
              <div className="text-xs text-text-primary">{chain.middle}</div>
            </div>
            <span className="text-pink-400 text-xl">→</span>
            <div className="flex-1 p-2 bg-pink-500/10 border border-pink-500/40 rounded">
              <div className="text-[9px] uppercase font-bold text-pink-300">Core</div>
              <div className="text-xs text-text-primary">{chain.core}</div>
            </div>
          </div>
          {chain.mass_instinct && (
            <div className="text-[11px] text-text-secondary">
              <span className="text-[9px] uppercase font-bold text-text-muted">Mass instinct: </span>
              {chain.mass_instinct}
            </div>
          )}
          {chain.connection_chain && (
            <div className="text-[11px] text-text-secondary italic font-mono">
              {chain.connection_chain}
            </div>
          )}
          {chain.copy_angle && (
            <div className="p-2 bg-accent-orange/10 border-l-2 border-accent-orange rounded">
              <div className="text-[9px] uppercase font-bold text-accent-orange">Copy angle</div>
              <div className="text-xs text-text-primary">{chain.copy_angle}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// VOICE PROFILE — kept compact
// ============================================================

function VoiceProfileSection({ voice }: { voice: Record<string, unknown> }) {
  const vocab = Array.isArray(voice.vocabulary) ? (voice.vocabulary as string[]) : [];
  const phrasesUse = Array.isArray(voice.phrases_to_use) ? (voice.phrases_to_use as string[]) : [];
  const phrasesAvoid = Array.isArray(voice.phrases_to_avoid) ? (voice.phrases_to_avoid as string[]) : [];
  const sample = typeof voice.sample_paragraph === 'string' ? (voice.sample_paragraph as string) : '';
  const tone = typeof voice.emotional_tone === 'string' ? (voice.emotional_tone as string) : '';
  const register = typeof voice.register === 'string' ? (voice.register as string) : '';
  const formality = voice.formality_level != null ? String(voice.formality_level) : '';

  const constraints = (voice.vocabulary_constraints && typeof voice.vocabulary_constraints === 'object'
    ? (voice.vocabulary_constraints as Record<string, unknown>)
    : null);
  const forbiddenWords = constraints && Array.isArray(constraints.forbidden_words) ? (constraints.forbidden_words as string[]) : [];
  const powerWords = constraints && Array.isArray(constraints.power_words) ? (constraints.power_words as string[]) : [];
  const registerRules = constraints && Array.isArray(constraints.register_rules) ? (constraints.register_rules as string[]) : [];

  const sentencePatterns = voice.sentence_patterns && typeof voice.sentence_patterns === 'object'
    ? (voice.sentence_patterns as Record<string, unknown>)
    : null;

  const emotionalRegister = voice.emotional_register && typeof voice.emotional_register === 'object'
    ? (voice.emotional_register as Record<string, unknown>)
    : null;

  const keyExpressions = Array.isArray(voice.key_expressions) ? (voice.key_expressions as Record<string, unknown>[]) : [];
  const metaphorPatterns = Array.isArray(voice.metaphor_patterns) ? (voice.metaphor_patterns as Record<string, unknown>[]) : [];

  const bridge = voice.bridge_to_mechanism && typeof voice.bridge_to_mechanism === 'object'
    ? (voice.bridge_to_mechanism as Record<string, unknown>)
    : null;

  return (
    <section
      id="voice-profile"
      data-cat-anchor="voice-profile"
      className="p-4 bg-bg-card border border-emerald-500/30 rounded-xl space-y-3 scroll-mt-24"
    >
      <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
        Voice Profile
      </h3>

      {/* TOP INFO ROW — tone + register + formality */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {tone && (
          <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-text-muted uppercase">Tone:</span>{' '}
            <span className="text-emerald-200 font-semibold">{tone}</span>
          </span>
        )}
        {register && (
          <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-text-muted uppercase">Register:</span>{' '}
            <span className="text-emerald-200 font-semibold">{register}</span>
          </span>
        )}
        {formality && (
          <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-text-muted uppercase">Formality:</span>{' '}
            <span className="text-emerald-200 font-semibold">{formality}/5</span>
          </span>
        )}
      </div>

      {sample && (
        <div className="p-3 bg-bg-primary border-l-2 border-emerald-500/50 rounded-r">
          <div className="text-[10px] uppercase font-semibold text-emerald-300 mb-1">
            Sample paragraph (in their voice)
          </div>
          <p className="text-xs text-text-primary italic leading-relaxed">{sample}</p>
        </div>
      )}

      {/* EMOTIONAL REGISTER — baseline / peak / suppressed */}
      {emotionalRegister && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {['baseline', 'peak', 'suppressed'].map((k) => {
            const val = emotionalRegister[k];
            if (!val || typeof val !== 'string') return null;
            return (
              <div key={k} className="p-2 bg-bg-primary border border-emerald-500/20 rounded">
                <div className="text-[9px] uppercase font-bold text-emerald-300 mb-0.5">{k}</div>
                <div className="text-[11px] text-text-primary">{val}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* SENTENCE PATTERNS */}
      {sentencePatterns && (
        <div className="p-3 bg-bg-primary border border-emerald-500/20 rounded">
          <div className="text-[10px] uppercase font-bold text-emerald-300 mb-2">Sentence patterns</div>
          <div className="space-y-1 text-[11px]">
            {typeof sentencePatterns.typical_length === 'string' && (
              <div><span className="text-text-muted">Length: </span><span className="text-text-primary">{sentencePatterns.typical_length as string}</span></div>
            )}
            {typeof sentencePatterns.fragments_vs_complete === 'string' && (
              <div><span className="text-text-muted">Form: </span><span className="text-text-primary">{sentencePatterns.fragments_vs_complete as string}</span></div>
            )}
            {typeof sentencePatterns.punctuation_habits === 'string' && (
              <div><span className="text-text-muted">Punctuation: </span><span className="text-text-primary">{sentencePatterns.punctuation_habits as string}</span></div>
            )}
            {Array.isArray(sentencePatterns.structures) && (sentencePatterns.structures as unknown[]).length > 0 && (
              <div>
                <div className="text-text-muted mb-0.5">Recurring structures:</div>
                <ul className="space-y-0.5">
                  {(sentencePatterns.structures as string[]).map((s, i) => (
                    <li key={i} className="text-text-primary pl-2">▸ {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VOCABULARY CONSTRAINTS — power vs forbidden */}
      {(powerWords.length > 0 || forbiddenWords.length > 0 || registerRules.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {powerWords.length > 0 && (
            <div className="p-3 bg-bg-primary border border-emerald-500/30 rounded">
              <div className="text-[10px] uppercase font-bold text-emerald-300 mb-1.5">⚡ Power words</div>
              <div className="flex flex-wrap gap-1">
                {powerWords.map((w, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-semibold">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}
          {forbiddenWords.length > 0 && (
            <div className="p-3 bg-bg-primary border border-red-500/30 rounded">
              <div className="text-[10px] uppercase font-bold text-red-300 mb-1.5">✗ Forbidden words</div>
              <div className="flex flex-wrap gap-1">
                {forbiddenWords.map((w, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-200 line-through">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}
          {registerRules.length > 0 && (
            <div className="p-3 bg-bg-primary border border-emerald-500/20 rounded md:col-span-2">
              <div className="text-[10px] uppercase font-bold text-emerald-300 mb-1.5">Register rules</div>
              <ul className="space-y-0.5">
                {registerRules.map((r, i) => (
                  <li key={i} className="text-[11px] text-text-secondary">• {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* KEY EXPRESSIONS */}
      {keyExpressions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-emerald-300 mb-1.5">
            Key expressions ({keyExpressions.length})
          </div>
          <div className="space-y-1.5">
            {keyExpressions.map((k, i) => {
              const expression = typeof k.expression === 'string' ? k.expression : '';
              const context = typeof k.context === 'string' ? k.context : '';
              const tier = typeof k.tier === 'string' ? k.tier : undefined;
              return (
                <div key={i} className="p-2 bg-bg-primary border border-emerald-500/20 rounded flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-[11px] text-emerald-200 font-semibold italic">&ldquo;{expression}&rdquo;</div>
                    {context && <div className="text-[10px] text-text-muted mt-0.5">↳ {context}</div>}
                  </div>
                  <TierBadge tier={tier} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* METAPHOR PATTERNS */}
      {metaphorPatterns.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-emerald-300 mb-1.5">
            Metaphor patterns ({metaphorPatterns.length})
          </div>
          <div className="space-y-1.5">
            {metaphorPatterns.map((m, i) => {
              const metaphor = typeof m.metaphor === 'string' ? m.metaphor : '';
              const domain = typeof m.domain === 'string' ? m.domain : '';
              const why = typeof m.why_it_resonates === 'string' ? m.why_it_resonates : '';
              return (
                <div key={i} className="p-2 bg-bg-primary border border-purple-500/20 rounded">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-[11px] text-purple-200 italic flex-1">&ldquo;{metaphor}&rdquo;</div>
                    {domain && (
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">
                        {domain}
                      </span>
                    )}
                  </div>
                  {why && <div className="text-[10px] text-text-muted">↳ {why}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BRIDGE TO MECHANISM */}
      {bridge && (
        <div className="p-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/40 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-emerald-300 mb-2">
            🌉 Bridge to Mechanism
          </div>
          <div className="space-y-1.5 text-[11px]">
            {typeof bridge.how_they_talk_about_cause === 'string' && (
              <div>
                <span className="text-text-muted">How they explain the cause: </span>
                <span className="text-text-primary italic">&ldquo;{bridge.how_they_talk_about_cause as string}&rdquo;</span>
              </div>
            )}
            {typeof bridge.belief_gaps === 'string' && (
              <div>
                <span className="text-text-muted">Belief gap: </span>
                <span className="text-text-primary">{bridge.belief_gaps as string}</span>
              </div>
            )}
            {typeof bridge.hook_bridge === 'string' && (
              <div className="p-2 bg-bg-primary border-l-2 border-emerald-500 rounded-r mt-1">
                <span className="text-[9px] uppercase text-emerald-300 font-bold">Hook bridge: </span>
                <span className="text-text-primary italic">&ldquo;{bridge.hook_bridge as string}&rdquo;</span>
              </div>
            )}
          </div>
        </div>
      )}

      {vocab.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-text-muted mb-1">
            Vocabulary ({vocab.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {vocab.map((w, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
      {phrasesUse.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-emerald-300 mb-1">
            ✓ Use these phrases
          </div>
          <ul className="space-y-0.5">
            {phrasesUse.map((p, i) => (
              <li key={i} className="text-[11px] text-text-secondary">• {p}</li>
            ))}
          </ul>
        </div>
      )}
      {phrasesAvoid.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-red-300 mb-1">
            ✗ Avoid these phrases
          </div>
          <ul className="space-y-0.5">
            {phrasesAvoid.map((p, i) => (
              <li key={i} className="text-[11px] text-text-secondary line-through opacity-70">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ============================================================
// LANGUAGE MINING — 7 categories of hook fragments
// ============================================================

const LANGUAGE_CATEGORY_META: Record<
  string,
  { label: string; accent: string; border: string; bg: string }
> = {
  pain: { label: 'Pain', accent: 'text-red-300', border: 'border-red-500/40', bg: 'bg-red-500/5' },
  desire: { label: 'Desire', accent: 'text-purple-300', border: 'border-purple-500/40', bg: 'bg-purple-500/5' },
  identity: { label: 'Identity', accent: 'text-amber-300', border: 'border-amber-500/40', bg: 'bg-amber-500/5' },
  failed_solution: { label: 'Failed Solution', accent: 'text-orange-300', border: 'border-orange-500/40', bg: 'bg-orange-500/5' },
  body_sensation: { label: 'Body Sensation', accent: 'text-rose-300', border: 'border-rose-500/40', bg: 'bg-rose-500/5' },
  emotional_state: { label: 'Emotional State', accent: 'text-blue-300', border: 'border-blue-500/40', bg: 'bg-blue-500/5' },
  action_coping: { label: 'Action / Coping', accent: 'text-emerald-300', border: 'border-emerald-500/40', bg: 'bg-emerald-500/5' },
};

const LANGUAGE_CATEGORY_ORDER = [
  'pain',
  'desire',
  'identity',
  'failed_solution',
  'body_sensation',
  'emotional_state',
  'action_coping',
];

type LanguagePhraseEntry = { phrase: string; tier?: string; evidence?: string };

function normalizePhraseEntry(raw: unknown): LanguagePhraseEntry | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return { phrase: raw };
  if (typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const phrase = typeof r.phrase === 'string' ? r.phrase : typeof r.text === 'string' ? r.text : '';
    if (!phrase) return null;
    return {
      phrase,
      tier: typeof r.tier === 'string' ? r.tier : undefined,
      evidence: typeof r.evidence === 'string' ? r.evidence : undefined,
    };
  }
  return null;
}

function LanguageMiningSection({ mining }: { mining: Record<string, unknown> }) {
  const knownKeys = new Set(LANGUAGE_CATEGORY_ORDER);
  const orderedKnown = LANGUAGE_CATEGORY_ORDER.filter((k) => Array.isArray(mining[k]) && (mining[k] as unknown[]).length > 0);
  const legacy = Object.entries(mining).filter(
    ([k, v]) => !knownKeys.has(k) && Array.isArray(v) && (v as unknown[]).length > 0,
  );
  const allKeys = [...orderedKnown, ...legacy.map(([k]) => k)];

  const totalPhrases = allKeys.reduce((sum, k) => sum + (Array.isArray(mining[k]) ? (mining[k] as unknown[]).length : 0), 0);

  return (
    <section
      id="language-mining"
      data-cat-anchor="language-mining"
      className="p-4 bg-bg-card border border-emerald-500/30 rounded-xl space-y-3 scroll-mt-24"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
          Customer Language Mining
        </h3>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${totalPhrases >= 70 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
          {totalPhrases}/70 phrases
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {allKeys.map((key) => {
          const meta = LANGUAGE_CATEGORY_META[key] || {
            label: key.replace(/_/g, ' '),
            accent: 'text-emerald-300',
            border: 'border-emerald-500/40',
            bg: 'bg-emerald-500/5',
          };
          const rawEntries = Array.isArray(mining[key]) ? (mining[key] as unknown[]) : [];
          const entries = rawEntries.map(normalizePhraseEntry).filter((e): e is LanguagePhraseEntry => !!e);
          return (
            <div key={key} className={`p-3 bg-bg-primary border ${meta.border} ${meta.bg} rounded-lg`}>
              <div className={`text-[10px] uppercase font-bold ${meta.accent} mb-2 flex items-center justify-between`}>
                <span>{meta.label}</span>
                <span className="font-mono opacity-70">{entries.length}/10</span>
              </div>
              <ul className="space-y-1.5">
                {entries.map((entry, i) => (
                  <li key={i} className="text-[11px] text-text-secondary leading-snug flex items-start gap-1.5">
                    <span className={`${meta.accent} opacity-60`}>▸</span>
                    <span className="flex-1">
                      {entry.phrase}
                      {entry.tier && (
                        <span
                          className={`ml-1.5 text-[8px] uppercase font-bold px-1 py-px rounded ${
                            entry.tier === 'verbatim'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {entry.tier === 'verbatim' ? 'V' : 'R'}
                        </span>
                      )}
                      {entry.evidence && (
                        <span className="block text-[9px] text-text-muted italic mt-0.5">
                          ↳ {entry.evidence}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// ANGLES SECTION — candidates + top 5 ranked
// ============================================================

function AnglesSection({
  candidates,
  top,
}: {
  candidates: Record<string, unknown>[];
  top: Record<string, unknown>[];
}) {
  const maxTotal = Math.max(
    1,
    ...candidates.map((a) => Number(a.total ?? 0)),
  );

  return (
    <section
      id="angles"
      data-cat-anchor="angles"
      className="p-4 bg-bg-card border border-blue-500/30 rounded-xl space-y-3 scroll-mt-24"
    >
      <h3 className="text-sm font-bold uppercase tracking-wider text-blue-300">
        Angles
      </h3>

      {top.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-text-muted mb-2">
            Top ranked
          </div>
          <div className="space-y-1.5">
            {top.map((t, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-bg-primary border border-blue-500/30 rounded">
                <span className="text-[10px] font-black text-blue-300 w-6">#{String(t.rank ?? i + 1)}</span>
                <span className="flex-1 text-xs text-text-primary">{String(t.angle_name ?? '')}</span>
                <span className="text-[10px] text-blue-300 font-mono">
                  {String(t.total_score ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-text-muted mb-2">
            All candidates ({candidates.length})
          </div>
          <div className="space-y-2">
            {candidates.map((a, i) => {
              const total = Number(a.total ?? 0);
              const width = (total / maxTotal) * 100;
              return (
                <div key={i} className="p-2.5 bg-bg-primary border border-border rounded-lg">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-text-primary">
                      {String(a.name ?? '')}
                    </span>
                    <span className="text-[10px] text-blue-300 font-mono">{total}</span>
                  </div>
                  <div className="h-1.5 bg-border/40 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      style={{ width: `${Math.max(5, width)}%` }}
                    />
                  </div>
                  {a.reason_to_buy ? (
                    <div className="text-[11px] text-text-secondary">{String(a.reason_to_buy)}</div>
                  ) : null}
                  {a.example_hook ? (
                    <div className="text-[10px] text-text-muted italic mt-0.5">
                      ↳ {String(a.example_hook)}
                    </div>
                  ) : null}
                  <div className="flex gap-3 text-[9px] text-text-muted mt-1">
                    <span>EV {String(a.ev ?? '-')}/10</span>
                    <span>MA {String(a.ma ?? '-')}/10</span>
                    <span>WS {String(a.ws ?? '-')}/10</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================
// BUYER PSYCHOLOGY — emotion bar chart
// ============================================================

function BuyerPsychologySection({ psych }: { psych: Record<string, unknown> }) {
  const emotions = (psych.buying_emotions as Record<string, { score?: number; evidence?: string }> | undefined) ?? {};
  const painDesire = psych.pain_desire_ratio as { pain_pct?: number; desire_pct?: number; copy_implication?: string } | undefined;
  const intensity = psych.emotional_intensity as { primary_emotion?: string; intensity_level?: string; evidence?: string } | undefined;

  const emotionRows = Object.entries(emotions).filter(([, v]) => typeof v?.score === 'number');

  return (
    <section
      id="buyer-psych"
      data-cat-anchor="buyer-psych"
      className="p-4 bg-bg-card border border-pink-500/30 rounded-xl space-y-3 scroll-mt-24"
    >
      <h3 className="text-sm font-bold uppercase tracking-wider text-pink-300">
        Buyer Psychology
      </h3>

      {emotionRows.length > 0 && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-text-muted mb-1.5">
            Buying emotions (1-10)
          </div>
          <div className="space-y-1">
            {emotionRows.map(([name, v]) => {
              const score = v.score ?? 0;
              const barColor =
                score >= 8 ? 'bg-red-500' : score >= 6 ? 'bg-orange-500' : score >= 4 ? 'bg-amber-500' : 'bg-slate-500';
              return (
                <div key={name}>
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="text-text-primary uppercase">{name}</span>
                    <span className="text-text-muted font-mono">{score}/10</span>
                  </div>
                  <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${score * 10}%` }} />
                  </div>
                  {v.evidence && (
                    <div className="text-[9px] text-text-muted italic mt-0.5">{v.evidence}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {painDesire && (painDesire.pain_pct !== undefined || painDesire.desire_pct !== undefined) && (
        <div>
          <div className="text-[10px] uppercase font-semibold text-text-muted mb-1">
            Pain vs Desire ratio
          </div>
          <div className="flex h-4 rounded-full overflow-hidden border border-border">
            <div
              className="bg-red-500 flex items-center justify-center text-[9px] font-bold text-white"
              style={{ width: `${painDesire.pain_pct ?? 0}%` }}
            >
              pain {painDesire.pain_pct ?? 0}%
            </div>
            <div
              className="bg-emerald-500 flex items-center justify-center text-[9px] font-bold text-white"
              style={{ width: `${painDesire.desire_pct ?? 0}%` }}
            >
              desire {painDesire.desire_pct ?? 0}%
            </div>
          </div>
          {painDesire.copy_implication && (
            <p className="text-[10px] text-text-muted italic mt-1">{painDesire.copy_implication}</p>
          )}
        </div>
      )}

      {intensity && intensity.intensity_level && (
        <div className="p-2 bg-bg-primary border border-border rounded">
          <div className="text-[10px] uppercase font-semibold text-text-muted">
            Emotional intensity
          </div>
          <div className="text-xs text-text-primary">
            {intensity.primary_emotion} · <span className="text-pink-300 uppercase font-bold">{intensity.intensity_level}</span>
          </div>
          {intensity.evidence && (
            <div className="text-[10px] text-text-muted italic mt-0.5">{intensity.evidence}</div>
          )}
        </div>
      )}
    </section>
  );
}
