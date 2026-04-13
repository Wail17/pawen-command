// ============================================================
// PAWEN — Reverse-Engineered → AvatarRunResult conversion
//
// When the user pastes a competitor URL into the Reverse Engineer tool,
// we get back a ReverseEngineeredFunnel whose `sub_avatar` block is shaped
// differently from our canonical SubAvatarV2 (flat strings instead of
// structured quotes, no scoring, no positioning framework). This helper
// inflates the competitor output into a real SubAvatarV2 so Gate 1 can
// treat it exactly like a freshly-excavated one — meaning Gates 2-9 pick
// it up through the usual `project.avatarRunResult.sub_avatars[]` path
// without any downstream changes.
//
// Nothing here calls an LLM. It's a pure shape transform.
// ============================================================

import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';
import type {
  AvatarRunResult,
  AvatarRunMetadata,
  CoreAvatarInput,
  SubAvatarV2,
  VerbatimQuote,
  SourceType,
  AwarenessLevel,
} from './types';

// Map the loose competitor awareness_level string back into our strict enum.
// The LLM tends to produce "problem aware", "Problem-Aware", "SOLUTION_AWARE", etc.
function normalizeAwarenessLevel(raw: string | undefined): AwarenessLevel | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase().replace(/[-\s]+/g, '_');
  if (s.includes('unaware') || s.includes('full_unaware')) return 'unaware';
  if (s.includes('problem')) return 'problem_aware';
  if (s.includes('solution')) return 'solution_aware';
  if (s.includes('product')) return 'product_aware';
  if (s.includes('most')) return 'most_aware';
  return undefined;
}

// Wrap a flat verbatim string into the VerbatimQuote shape used everywhere
// downstream. Competitor scraping doesn't give us the original source URL
// of each individual quote — those got compressed through the LLM pass — so
// we tag them with the competitor URL as a best-effort reference.
function inflateVerbatim(quote: string, competitorUrl: string): VerbatimQuote {
  return {
    quote,
    source_url: competitorUrl,
    source_type: 'searchWide' as SourceType,
    context: 'reverse-engineered from competitor ad copy',
  };
}

export function convertReverseEngineeredToAvatarRunResult(
  reverse: ReverseEngineeredFunnel,
  core: CoreAvatarInput,
  startedAt: number,
): AvatarRunResult {
  const now = Date.now();
  const competitorUrl = reverse.competitor_url || '';
  const awarenessLevel = normalizeAwarenessLevel(reverse.sub_avatar.awareness_level);

  // Build a real SubAvatarV2 from the flat competitor shape. Missing bits
  // (TAM, urgency scores, nuanced past-attempts) get sensible placeholders —
  // the user can always re-run the full excavation later if they want richer
  // scoring. The point here is that downstream gates stop being starved.
  const verbatim_quotes: VerbatimQuote[] = (reverse.sub_avatar.verbatim_quotes || [])
    .filter(q => typeof q === 'string' && q.trim().length > 0)
    .map(q => inflateVerbatim(q, competitorUrl));

  // Pain points double as "past attempts / failures" proxy when the
  // competitor pitch is mostly solving an existing frustration.
  const past_attempts_failures = [
    ...(reverse.sub_avatar.pain_points || []),
    ...(reverse.sub_avatar.fears || []),
  ].slice(0, 8);

  const subAvatar: SubAvatarV2 = {
    id: 'sa-reverse-1',
    name: reverse.sub_avatar.name || `${reverse.competitor_brand} target avatar`,
    nickname: reverse.sub_avatar.nickname || 'competitor-target',
    dominant_category: 'emotion',
    surface_desire: core.surface_desire || reverse.sub_avatar.desires?.[0] || '',
    description: reverse.sub_avatar.description || reverse.sub_avatar.psychographics || '',
    tam_estimate: 'Reverse-engineered — not sized (re-run excavation for TAM)',
    // Neutral-high defaults — competitor is already actively targeting this
    // avatar profitably, so we assume non-trivial urgency/scope/staying-power.
    urgency_score: 7,
    scope_score: 7,
    staying_power_score: 7,
    verbatim_quotes,
    emotional_triggers: reverse.sub_avatar.trigger_moments || [],
    past_attempts_failures,
    implicit_demographics: [
      reverse.sub_avatar.demographics,
      reverse.sub_avatar.psychographics,
    ].filter((s): s is string => typeof s === 'string' && s.length > 0),
    angles: {
      positioning: {
        framework: 'new_mechanism',
        description: reverse.mechanism.description || reverse.mechanism.name || '',
        rationale: `Reverse-engineered from ${reverse.competitor_brand}. Belief error: ${reverse.mechanism.belief_error || 'not extracted'}.`,
      },
      hooks: (reverse.copy_arsenal?.hooks || []).map(h => h.text).filter(Boolean).slice(0, 5),
      story_angle: {
        problem: reverse.sub_avatar.pain_points?.[0] || '',
        agitation: reverse.sub_avatar.fears?.[0] || '',
        solution: reverse.mechanism.name || '',
        mechanism: reverse.mechanism.description || '',
        cta: reverse.copy_arsenal?.cta_strategy || '',
      },
    },
    source_references: ['searchWide'],
    source_urls: [competitorUrl].filter(Boolean),
    launch_order: 1,
    recommended_for_test: true,
    recommendation_reason: `Extracted from ${reverse.competitor_brand}'s live funnel — it's already converting for them, so it's a known-good starting avatar.`,
    recommended_awareness_level: awarenessLevel,
  };

  const metadata: AvatarRunMetadata = {
    sources_used: ['searchWide'],
    total_verbatims: verbatim_quotes.length,
    total_items_scraped: 1,
    run_duration_ms: now - startedAt,
    cost_estimate_usd: 0,
    phase_timings: {
      discovery_ms: 0,
      fetch_ms: 0,
      analyze_ms: 0,
      compile_ms: now - startedAt,
    },
  };

  return {
    core_avatar: core,
    discovery_plan: {
      reddit: { subreddits: [], queries: [] },
      amazon: { product_queries: [], marketplace: '' },
      youtube: { video_queries: [] },
      tiktok: { hashtags: [], search_queries: [] },
      quora: { queries: [] },
      forums: { domains: [], queries: [] },
      reviews: { sites: [], queries: [] },
      searchWide: { queries: [competitorUrl].filter(Boolean) },
      shopify: { store_urls: [competitorUrl].filter(Boolean), product_queries: [] },
      instagram: { hashtags: [], search_queries: [] },
      facebook: { page_urls: [], search_queries: [] },
    },
    sub_avatars: [subAvatar],
    comparative_table: [
      {
        sub_avatar_id: subAvatar.id,
        nickname: subAvatar.nickname,
        tam: subAvatar.tam_estimate,
        urgency: subAvatar.urgency_score,
        scope: subAvatar.scope_score,
        staying_power: subAvatar.staying_power_score,
        recommended: true,
      },
    ],
    final_recommendation: {
      first_to_test: subAvatar.id,
      reason: subAvatar.recommendation_reason,
      strategy: `Lift and localize: ${reverse.competitor_brand}'s converting angle → translate to ${core.market || 'target market'} voice without copy-paste.`,
    },
    metadata,
  };
}
