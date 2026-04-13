// ============================================================
// PAWEN — Reverse Enrichment client module
//
// Thin wrapper around POST /api/avatars/enrich-reverse. Takes the
// AvatarRunResult produced by convertReverseEngineeredToAvatarRunResult
// (or by localizeReverseEngineered) and the original ReverseEngineeredFunnel,
// runs a single Opus enrichment pass, and merges the structured result
// onto the sub-avatar — without touching base fields.
//
// Non-destructive: if the API call fails, the base sub-avatar is left
// untouched and the error is surfaced to the caller.
// ============================================================

import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';
import type {
  AvatarRunResult,
  CoreAvatarInput,
  SubAvatarV2,
} from './types';

export interface ReverseEnrichmentResponse {
  additional_angles: SubAvatarV2['additional_angles'];
  structured_past_attempts: SubAvatarV2['structured_past_attempts'];
  sensory_triggers: SubAvatarV2['sensory_triggers'];
  scored_hooks: SubAvatarV2['scored_hooks'];
  buying_behavior?: SubAvatarV2['buying_behavior'];
  localized_demographics?: SubAvatarV2['localized_demographics'];
  narrator_persona?: string;
  bridge_moment?: string;
  tokens_used: number;
  generated_at: string;
}

async function fetchEnrichment(
  reverse: ReverseEngineeredFunnel,
  core: CoreAvatarInput,
  subAvatar: SubAvatarV2,
  targetLanguage: string,
  targetMarket: string,
): Promise<ReverseEnrichmentResponse> {
  const res = await fetch('/api/avatars/enrich-reverse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reverse,
      core,
      subAvatar,
      targetLanguage,
      targetMarket,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Enrich-reverse API failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data?.ok || !data?.enrichment) {
    throw new Error(data?.message || 'Enrich-reverse API returned no enrichment');
  }
  return data.enrichment as ReverseEnrichmentResponse;
}

// Merge the enrichment into a sub-avatar without overwriting base fields.
// The base `angles` (new_mechanism) stays as angle #1. `additional_angles`
// stacks on top. Past attempts, sensory triggers, scored hooks, buying
// behavior, localized demographics, narrator persona and bridge moment
// are all injected fresh since they didn't exist on the base sub-avatar.
export function mergeEnrichmentIntoSubAvatar(
  base: SubAvatarV2,
  enrichment: ReverseEnrichmentResponse,
  reverse: ReverseEngineeredFunnel,
): SubAvatarV2 {
  return {
    ...base,
    is_from_reverse_engineer: true,
    reverse_source_brand: reverse.competitor_brand,
    reverse_source_url: reverse.competitor_url,
    additional_angles: enrichment.additional_angles,
    structured_past_attempts: enrichment.structured_past_attempts,
    sensory_triggers: enrichment.sensory_triggers,
    scored_hooks: enrichment.scored_hooks,
    buying_behavior: enrichment.buying_behavior,
    localized_demographics: enrichment.localized_demographics,
    narrator_persona: enrichment.narrator_persona,
    bridge_moment: enrichment.bridge_moment,
  };
}

// One-shot helper: takes an already-built AvatarRunResult (from either
// convertReverseEngineeredToAvatarRunResult or localizeReverseEngineered),
// enriches the first sub-avatar, and returns a new AvatarRunResult with
// the enriched sub-avatar swapped in.
export async function enrichReverseEngineeredRun(
  runResult: AvatarRunResult,
  reverse: ReverseEngineeredFunnel,
  core: CoreAvatarInput,
  targetLanguage: string,
  targetMarket: string,
): Promise<AvatarRunResult> {
  const baseSubAvatar = runResult.sub_avatars[0];
  if (!baseSubAvatar) {
    throw new Error('enrichReverseEngineeredRun: no sub-avatar to enrich');
  }

  const enrichment = await fetchEnrichment(
    reverse,
    core,
    baseSubAvatar,
    targetLanguage,
    targetMarket,
  );

  const enrichedSubAvatar = mergeEnrichmentIntoSubAvatar(
    baseSubAvatar,
    enrichment,
    reverse,
  );

  return {
    ...runResult,
    sub_avatars: [enrichedSubAvatar, ...runResult.sub_avatars.slice(1)],
  };
}
