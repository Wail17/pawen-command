// ============================================================
// PAWEN — Video Ad Angle Miner
// Pulls hooks / body angles / CTAs / proof points / verbatims /
// character suggestions from every upstream gate (avatar excav.,
// deep dives, Brand DNA, Shopify data, Gate 4 scored hooks) so the
// video-ad studio can offer the user a real, grounded menu
// of creative choices instead of a blank textarea.
// ============================================================

import type { Project } from '../types';
import type { SubAvatarV2 } from '../avatars/types';

export type FunnelFit = 'TOF' | 'MOF' | 'BOF' | 'any';

export interface MinedHook {
  id: string;
  text: string;
  source: string;                         // "Gate 4 scored_hook #2"
  score: number;                          // 0-100
  sub_avatar_id?: string;
  angle_type?: string;                    // 'pattern-interrupt' | 'empathy' | 'curiosity' | 'fear' | 'aspiration'
}

export interface MinedBodyAngle {
  id: string;
  text: string;
  source: string;
  type: 'mechanism' | 'root_cause' | 'hidden_fear' | 'trigger' | 'contradiction' | 'identity' | 'objection';
  score: number;
}

export interface MinedCTA {
  id: string;
  text: string;
  source: string;
  funnel_fit: FunnelFit;
}

export interface MinedProofPoint {
  id: string;
  text: string;
  source: string;
  type: 'testimonial' | 'stat' | 'guarantee' | 'rating';
}

export interface MinedVerbatim {
  id: string;
  quote: string;
  emotion?: string;
  source_url?: string;
  score: number;
}

export interface MinedCharacterSuggestion {
  id: string;
  name: string;                           // "The Pillow That Can't Sleep"
  object_type: string;                    // "pillow"
  rationale: string;                      // why this object embodies the product
}

export interface MinedIdentity {
  id: string;
  text: string;
  source: string;
  type: 'self_identify' | 'anti_identify' | 'aspiration' | 'tribal';
}

export interface MinedAngles {
  hooks: MinedHook[];
  body_angles: MinedBodyAngle[];
  ctas: MinedCTA[];
  proof_points: MinedProofPoint[];
  verbatims: MinedVerbatim[];
  character_suggestions: MinedCharacterSuggestion[];
  identities: MinedIdentity[];
  mechanism_name?: string;                // from Brand DNA, always prefer this
  product_name?: string;
  voice_tone?: string;
  target_language?: string;
}

// === FUNNEL-STAGE DEFAULT CTAS ===
// Fallback options when Brand DNA arc is thin, keyed by funnel stage.
const DEFAULT_CTAS: Record<FunnelFit, string[]> = {
  TOF: [
    'Discover the {{mechanism}} →',
    'See why this works',
    'Read the full story',
    'Watch this before you buy anything else',
  ],
  MOF: [
    'Try {{product}} risk-free',
    'See the science behind it',
    'Get the protocol',
    'Compare it to what you\'re using now',
  ],
  BOF: [
    'Get yours today — 60-day guarantee',
    'Claim your spot before stock runs out',
    'Start today, feel it in 7 days',
    'Last chance — {{discount}} ends tonight',
  ],
  any: ['Learn more', 'Shop now', 'See how it works'],
};

function mkId(prefix: string, i: number) {
  return `${prefix}_${i}`;
}

function pickSubAvatar(project: Project, subAvatarId?: string): SubAvatarV2 | undefined {
  const all = project.avatarRunResult?.sub_avatars ?? [];
  if (!all.length) return undefined;
  const targetId = subAvatarId ?? project.selectedSubAvatarId;
  return all.find(s => s.id === targetId) ?? all[0];
}

// === HOOK MINING ===

function mineHooks(project: Project, sa?: SubAvatarV2): MinedHook[] {
  const out: MinedHook[] = [];
  let i = 0;

  // 1) SubAvatar scored_hooks (strongest — ranked by Gate 1 Phase 4.5)
  if (sa?.scored_hooks?.length) {
    for (const sh of sa.scored_hooks) {
      const avgScore = Math.round(
        ((sh.curiosity_score ?? 0) + (sh.intensity_score ?? 0) + (sh.relevance_score ?? 0)) * (100 / 30),
      );
      out.push({
        id: mkId('hook', i++),
        text: sh.hook,
        source: `Sub-avatar scored hook (${sa.nickname})`,
        score: avgScore,
        sub_avatar_id: sa.id,
        angle_type: 'curiosity',
      });
    }
  }

  // 2) SubAvatar base angles.hooks
  if (sa?.angles?.hooks?.length) {
    for (const h of sa.angles.hooks) {
      if (out.some(o => o.text === h)) continue;
      out.push({
        id: mkId('hook', i++),
        text: h,
        source: `Sub-avatar primary angle (${sa.nickname})`,
        score: 75,
        sub_avatar_id: sa.id,
      });
    }
  }

  // 3) SubAvatar additional_angles[*].hooks
  if (sa?.additional_angles?.length) {
    for (const ang of sa.additional_angles) {
      for (const h of ang.hooks ?? []) {
        if (out.some(o => o.text === h)) continue;
        out.push({
          id: mkId('hook', i++),
          text: h,
          source: `Sub-avatar ${ang.positioning?.framework ?? 'extra'} angle`,
          score: 70,
          sub_avatar_id: sa.id,
          angle_type: ang.positioning?.framework,
        });
      }
    }
  }

  // 4) Awareness variants — their `hook` fields are funnel-adapted
  if (sa?.awareness_variants?.length) {
    for (const av of sa.awareness_variants) {
      if (!av.hook) continue;
      if (out.some(o => o.text === av.hook)) continue;
      out.push({
        id: mkId('hook', i++),
        text: av.hook,
        source: `Awareness variant (${av.awareness_level})`,
        score: 68,
        sub_avatar_id: sa.id,
        angle_type: av.awareness_level,
      });
    }
  }

  // 5) Gate 4 output (if present) — scored_hooks from gate4 agent output
  const gate4 = (project as unknown as { gate4Output?: { output?: Record<string, unknown> } }).gate4Output;
  const g4Hooks =
    gate4?.output && typeof gate4.output === 'object'
      ? ((gate4.output as Record<string, unknown>).scored_hooks as
          | Array<{ hook?: string; score?: number; angle?: string }>
          | undefined)
      : undefined;
  if (Array.isArray(g4Hooks)) {
    for (const h of g4Hooks) {
      if (!h?.hook || out.some(o => o.text === h.hook)) continue;
      out.push({
        id: mkId('hook', i++),
        text: h.hook,
        source: 'Gate 4 scored hook',
        score: typeof h.score === 'number' ? h.score : 72,
        angle_type: h.angle,
      });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

// === BODY ANGLE MINING ===

function mineBodyAngles(project: Project, sa?: SubAvatarV2): MinedBodyAngle[] {
  const out: MinedBodyAngle[] = [];
  let i = 0;
  const brand = project.brandDNA;

  // 1) Brand DNA locked mechanism — the 3 steps (strongest body material)
  if (brand?.locked_terms?.mechanism_3_steps?.length) {
    for (const step of brand.locked_terms.mechanism_3_steps) {
      out.push({
        id: mkId('body', i++),
        text: `${step.name}: ${step.description}`,
        source: `Brand DNA mechanism step ${step.step}`,
        type: 'mechanism',
        score: 95,
      });
    }
  }

  // 2) Root cause (Brand DNA)
  if (brand?.locked_terms?.root_cause_one_sentence) {
    out.push({
      id: mkId('body', i++),
      text: brand.locked_terms.root_cause_one_sentence,
      source: 'Brand DNA root cause',
      type: 'root_cause',
      score: 92,
    });
  }

  // 3) Belief error (anti-narrative — super strong for TOF)
  if (brand?.locked_terms?.belief_error) {
    out.push({
      id: mkId('body', i++),
      text: `Belief to break: ${brand.locked_terms.belief_error}`,
      source: 'Brand DNA belief error',
      type: 'root_cause',
      score: 88,
    });
  }

  // 4) Deep dive hidden fears + contradictions + sharper triggers
  if (sa?.deep_dives?.length) {
    for (const dd of sa.deep_dives) {
      for (const f of dd.hidden_fears ?? []) {
        out.push({
          id: mkId('body', i++),
          text: f,
          source: `Deep dive "${dd.focus || 'hidden fears'}"`,
          type: 'hidden_fear',
          score: 85,
        });
      }
      for (const t of dd.sharper_triggers ?? []) {
        out.push({
          id: mkId('body', i++),
          text: t,
          source: `Deep dive "${dd.focus || 'triggers'}"`,
          type: 'trigger',
          score: 80,
        });
      }
      for (const c of dd.contradictions ?? []) {
        out.push({
          id: mkId('body', i++),
          text: c,
          source: `Deep dive "${dd.focus || 'contradictions'}"`,
          type: 'contradiction',
          score: 75,
        });
      }
      for (const o of dd.buying_objections ?? []) {
        out.push({
          id: mkId('body', i++),
          text: `Objection to handle: ${o}`,
          source: `Deep dive objections`,
          type: 'objection',
          score: 70,
        });
      }
    }
  }

  // 5) Sub-avatar emotional_triggers
  if (sa?.emotional_triggers?.length) {
    for (const t of sa.emotional_triggers) {
      if (out.some(o => o.text === t)) continue;
      out.push({
        id: mkId('body', i++),
        text: t,
        source: `Sub-avatar emotional trigger`,
        type: 'trigger',
        score: 72,
      });
    }
  }

  // 6) Identity from deep_dive identity_map
  if (sa?.deep_dives?.length) {
    for (const dd of sa.deep_dives) {
      if (dd.identity_map?.anti_identity) {
        out.push({
          id: mkId('body', i++),
          text: `Identity to reject: ${dd.identity_map.anti_identity}`,
          source: 'Deep dive identity map',
          type: 'identity',
          score: 78,
        });
      }
      if (dd.identity_map?.aspiration) {
        out.push({
          id: mkId('body', i++),
          text: `Identity to aspire to: ${dd.identity_map.aspiration}`,
          source: 'Deep dive identity map',
          type: 'identity',
          score: 78,
        });
      }
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

// === CTA MINING ===

function mineCTAs(project: Project, funnel: FunnelFit = 'any'): MinedCTA[] {
  const out: MinedCTA[] = [];
  let i = 0;
  const brand = project.brandDNA;

  // 1) Brand DNA emotional_arc resolution — if it hints at resolution emotion, craft CTA around it
  if (brand?.emotional_arc?.resolution_emotion) {
    const emo = brand.emotional_arc.resolution_emotion;
    out.push({
      id: mkId('cta', i++),
      text: `Feel ${emo} — try ${brand.product_name} today`,
      source: 'Brand DNA emotional arc (resolution)',
      funnel_fit: 'BOF',
    });
  }

  // 2) Brand DNA guarantee
  if (brand?.locked_terms?.guarantee_wording) {
    out.push({
      id: mkId('cta', i++),
      text: brand.locked_terms.guarantee_wording,
      source: 'Brand DNA guarantee',
      funnel_fit: 'BOF',
    });
  }

  // 3) Mechanism-name CTA (great for MOF)
  if (brand?.locked_terms?.mechanism_name) {
    out.push({
      id: mkId('cta', i++),
      text: `Discover the ${brand.locked_terms.mechanism_name}`,
      source: 'Brand DNA mechanism CTA',
      funnel_fit: 'TOF',
    });
  }

  // 4) Sub-avatar angles.story_angle.cta
  const sa = pickSubAvatar(project);
  if (sa?.angles?.story_angle?.cta) {
    out.push({
      id: mkId('cta', i++),
      text: sa.angles.story_angle.cta,
      source: 'Sub-avatar story angle CTA',
      funnel_fit: 'any',
    });
  }

  // 5) Defaults for the selected funnel stage
  const defaults = DEFAULT_CTAS[funnel] ?? DEFAULT_CTAS.any;
  for (const t of defaults) {
    const interpolated = t
      .replace('{{mechanism}}', brand?.locked_terms?.mechanism_name || 'new method')
      .replace('{{product}}', brand?.product_name || 'it')
      .replace('{{discount}}', '20% off');
    if (out.some(o => o.text === interpolated)) continue;
    out.push({
      id: mkId('cta', i++),
      text: interpolated,
      source: `Default ${funnel} CTA`,
      funnel_fit: funnel,
    });
  }

  return out;
}

// === PROOF POINTS ===

function mineProofPoints(project: Project): MinedProofPoint[] {
  const out: MinedProofPoint[] = [];
  let i = 0;
  const brand = project.brandDNA;

  // 1) Brand DNA key proof points
  for (const p of brand?.locked_terms?.key_proof_points ?? []) {
    out.push({
      id: mkId('proof', i++),
      text: p,
      source: 'Brand DNA key proof points',
      type: 'stat',
    });
  }

  // 2) Brand DNA proof_inventory testimonials (from Shopify)
  for (const t of brand?.proof_inventory?.testimonials ?? []) {
    out.push({
      id: mkId('proof', i++),
      text: `"${t.text}" — ${t.author}${t.rating ? ` (${t.rating}★)` : ''}`,
      source: 'Shopify review',
      type: 'testimonial',
    });
  }

  // 3) Average rating
  if (brand?.proof_inventory?.average_rating && brand.proof_inventory.total_reviews) {
    out.push({
      id: mkId('proof', i++),
      text: `${brand.proof_inventory.average_rating}★ average across ${brand.proof_inventory.total_reviews} reviews`,
      source: 'Shopify aggregate rating',
      type: 'rating',
    });
  }

  // 4) Guarantee
  if (brand?.locked_terms?.guarantee_wording) {
    out.push({
      id: mkId('proof', i++),
      text: brand.locked_terms.guarantee_wording,
      source: 'Brand DNA guarantee',
      type: 'guarantee',
    });
  }

  return out;
}

// === VERBATIMS ===

function mineVerbatims(sa?: SubAvatarV2): MinedVerbatim[] {
  const out: MinedVerbatim[] = [];
  let i = 0;
  if (!sa) return out;

  for (const v of sa.verbatim_quotes ?? []) {
    out.push({
      id: mkId('verb', i++),
      quote: v.quote,
      emotion: v.emotion_tag,
      source_url: v.source_url,
      score: v.quote.length > 40 && v.quote.length < 200 ? 80 : 60,
    });
  }

  // Deep dive new_verbatims (usually better — more targeted)
  for (const dd of sa.deep_dives ?? []) {
    for (const v of dd.new_verbatims ?? []) {
      out.push({
        id: mkId('verb', i++),
        quote: v.quote,
        emotion: v.emotion_tag,
        source_url: v.source_url,
        score: 85,
      });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

// === CHARACTER SUGGESTIONS ===
// The "animated object" should EMBODY the product. Suggest 3-5 candidate
// characters grounded in the product format + Brand DNA metaphor.

function mineCharacterSuggestions(project: Project): MinedCharacterSuggestion[] {
  const out: MinedCharacterSuggestion[] = [];
  let i = 0;
  const brand = project.brandDNA;
  const productName = brand?.product_name || project.name;
  const descriptor = brand?.locked_terms?.product_descriptor || project.productDescription;
  const productFormat = brand?.product_specs?.product_format;
  const metaphor = brand?.visual_identity?.metaphor;

  // 1) Product itself personified
  if (productFormat || descriptor) {
    out.push({
      id: mkId('char', i++),
      name: `The ${productName}`,
      object_type: productFormat || descriptor || 'product',
      rationale: 'The product itself becomes the hero — direct embodiment.',
    });
  }

  // 2) Metaphor character (if Brand DNA has one)
  if (metaphor) {
    out.push({
      id: mkId('char', i++),
      name: `The ${metaphor}`,
      object_type: metaphor,
      rationale: 'Brand DNA visual metaphor — stays on-brand while being iconic.',
    });
  }

  // 3) Problem-object (the thing causing the pain — villain arc)
  const sa = pickSubAvatar(project);
  const topTrigger = sa?.emotional_triggers?.[0];
  if (topTrigger) {
    out.push({
      id: mkId('char', i++),
      name: `The Problem Object`,
      object_type: 'problem-personified',
      rationale: `Animate the pain itself — works with trigger "${topTrigger.slice(0, 60)}"`,
    });
  }

  // 4) Companion — product + helper (buddy-movie feel)
  if (productFormat) {
    out.push({
      id: mkId('char', i++),
      name: `The ${productName} + Sidekick`,
      object_type: `${productFormat} with companion`,
      rationale: 'Two-character dynamic. Great for mechanism explainer scenes.',
    });
  }

  return out;
}

// === IDENTITY MARKERS ===

function mineIdentities(sa?: SubAvatarV2): MinedIdentity[] {
  const out: MinedIdentity[] = [];
  let i = 0;
  if (!sa) return out;

  for (const s of sa.angles?.positioning ? [] : []) {
    out.push(s); // placeholder
  }

  for (const s of sa.deep_dives ?? []) {
    if (s.identity_map?.self_image) {
      out.push({
        id: mkId('ident', i++),
        text: s.identity_map.self_image,
        source: 'Deep dive self-image',
        type: 'self_identify',
      });
    }
    if (s.identity_map?.anti_identity) {
      out.push({
        id: mkId('ident', i++),
        text: s.identity_map.anti_identity,
        source: 'Deep dive anti-identity',
        type: 'anti_identify',
      });
    }
    if (s.identity_map?.aspiration) {
      out.push({
        id: mkId('ident', i++),
        text: s.identity_map.aspiration,
        source: 'Deep dive aspiration',
        type: 'aspiration',
      });
    }
    for (const tm of s.identity_map?.tribal_markers ?? []) {
      out.push({
        id: mkId('ident', i++),
        text: tm,
        source: 'Deep dive tribal markers',
        type: 'tribal',
      });
    }
  }

  return out;
}

// === MAIN MINER ===

export function mineAngles(project: Project, subAvatarId?: string, funnel: FunnelFit = 'any'): MinedAngles {
  const sa = pickSubAvatar(project, subAvatarId);

  return {
    hooks: mineHooks(project, sa),
    body_angles: mineBodyAngles(project, sa),
    ctas: mineCTAs(project, funnel),
    proof_points: mineProofPoints(project),
    verbatims: mineVerbatims(sa),
    character_suggestions: mineCharacterSuggestions(project),
    identities: mineIdentities(sa),
    mechanism_name: project.brandDNA?.locked_terms?.mechanism_name,
    product_name: project.brandDNA?.product_name || project.name,
    voice_tone: project.brandDNA?.voice_profile?.emotional_tone,
    target_language: project.targetLanguage,
  };
}

// === FACTORY MODE PICKER ===
// Picks the top item per category automatically. The video-ads page
// uses this when the user hits "Factory" instead of "Architect".

export interface FactoryPick {
  hook?: MinedHook;
  body_angle?: MinedBodyAngle;
  cta?: MinedCTA;
  proof_point?: MinedProofPoint;
  character?: MinedCharacterSuggestion;
  verbatim?: MinedVerbatim;
}

export function pickFactoryDefaults(angles: MinedAngles, funnel: FunnelFit): FactoryPick {
  const ctaForStage =
    angles.ctas.find(c => c.funnel_fit === funnel) ??
    angles.ctas.find(c => c.funnel_fit === 'any') ??
    angles.ctas[0];

  return {
    hook: angles.hooks[0],
    body_angle: angles.body_angles[0],
    cta: ctaForStage,
    proof_point: angles.proof_points[0],
    character: angles.character_suggestions[0],
    verbatim: angles.verbatims[0],
  };
}
