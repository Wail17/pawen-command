// ============================================================
// PAWEN — Client-side enrichment helpers
// Thin wrappers over /api/avatars/awareness and /api/avatars/deep-dive.
// These are called from Gate1's result view when the user clicks
// an awareness-level chip or the "Approfondis encore +" button.
//
// Design rules:
//   - Non-destructive: callers receive the new variant/dive and decide
//     where to append it. This file never mutates a sub-avatar in place.
//   - Fire a real fetch — credentials: same-origin so the session cookie
//     travels with the request.
//   - Errors bubble up so the UI can show a toast; nothing is logged here.
// ============================================================

import type {
  CoreAvatarInput,
  SubAvatarV2,
  AwarenessLevel,
  AwarenessVariant,
  DeepDiveResult,
  MarketSophistication,
} from './types';

export interface AwarenessClassification {
  recommended_awareness_level: AwarenessLevel;
  recommended_awareness_reason: string;
  market_sophistication: MarketSophistication;
}

export async function generateAwarenessVariant(params: {
  core: CoreAvatarInput;
  subAvatar: SubAvatarV2;
  awarenessLevel: AwarenessLevel;
}): Promise<AwarenessVariant> {
  const res = await fetch('/api/avatars/awareness', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    variant?: AwarenessVariant;
    message?: string;
  };

  if (!res.ok || !data.ok || !data.variant) {
    throw new Error(data.message ?? `Awareness call failed (${res.status})`);
  }
  return data.variant;
}

export async function generateDeepDive(params: {
  core: CoreAvatarInput;
  subAvatar: SubAvatarV2;
  focus?: string | null;
  priorDives?: DeepDiveResult[];
}): Promise<DeepDiveResult> {
  const res = await fetch('/api/avatars/deep-dive', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    dive?: DeepDiveResult;
    message?: string;
  };

  if (!res.ok || !data.ok || !data.dive) {
    throw new Error(data.message ?? `Deep-dive call failed (${res.status})`);
  }
  return data.dive;
}

// ------------------------------------------------------------
// Helpers that apply an enrichment onto a sub-avatar without
// destroying the existing data. Callers use these to produce a
// new AvatarRunResult before saving back to IndexedDB.
// ------------------------------------------------------------

export function appendAwarenessVariant(
  subAvatar: SubAvatarV2,
  variant: AwarenessVariant,
): SubAvatarV2 {
  return {
    ...subAvatar,
    awareness_variants: [...(subAvatar.awareness_variants ?? []), variant],
  };
}

export function appendDeepDive(
  subAvatar: SubAvatarV2,
  dive: DeepDiveResult,
): SubAvatarV2 {
  return {
    ...subAvatar,
    deep_dives: [...(subAvatar.deep_dives ?? []), dive],
  };
}

// Backfill the awareness + sophistication classification onto an OLD
// sub-avatar that was generated before these fields existed. Caller
// passes the result of generateAwarenessClassification(); we return
// a new sub-avatar with the three fields populated.
export function applyAwarenessClassification(
  subAvatar: SubAvatarV2,
  classification: AwarenessClassification,
): SubAvatarV2 {
  return {
    ...subAvatar,
    recommended_awareness_level: classification.recommended_awareness_level,
    recommended_awareness_reason: classification.recommended_awareness_reason,
    market_sophistication: classification.market_sophistication,
  };
}

export async function generateAwarenessClassification(params: {
  core: CoreAvatarInput;
  subAvatar: SubAvatarV2;
}): Promise<AwarenessClassification> {
  const res = await fetch('/api/avatars/classify', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    classification?: AwarenessClassification;
    message?: string;
  };

  if (!res.ok || !data.ok || !data.classification) {
    throw new Error(data.message ?? `Classify call failed (${res.status})`);
  }
  return data.classification;
}

// Pretty label for the awareness chip UI
export const AWARENESS_LABEL: Record<AwarenessLevel, string> = {
  unaware: 'Unaware',
  problem_aware: 'Problem aware',
  solution_aware: 'Solution aware',
  product_aware: 'Product aware',
  most_aware: 'Most aware',
};

// Short description that shows in the tooltip / empty state
export const AWARENESS_DESCRIPTION: Record<AwarenessLevel, string> = {
  unaware: "Doesn't know they have a problem yet — surface it.",
  problem_aware: 'Feels the pain, no solution in mind — agitate.',
  solution_aware: 'Researching options — position your category.',
  product_aware: 'Weighing your product — remove friction.',
  most_aware: 'Ready to buy — close with offer.',
};
