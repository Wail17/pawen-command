// ============================================================
// PAWEN — Creative Context Aggregator
// Builds a COMPLETE, non-lossy creative brief from ALL upstream
// gates. Zero information loss — every gate's best signals are
// pulled and structured for injection into Gate 7/8 prompts.
// ============================================================

import type { Project } from '../types';
import type { SubAvatarV2 } from '../avatars/types';
import { buildDRInjection } from '../learning/drPrinciples';

// -------- Output structure --------

export interface CreativeContext {
  // Identity
  sub_avatar: {
    id: string;
    name: string;
    nickname: string;
    description: string;
    urgency_score: number;
    dominant_category: string;
    surface_desire: string;
    // Voice
    verbatim_quotes: string[];       // top 10 raw quotes
    emotional_triggers: string[];
    past_attempts: string[];
    demographics: string[];
    // Angles
    positioning_framework: string;
    positioning_description: string;
    hooks: string[];                 // sub-avatar hooks
    story_angle: {
      problem: string;
      agitation: string;
      solution: string;
      mechanism: string;
      cta: string;
    };
    // Deep dive enrichments (if available)
    identity_map?: Record<string, unknown>;
    linguistic_dna?: Record<string, unknown>;
    transformation_narrative?: Record<string, unknown>;
    hidden_fears?: string[];
    contradictions?: string[];
    dark_funnel?: Record<string, unknown>;
  };

  // Funnel
  funnel: {
    level: string;
    label: string;
    strategy: string;
  };

  // Brand DNA (locked terms + voice + visual)
  brand: {
    mechanism_name: string;
    root_cause: string;
    belief_error: string;
    mechanism_steps: Array<{ step: number; name: string; description: string }>;
    product_descriptor: string;
    guarantee: string;
    key_proof_points: string[];
    // Voice
    vocabulary: string[];
    sentence_style: string;
    formality: number;
    emotional_tone: string;
    phrases_to_use: string[];
    phrases_to_avoid: string[];
    // Customer language
    always_use: string[];
    never_use: string[];
    pain_quotes: string[];
    desire_quotes: string[];
    // Visual identity
    visual_metaphor: string;
    color_problem: string;
    color_solution: string;
    color_brand: string;
    image_rules: string[];
    // Emotional arc
    primary_emotion: string;
    secondary_emotion: string;
    resolution_emotion: string;
  };

  // Product (real data from Shopify or manual)
  product: {
    name: string;
    description: string;
    price?: string;
    currency?: string;
    features?: string[];
    benefits?: string[];
    variants?: Array<{ name: string; price: string }>;
    images?: string[];
    reviews?: Array<{ text: string; rating: number }>;
    avg_rating?: number;
    total_reviews?: number;
  };

  // Swipe vocabulary (from Phase P)
  swipe?: {
    power_words: string[];
    forbidden_words: string[];
    emotional_anchors: string[];
    metaphors: string[];
    identity_phrases: string[];
    objection_language: string[];
  };

  // Gate 3: Root Cause & Mechanism (full)
  root_cause?: {
    one_sentence: string;
    aha_moment?: string;
    villain?: string;
    false_belief?: string;
    corrected_belief?: string;
  };

  // Gate 4: Top hooks (scored, not all 105)
  top_hooks?: Array<{
    hook: string;
    formula: string;
    score: number;
    reptilian_trigger: string;
  }>;

  // Gate 5: Advertorial summary
  advertorial_summary?: string;

  // Gate 6: Ad concepts + headlines + body copies
  ad_concepts?: Array<{
    name: string;
    angle: string;
    emotional_territory: string;
    hook_direction: string;
    visual_direction: string;
  }>;
  headlines?: string[];
  body_copies?: string[];

  // Performance data (if available)
  performance?: {
    best_ctr?: number;
    best_cpa?: number;
    winning_angles?: string[];
  };

  // Competitor intelligence
  competitor_insights?: {
    overused_angles: string[];
    unexploited_gaps: string[];
    anti_angles: string[];
  };
}

// -------- Funnel metadata --------

const FUNNEL_STRATEGIES: Record<string, { label: string; strategy: string }> = {
  full_unaware: {
    label: 'Fully Unaware',
    strategy: 'Prospect does NOT know they have a problem. Lead with identity, story, or shocking pattern-interrupt. NEVER mention the product. Goal: make them realize the problem exists.',
  },
  problem_aware: {
    label: 'Problem Aware',
    strategy: 'Prospect KNOWS the pain but not the solution. Agitate the problem, validate their frustration, introduce the root cause. Position our mechanism as the missing piece.',
  },
  solution_aware: {
    label: 'Solution Aware',
    strategy: 'Prospect knows solutions exist but not ours. Differentiate via mechanism, proof, and unique angle. Show why other solutions fail and ours works.',
  },
  product_aware: {
    label: 'Product Aware',
    strategy: 'Prospect knows our product. Push social proof, testimonials, urgency, guarantee. Overcome final objections. Make the decision feel safe.',
  },
  most_aware: {
    label: 'Most Aware',
    strategy: 'Prospect is ready to buy. Lead with offer, scarcity, price anchor, bundle value. Remove friction. Strong CTA.',
  },
  retargeting: {
    label: 'Retargeting',
    strategy: 'They visited but did not buy. Address their specific objection, add new proof, create urgency. "Still thinking about it?" angle.',
  },
};

// -------- Builder --------

export function buildCreativeContext(
  project: Project,
  previousOutputs: Record<string, unknown>,
): CreativeContext {
  const brandDNA = project.brandDNA;
  const avatarResult = project.avatarRunResult;
  const selectedId = project.selectedSubAvatarId;
  const funnelKey = project.selectedFunnel || 'problem_aware';

  // Find selected sub-avatar
  let subAvatar: SubAvatarV2 | undefined;
  if (avatarResult?.sub_avatars && selectedId) {
    subAvatar = avatarResult.sub_avatars.find(s => s.id === selectedId);
  }
  if (!subAvatar && avatarResult?.sub_avatars?.length) {
    subAvatar = avatarResult.sub_avatars[0];
  }

  // Gate outputs (typed loosely — these are LLM-generated JSON)
  const g2 = previousOutputs['gate2'] as Record<string, unknown> | undefined;
  const g3 = previousOutputs['gate3'] as Record<string, unknown> | undefined;
  const g4 = previousOutputs['gate4'] as Record<string, unknown> | undefined;
  const g5 = previousOutputs['gate5'] as Record<string, unknown> | undefined;
  const g6 = previousOutputs['gate6'] as Record<string, unknown> | undefined;

  // Deep dive data from sub-avatar enrichments or Gate 2
  const latestDive = subAvatar?.deep_dives?.length
    ? subAvatar.deep_dives[subAvatar.deep_dives.length - 1]
    : undefined;

  // Extract top hooks from Gate 4
  const topHooks = extractTopHooks(g4);

  // Extract ad concepts + headlines from Gate 6
  const { concepts, headlines, bodyCopies } = extractGate6Data(g6);

  // Extract root cause from Gate 3
  const rootCause = extractRootCause(g3);

  // Funnel info
  const funnelInfo = FUNNEL_STRATEGIES[funnelKey] || FUNNEL_STRATEGIES.problem_aware;

  // Build swipe vocabulary block
  const swipe = extractSwipeFromRawSignal(avatarResult, subAvatar, project);

  // Performance data
  const perf = extractPerformance(project);

  // Competitor insights
  const competitor = extractCompetitorInsights(previousOutputs);

  const ctx: CreativeContext = {
    sub_avatar: {
      id: subAvatar?.id || 'unknown',
      name: subAvatar?.name || project.name,
      nickname: subAvatar?.nickname || '',
      description: subAvatar?.description || '',
      urgency_score: subAvatar?.urgency_score || 5,
      dominant_category: subAvatar?.dominant_category || 'emotion',
      surface_desire: subAvatar?.surface_desire || '',
      verbatim_quotes: (subAvatar?.verbatim_quotes || [])
        .slice(0, 10)
        .map(v => v.quote),
      emotional_triggers: subAvatar?.emotional_triggers || [],
      past_attempts: subAvatar?.past_attempts_failures || [],
      demographics: subAvatar?.implicit_demographics || [],
      positioning_framework: subAvatar?.angles?.positioning?.framework || '',
      positioning_description: subAvatar?.angles?.positioning?.description || '',
      hooks: subAvatar?.angles?.hooks || [],
      story_angle: subAvatar?.angles?.story_angle || {
        problem: '', agitation: '', solution: '', mechanism: '', cta: '',
      },
      // Deep dive
      identity_map: latestDive?.identity_map as Record<string, unknown> | undefined,
      linguistic_dna: latestDive?.linguistic_dna as Record<string, unknown> | undefined,
      transformation_narrative: latestDive?.transformation_narrative as Record<string, unknown> | undefined,
      hidden_fears: latestDive?.hidden_fears,
      contradictions: latestDive?.contradictions,
      dark_funnel: latestDive?.dark_funnel as Record<string, unknown> | undefined,
    },

    funnel: {
      level: funnelKey,
      label: funnelInfo.label,
      strategy: funnelInfo.strategy,
    },

    brand: {
      mechanism_name: brandDNA?.locked_terms?.mechanism_name || '',
      root_cause: brandDNA?.locked_terms?.root_cause_one_sentence || '',
      belief_error: brandDNA?.locked_terms?.belief_error || '',
      mechanism_steps: brandDNA?.locked_terms?.mechanism_3_steps || [],
      product_descriptor: brandDNA?.locked_terms?.product_descriptor || '',
      guarantee: brandDNA?.locked_terms?.guarantee_wording || '',
      key_proof_points: brandDNA?.locked_terms?.key_proof_points || [],
      vocabulary: brandDNA?.voice_profile?.vocabulary || [],
      sentence_style: brandDNA?.voice_profile?.sentence_style || '',
      formality: brandDNA?.voice_profile?.formality_level || 5,
      emotional_tone: brandDNA?.voice_profile?.emotional_tone || '',
      phrases_to_use: brandDNA?.voice_profile?.phrases_to_use || [],
      phrases_to_avoid: brandDNA?.voice_profile?.phrases_to_avoid || [],
      always_use: brandDNA?.customer_language?.always_use || [],
      never_use: brandDNA?.customer_language?.never_use || [],
      pain_quotes: (brandDNA?.customer_language?.pain_quotes || []).map(q => q.quote),
      desire_quotes: (brandDNA?.customer_language?.desire_quotes || []).map(q => q.quote),
      visual_metaphor: brandDNA?.visual_identity?.metaphor || '',
      color_problem: brandDNA?.visual_identity?.color_associations?.problem || '',
      color_solution: brandDNA?.visual_identity?.color_associations?.solution || '',
      color_brand: brandDNA?.visual_identity?.color_associations?.brand || '',
      image_rules: brandDNA?.visual_identity?.product_image_rules || [],
      primary_emotion: brandDNA?.emotional_arc?.primary_emotion || '',
      secondary_emotion: brandDNA?.emotional_arc?.secondary_emotion || '',
      resolution_emotion: brandDNA?.emotional_arc?.resolution_emotion || '',
    },

    product: {
      name: project.name,
      description: project.productDescription,
      price: project.shopifyData?.price ?? brandDNA?.product_specs?.price,
      currency: project.shopifyData?.currency ?? brandDNA?.product_specs?.currency,
      features: brandDNA?.product_specs?.key_features,
      benefits: brandDNA?.product_specs?.key_benefits,
      variants: (brandDNA?.product_specs?.available_variants || [])
        .filter(v => v.available)
        .map(v => ({ name: v.name, price: v.price })),
      images: brandDNA?.product_specs?.product_images,
      reviews: (brandDNA?.proof_inventory?.testimonials || [])
        .slice(0, 5)
        .map(t => ({ text: t.text, rating: t.rating })),
      avg_rating: brandDNA?.proof_inventory?.average_rating,
      total_reviews: brandDNA?.proof_inventory?.total_reviews,
    },

    swipe,
    root_cause: rootCause,
    top_hooks: topHooks,
    advertorial_summary: extractAdvertorialSummary(g5),
    ad_concepts: concepts,
    headlines,
    body_copies: bodyCopies,
    performance: perf,
    competitor_insights: competitor,
  };

  return ctx;
}

// -------- Extraction helpers --------

function extractTopHooks(
  g4: Record<string, unknown> | undefined,
): CreativeContext['top_hooks'] {
  if (!g4) return undefined;
  const hooks: CreativeContext['top_hooks'] = [];

  // Try to find hook-like structures in Gate 4 output
  const tryExtract = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    const o = obj as Record<string, unknown>;

    // Look for arrays of hooks
    for (const key of Object.keys(o)) {
      const val = o[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === 'object') {
            const h = item as Record<string, unknown>;
            // Look for hook-like objects with text + score
            const hookText = (h.hook || h.final_hook || h.headline || h.text || h.hook_text || '') as string;
            const score = (h.total || h.score || h.evolve_score || 0) as number;
            const formula = (h.formula || h.type || h.formula_type || '') as string;
            const trigger = (h.reptilian_trigger || h.trigger || '') as string;

            if (hookText && hookText.length > 5) {
              hooks.push({
                hook: hookText,
                formula: String(formula),
                score: Number(score) || 0,
                reptilian_trigger: String(trigger),
              });
            }
          }
        }
      }
    }
  };

  tryExtract(g4);

  // Sort by score, keep top 20
  return hooks
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function extractGate6Data(g6: Record<string, unknown> | undefined): {
  concepts: CreativeContext['ad_concepts'];
  headlines: string[];
  bodyCopies: string[];
} {
  if (!g6) return { concepts: undefined, headlines: [], bodyCopies: [] };

  const concepts: NonNullable<CreativeContext['ad_concepts']> = [];
  const headlines: string[] = [];
  const bodyCopies: string[] = [];

  const walk = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    const o = obj as Record<string, unknown>;

    // Extract ad concepts
    if (Array.isArray(o.ad_concepts)) {
      for (const c of o.ad_concepts) {
        if (c && typeof c === 'object') {
          const cc = c as Record<string, unknown>;
          concepts.push({
            name: String(cc.name || ''),
            angle: String(cc.angle || ''),
            emotional_territory: String(cc.emotional_territory || ''),
            hook_direction: String(cc.hook_direction || ''),
            visual_direction: String(cc.visual_direction || ''),
          });
        }
      }
    }

    // Extract headlines
    if (Array.isArray(o.headlines)) {
      for (const h of o.headlines) {
        if (typeof h === 'string') headlines.push(h);
        else if (h && typeof h === 'object') {
          const hh = h as Record<string, unknown>;
          const text = (hh.headline || hh.primary || hh.text || hh.final_headline || '') as string;
          if (text) headlines.push(text);
          // Also grab secondary/benefit/curiosity variants
          for (const k of ['secondary', 'benefit_led', 'curiosity_led']) {
            if (typeof hh[k] === 'string' && hh[k]) headlines.push(hh[k] as string);
          }
        }
      }
    }

    // Extract body copies
    if (Array.isArray(o.body_copies)) {
      for (const b of o.body_copies) {
        if (typeof b === 'string') bodyCopies.push(b);
        else if (b && typeof b === 'object') {
          const bb = b as Record<string, unknown>;
          const text = (bb.body || bb.text || bb.copy || bb.primary_text || '') as string;
          if (text) bodyCopies.push(text);
        }
      }
    }

    // Recurse into nested objects
    for (const key of Object.keys(o)) {
      if (typeof o[key] === 'object' && !Array.isArray(o[key]) && o[key] !== null) {
        walk(o[key]);
      }
    }
  };

  walk(g6);

  return {
    concepts: concepts.length > 0 ? concepts : undefined,
    headlines: headlines.slice(0, 20),
    bodyCopies: bodyCopies.slice(0, 10),
  };
}

function extractRootCause(g3: Record<string, unknown> | undefined): CreativeContext['root_cause'] {
  if (!g3) return undefined;

  const walk = (obj: unknown): CreativeContext['root_cause'] => {
    if (!obj || typeof obj !== 'object') return undefined;
    const o = obj as Record<string, unknown>;

    // Direct match
    if (o.root_cause || o.one_sentence || o.aha_moment) {
      const rc = (typeof o.root_cause === 'object' ? o.root_cause : o) as Record<string, unknown>;
      return {
        one_sentence: String(rc.one_sentence || rc.root_cause_one_sentence || o.root_cause || ''),
        aha_moment: String(rc.aha_moment || rc.aha_sentence || ''),
        villain: String(rc.villain || rc.hidden_enemy || ''),
        false_belief: String(rc.false_belief || rc.belief_error || o.belief_error || ''),
        corrected_belief: String(rc.corrected_belief || ''),
      };
    }

    // Recurse
    for (const key of Object.keys(o)) {
      if (typeof o[key] === 'object' && o[key] !== null) {
        const found = walk(o[key]);
        if (found) return found;
      }
    }
    return undefined;
  };

  return walk(g3);
}

function extractAdvertorialSummary(g5: Record<string, unknown> | undefined): string | undefined {
  if (!g5) return undefined;
  // Pull the hook sentence + story arc summary
  const parts: string[] = [];
  const walk = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    const o = obj as Record<string, unknown>;
    if (typeof o.hook_sentence === 'string') parts.push(`Hook: ${o.hook_sentence}`);
    if (typeof o.archetype === 'string') parts.push(`Archetype: ${o.archetype}`);
    if (typeof o.emotional_arc === 'string') parts.push(`Arc: ${o.emotional_arc}`);
    for (const key of Object.keys(o)) {
      if (typeof o[key] === 'object' && o[key] !== null && !Array.isArray(o[key])) {
        walk(o[key]);
      }
    }
  };
  walk(g5);
  return parts.length > 0 ? parts.join(' | ') : undefined;
}

function extractSwipeFromRawSignal(
  avatarResult: Project['avatarRunResult'],
  subAvatar: SubAvatarV2 | undefined,
  project?: Project,
): CreativeContext['swipe'] {
  if (!avatarResult?.raw_signal) return undefined;
  const rs = avatarResult.raw_signal;

  // Pull forbidden words from Brand DNA customer_language + voice_profile
  const forbidden: string[] = [];
  const bd = project?.brandDNA;
  if (bd?.customer_language?.never_use?.length) {
    forbidden.push(...bd.customer_language.never_use);
  }
  if (bd?.voice_profile?.phrases_to_avoid?.length) {
    forbidden.push(...bd.voice_profile.phrases_to_avoid);
  }

  return {
    power_words: (rs.scored_phrases || [])
      .filter(p => p.score >= 60)
      .slice(0, 10)
      .map(p => p.phrase),
    forbidden_words: [...new Set(forbidden)],
    emotional_anchors: (rs.golden_sentences || [])
      .slice(0, 5)
      .map(g => g.sentence.slice(0, 120)),
    metaphors: (rs.identity_markers || [])
      .filter(m => m.type === 'aspiration')
      .slice(0, 5)
      .map(m => m.pattern),
    identity_phrases: (rs.identity_markers || [])
      .filter(m => m.type === 'self_identify')
      .slice(0, 5)
      .map(m => m.pattern),
    objection_language: (rs.buying_signals || [])
      .filter(b => b.type === 'price_sensitivity')
      .slice(0, 5)
      .map(b => b.pattern),
  };
}

function extractPerformance(project: Project): CreativeContext['performance'] {
  if (!project.adPerformance?.length) return undefined;
  const sorted = [...project.adPerformance].sort((a, b) =>
    (b.roas || 0) - (a.roas || 0),
  );
  const best = sorted[0];
  return {
    best_ctr: best?.ctr,
    best_cpa: best?.cpa,
    winning_angles: sorted
      .filter(p => (p.roas || 0) > 2)
      .map(p => p.notes || '')
      .filter(Boolean)
      .slice(0, 3),
  };
}

function extractCompetitorInsights(
  previousOutputs: Record<string, unknown>,
): CreativeContext['competitor_insights'] {
  // Competitor data may be stored in gate outputs or project
  const g1 = previousOutputs['gate1'] as Record<string, unknown> | undefined;
  if (!g1) return undefined;

  const walk = (obj: unknown): CreativeContext['competitor_insights'] => {
    if (!obj || typeof obj !== 'object') return undefined;
    const o = obj as Record<string, unknown>;
    if (Array.isArray(o.overused_angles) && Array.isArray(o.unexploited_gaps)) {
      return {
        overused_angles: (o.overused_angles as string[]).slice(0, 5),
        unexploited_gaps: (o.unexploited_gaps as string[]).slice(0, 5),
        anti_angles: (Array.isArray(o.anti_angles) ? o.anti_angles as string[] : []).slice(0, 5),
      };
    }
    for (const key of Object.keys(o)) {
      if (typeof o[key] === 'object' && o[key] !== null) {
        const found = walk(o[key]);
        if (found) return found;
      }
    }
    return undefined;
  };

  return walk(g1);
}

// -------- Prompt serializer --------

export function serializeCreativeContext(
  ctx: CreativeContext,
  copyFormat?: 'advertorial' | 'native' | 'listicle' | 'skipped',
): string {
  const sections: string[] = [];

  // DR principles (hard-coded, non-negotiable) — injected for EVERY creative
  // output regardless of copy format. Organic DR register is GLOBAL.
  sections.push(buildDRInjection(copyFormat, { includeCreativeRules: true, includeCopyRules: false }));


  // Sub-avatar
  sections.push(`=== TARGET SUB-AVATAR: "${ctx.sub_avatar.name}" (${ctx.sub_avatar.nickname}) ===
Category: ${ctx.sub_avatar.dominant_category} | Urgency: ${ctx.sub_avatar.urgency_score}/10
${ctx.sub_avatar.description}

Surface desire: ${ctx.sub_avatar.surface_desire}
Emotional triggers: ${ctx.sub_avatar.emotional_triggers.join(', ')}
Past failed attempts: ${ctx.sub_avatar.past_attempts.join(' | ')}
Demographics: ${ctx.sub_avatar.demographics.join(', ')}

THEIR EXACT WORDS (verbatims — use these in copy):
${ctx.sub_avatar.verbatim_quotes.map(q => `  • "${q}"`).join('\n')}

Positioning: ${ctx.sub_avatar.positioning_framework} — ${ctx.sub_avatar.positioning_description}
Story arc: Problem → ${ctx.sub_avatar.story_angle.problem} | Agitation → ${ctx.sub_avatar.story_angle.agitation} | Solution → ${ctx.sub_avatar.story_angle.solution}`);

  // Deep dive enrichments
  if (ctx.sub_avatar.hidden_fears?.length) {
    sections.push(`HIDDEN FEARS: ${ctx.sub_avatar.hidden_fears.join(' | ')}`);
  }
  if (ctx.sub_avatar.contradictions?.length) {
    sections.push(`CONTRADICTIONS: ${ctx.sub_avatar.contradictions.join(' | ')}`);
  }

  // Funnel
  sections.push(`=== FUNNEL POSITION: ${ctx.funnel.label} ===
${ctx.funnel.strategy}
CRITICAL: ALL copy, headlines, and visuals MUST match this awareness level. Do NOT use product-aware language for an unaware audience.`);

  // Brand
  sections.push(`=== BRAND DNA (LOCKED — must follow exactly) ===
Mechanism: ${ctx.brand.mechanism_name}
Root cause: ${ctx.brand.root_cause}
Belief error: ${ctx.brand.belief_error}
Steps: ${ctx.brand.mechanism_steps.map(s => `${s.step}. ${s.name}`).join(' → ')}
Guarantee: ${ctx.brand.guarantee}
Product descriptor: ${ctx.brand.product_descriptor}

Voice: ${ctx.brand.emotional_tone} | Formality: ${ctx.brand.formality}/10 | Style: ${ctx.brand.sentence_style}
USE these words: ${ctx.brand.phrases_to_use.join(', ')}
NEVER use: ${ctx.brand.phrases_to_avoid.join(', ')} | ${ctx.brand.never_use.join(', ')}
Visual metaphor: ${ctx.brand.visual_metaphor}
Colors: Problem=${ctx.brand.color_problem} | Solution=${ctx.brand.color_solution} | Brand=${ctx.brand.color_brand}
Emotional arc: ${ctx.brand.primary_emotion} → ${ctx.brand.secondary_emotion} → ${ctx.brand.resolution_emotion}`);

  // Product
  sections.push(`=== PRODUCT ===
${ctx.product.name}: ${ctx.product.description}
${ctx.product.price ? `Price: ${ctx.product.price} ${ctx.product.currency || ''}` : ''}
${ctx.product.features?.length ? `Features: ${ctx.product.features.join(' | ')}` : ''}
${ctx.product.benefits?.length ? `Benefits: ${ctx.product.benefits.join(' | ')}` : ''}
${ctx.product.avg_rating ? `Rating: ${ctx.product.avg_rating}/5 (${ctx.product.total_reviews} reviews)` : ''}`);

  // Swipe vocabulary
  if (ctx.swipe) {
    const sw: string[] = [];
    if (ctx.swipe.power_words.length) sw.push(`Power words: ${ctx.swipe.power_words.join(', ')}`);
    if (ctx.swipe.emotional_anchors.length) sw.push(`Emotional anchors:\n${ctx.swipe.emotional_anchors.map(a => `  • "${a}"`).join('\n')}`);
    if (ctx.swipe.identity_phrases.length) sw.push(`Identity phrases: ${ctx.swipe.identity_phrases.join(' | ')}`);
    if (ctx.swipe.objection_language.length) sw.push(`Objection language: ${ctx.swipe.objection_language.join(' | ')}`);
    if (sw.length) {
      sections.push(`=== SWIPE VOCABULARY ===\n${sw.join('\n')}`);
    }
  }

  // Root cause
  if (ctx.root_cause) {
    sections.push(`=== ROOT CAUSE (Gate 3) ===
${ctx.root_cause.one_sentence}
${ctx.root_cause.aha_moment ? `Aha moment: ${ctx.root_cause.aha_moment}` : ''}
${ctx.root_cause.false_belief ? `False belief: ${ctx.root_cause.false_belief}` : ''}
${ctx.root_cause.villain ? `Villain: ${ctx.root_cause.villain}` : ''}`);
  }

  // Top hooks
  if (ctx.top_hooks?.length) {
    sections.push(`=== TOP HOOKS (Gate 4 — scored by EVOLVE) ===
${ctx.top_hooks.slice(0, 10).map((h, i) => `  ${i + 1}. [${h.score}/30] "${h.hook}" (${h.formula} — ${h.reptilian_trigger})`).join('\n')}`);
  }

  // Ad concepts from Gate 6
  if (ctx.ad_concepts?.length) {
    sections.push(`=== AD CONCEPTS (Gate 6) ===
${ctx.ad_concepts.map(c => `  • ${c.name}: ${c.angle} | ${c.emotional_territory} | Visual: ${c.visual_direction}`).join('\n')}`);
  }

  // Headlines from Gate 6
  if (ctx.headlines?.length) {
    sections.push(`=== AVAILABLE HEADLINES (Gate 6 — pick or adapt) ===
${ctx.headlines.slice(0, 15).map((h, i) => `  ${i + 1}. "${h}"`).join('\n')}`);
  }

  // Performance
  if (ctx.performance) {
    const p = ctx.performance;
    sections.push(`=== PERFORMANCE DATA (real ads) ===
${p.best_ctr ? `Best CTR: ${p.best_ctr}%` : ''}
${p.best_cpa ? `Best CPA: $${p.best_cpa}` : ''}
${p.winning_angles?.length ? `Winning angles: ${p.winning_angles.join(' | ')}` : ''}`);
  }

  // Competitor
  if (ctx.competitor_insights) {
    sections.push(`=== COMPETITOR INTELLIGENCE ===
OVERUSED (avoid): ${ctx.competitor_insights.overused_angles.join(' | ')}
GAPS (exploit): ${ctx.competitor_insights.unexploited_gaps.join(' | ')}
ANTI-ANGLES: ${ctx.competitor_insights.anti_angles.join(' | ')}`);
  }

  return sections.join('\n\n');
}
