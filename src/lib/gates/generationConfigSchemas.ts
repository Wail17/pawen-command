// ============================================================
// Per-gate generation config schemas.
// Drives the UI (Gate Generation Config panel) AND the cost
// estimator. Keep baselineCost/costPerUnit grounded in observed
// runs — these are what users see in the panel before they
// trigger generation.
// ============================================================

import type { GateId } from '../types';

export interface ConfigKnob {
  key: string;              // maps into Project.gateConfigs[gateId][key]
  label: string;
  hint: string;
  min: number;
  max: number;
  default: number;
  costPerUnit: number;      // incremental USD per +1 above default baseline
}

export interface GateGenerationSchema {
  gateId: GateId;
  baselineCost: number;     // cost when ALL knobs at default (or no knobs)
  knobs: ConfigKnob[];
}

// Pricing references (Opus $5/$25, Sonnet $3/$15 per M tokens).
// Baselines derived from observed runs in production logs.
// costPerUnit chosen conservative — rounds up so users aren't surprised.

export const GATE_GENERATION_SCHEMAS: Record<GateId, GateGenerationSchema> = {
  gate1: {
    gateId: 'gate1',
    baselineCost: 3.5, // heavy: Tavily + Firecrawl + Apify + multiple Claude passes
    knobs: [
      { key: 'subAvatarCount', label: 'Sub-avatars to produce', hint: 'Distinct reader segments extracted from VOC research. More = more angles but longer/costlier.', min: 2, max: 6, default: 4, costPerUnit: 0.25 },
      { key: 'verbatimsPerAvatar', label: 'Verbatims per sub-avatar', hint: 'Quoted customer phrases captured into each sub-avatar. Drives Gate 2-5 raw material.', min: 5, max: 25, default: 12, costPerUnit: 0.02 },
    ],
  },
  gate2: {
    gateId: 'gate2',
    baselineCost: 0.8,
    knobs: [
      { key: 'painPointCount', label: 'Pain points extracted', hint: 'Surfaced pains per sub-avatar (fear / frustration / desire). More = richer Gate 4 hook material.', min: 5, max: 20, default: 10, costPerUnit: 0.02 },
      { key: 'deepDivePasses', label: 'Deep dive passes', hint: 'How many iterative passes Opus runs to excavate hidden fears/identity/contradictions. 1 = fast, 3 = thorough.', min: 1, max: 3, default: 1, costPerUnit: 0.35 },
    ],
  },
  gate3: {
    gateId: 'gate3',
    baselineCost: 0.35,
    knobs: [
      { key: 'mechanismCandidates', label: 'Mechanism candidates', hint: 'How many unique root-cause / mechanism angles to draft before picking. More = more differentiation options.', min: 1, max: 5, default: 2, costPerUnit: 0.08 },
    ],
  },
  gate4: {
    gateId: 'gate4',
    baselineCost: 1.2, // highest-cost gate historically (hook arsenal loops cost $5 on a bad day)
    knobs: [
      { key: 'hookCount', label: 'Hooks', hint: 'Total scroll-stopper hooks across all angles. Default 35 = tient en 1 pass sans truncate. + pour en ajouter (au-delà de 50, risque de couper les sections suivantes).', min: 20, max: 120, default: 35, costPerUnit: 0.015 },
      { key: 'headlineCount', label: 'Headlines', hint: 'Short A/B headline variants for image overlays and carousel top-cards.', min: 10, max: 50, default: 15, costPerUnit: 0.006 },
      { key: 'bodyCopyCount', label: 'Body copies', hint: 'Short-form primary text (100-200 words) per angle. Drives Meta Ads testing.', min: 5, max: 30, default: 8, costPerUnit: 0.025 },
    ],
  },
  gate5: {
    gateId: 'gate5',
    baselineCost: 0.40,
    knobs: [
      { key: 'hookCount', label: 'Opening hooks', hint: 'Distinct opening-line variants. More = more scroll-stoppers to A/B test.', min: 1, max: 10, default: 3, costPerUnit: 0.001 },
      { key: 'bodyVariantCount', label: 'Body variants', hint: 'Full 300-600 word bodies. Each uses a different narrator/mechanism. Expensive.', min: 1, max: 5, default: 1, costPerUnit: 0.042 },
      { key: 'imageBeatCount', label: 'Image beats', hint: 'Creative briefs for the designer/Gate 7. More = more visual concepts.', min: 2, max: 10, default: 4, costPerUnit: 0.004 },
      { key: 'closeVariantCount', label: 'Soft close variants', hint: 'Alternate endings (redirect / door-open / permission).', min: 1, max: 5, default: 2, costPerUnit: 0.0015 },
    ],
  },
  gate6: {
    gateId: 'gate6',
    baselineCost: 0.80,
    knobs: [
      { key: 'adScriptCount', label: 'Ad scripts (UGC)', hint: 'Full UGC scripts (hook + body + CTA, ~45s read). Different angles per script.', min: 1, max: 10, default: 3, costPerUnit: 0.06 },
      { key: 'primaryTextCount', label: 'Primary-text variants', hint: 'Meta Ads primary-text (100-200 words). Each paired with 1+ headlines/descriptions.', min: 3, max: 20, default: 8, costPerUnit: 0.018 },
      { key: 'ctaVariantCount', label: 'CTA variants', hint: 'Short call-to-action lines. Low cost — stack freely.', min: 2, max: 15, default: 5, costPerUnit: 0.002 },
    ],
  },
  gate7: {
    gateId: 'gate7',
    baselineCost: 1.20,
    knobs: [
      { key: 'briefsPerPreset', label: 'Briefs per preset', hint: 'Distinct creative briefs per preset category (8 presets exist). Total briefs = this × active presets.', min: 1, max: 5, default: 3, costPerUnit: 0.08 },
      { key: 'headlinesPerBrief', label: 'Headlines per brief', hint: 'A/B/C headline options on each brief. Always scored by the headline optimizer.', min: 2, max: 5, default: 3, costPerUnit: 0.005 },
    ],
  },
  gate8: {
    gateId: 'gate8',
    baselineCost: 0.10, // Claude costs only — fal.ai image costs not included
    knobs: [
      { key: 'imagesPerBrief', label: 'Images per brief', hint: 'fal.ai renders per brief (feed/story/vertical formats multiply this). Each image ≈ $0.05 on fal.ai (NOT shown in Opus cost).', min: 1, max: 5, default: 1, costPerUnit: 0.0 },
      { key: 'regenerationRounds', label: 'Regen rounds', hint: 'Automatic re-renders if the first pass fails quality check. 0 = no retry.', min: 0, max: 3, default: 1, costPerUnit: 0.05 },
    ],
  },
  gate9: {
    gateId: 'gate9',
    baselineCost: 0.55,
    knobs: [
      { key: 'campaignVariants', label: 'Campaign blueprints', hint: 'Distinct TOF/MOF/BOF campaign structures. More = more launch strategy options.', min: 1, max: 5, default: 2, costPerUnit: 0.15 },
      { key: 'adsetCount', label: 'Adsets per campaign', hint: 'Audience × creative combinations planned per campaign blueprint.', min: 3, max: 15, default: 6, costPerUnit: 0.01 },
    ],
  },
  'brand-dna': {
    gateId: 'brand-dna',
    baselineCost: 0.45,
    knobs: [],
  },
};

export function estimateGateCost(
  gateId: GateId,
  values: Record<string, number | undefined> | undefined
): { total: number; baseline: number; knobsCost: number } {
  const schema = GATE_GENERATION_SCHEMAS[gateId];
  if (!schema) return { total: 0, baseline: 0, knobsCost: 0 };
  let knobsCost = 0;
  for (const knob of schema.knobs) {
    const v = values?.[knob.key];
    const actual = typeof v === 'number' && !isNaN(v) ? v : knob.default;
    const delta = Math.max(0, actual - knob.default);
    knobsCost += delta * knob.costPerUnit;
  }
  return {
    total: schema.baselineCost + knobsCost,
    baseline: schema.baselineCost,
    knobsCost,
  };
}
