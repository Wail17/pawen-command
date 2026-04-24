// ============================================================
// PAWEN — Video Ad Congruence Checker
// Validates that the user's A-Z choices stay consistent:
// sub-avatar ↔ hook ↔ body angle ↔ Brand DNA voice / mechanism ↔
// funnel stage ↔ CTA ↔ language. Runs BEFORE hitting Claude so
// we catch mismatches early and can offer auto-fixes.
// ============================================================

import type { Project } from '../types';
import type { MinedHook, MinedBodyAngle, MinedCTA, MinedCharacterSuggestion } from './angleMiner';

export type CongruenceSeverity = 'critical' | 'warning' | 'info';

export interface CongruenceIssue {
  severity: CongruenceSeverity;
  field: string;
  message: string;
  suggestion?: string;
}

export interface CongruenceReport {
  score: number;                           // 0-100
  issues: CongruenceIssue[];
  ok: boolean;                             // no criticals
}

export interface CongruenceInput {
  project: Project;
  subAvatarId?: string;
  funnel: 'TOF' | 'MOF' | 'BOF';
  hook?: MinedHook | { text: string };
  bodyAngle?: MinedBodyAngle | { text: string };
  cta?: MinedCTA | { text: string };
  character?: MinedCharacterSuggestion | { name: string; object_type: string };
  customHookText?: string;
}

// === HELPERS ===

function countOverlap(a: string, b: string): number {
  const ta = new Set(
    a.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3),
  );
  const tb = new Set(
    b.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3),
  );
  let n = 0;
  for (const w of ta) if (tb.has(w)) n++;
  return n;
}

// Rough language detection via accents / stopwords.
function guessLanguage(text: string): string {
  const t = text.toLowerCase();
  if (/\b(le|la|les|de|des|et|est|une?|pour|avec|vous|je|tu)\b/.test(t)) return 'fr';
  if (/\b(el|la|los|las|de|y|es|un|una|para|con|usted|yo|tú)\b/.test(t)) return 'es';
  if (/\b(der|die|das|und|ist|ein|eine|für|mit|sie|ich|du)\b/.test(t)) return 'de';
  if (/\b(il|la|lo|di|e|è|un|una|per|con|lei|io|tu)\b/.test(t)) return 'it';
  if (/\b(the|and|is|a|an|for|with|you|i|of|to)\b/.test(t)) return 'en';
  return 'unknown';
}

// === CHECKS ===

export function checkCongruence(input: CongruenceInput): CongruenceReport {
  const issues: CongruenceIssue[] = [];
  const { project, subAvatarId, funnel, hook, bodyAngle, cta, character, customHookText } = input;

  const sa = project.avatarRunResult?.sub_avatars?.find(
    s => s.id === (subAvatarId ?? project.selectedSubAvatarId),
  );
  const brand = project.brandDNA;
  const targetLangCode = (project.targetLanguage || 'en').split('-')[0].toLowerCase();

  // 1) Sub-avatar must exist
  if (!sa) {
    issues.push({
      severity: 'critical',
      field: 'sub_avatar',
      message: 'No sub-avatar selected. Run Gate 1 first or pick one from the dropdown.',
    });
  }

  // 2) Brand DNA must be locked (otherwise mechanism + voice are generic)
  if (!brand) {
    issues.push({
      severity: 'warning',
      field: 'brand_dna',
      message: 'Brand DNA not set — video will use generic voice. Lock Brand DNA first for best results.',
    });
  } else if (!brand.locked) {
    issues.push({
      severity: 'warning',
      field: 'brand_dna.locked',
      message: 'Brand DNA is not locked. Mechanism name and proof points may drift.',
    });
  }

  // 3) Hook must exist
  const hookText = customHookText || hook?.text;
  if (!hookText || hookText.trim().length < 8) {
    issues.push({
      severity: 'critical',
      field: 'hook',
      message: 'Hook is empty or too short (min 8 chars).',
    });
  }

  // 4) Hook language matches project target language
  if (hookText && targetLangCode !== 'unknown') {
    const lang = guessLanguage(hookText);
    if (lang !== 'unknown' && lang !== targetLangCode) {
      issues.push({
        severity: 'warning',
        field: 'hook.language',
        message: `Hook appears to be in "${lang}" but project target is "${targetLangCode}".`,
        suggestion: 'Translate the hook or update the project target language.',
      });
    }
  }

  // 5) Hook references sub-avatar pain / triggers? (soft check)
  if (hookText && sa) {
    const triggers = (sa.emotional_triggers ?? []).join(' ');
    const quotes = (sa.verbatim_quotes ?? []).slice(0, 6).map(q => q.quote).join(' ');
    const combined = `${triggers} ${quotes}`;
    if (combined.length > 30) {
      const overlap = countOverlap(hookText, combined);
      if (overlap === 0) {
        issues.push({
          severity: 'info',
          field: 'hook.relevance',
          message: `Hook doesn't share any vocabulary with sub-avatar "${sa.nickname}" triggers/verbatims. Consider grounding it in their actual language.`,
        });
      }
    }
  }

  // 6) Body angle references Brand DNA mechanism?
  const bodyText = bodyAngle?.text;
  if (bodyText && brand?.locked_terms?.mechanism_name) {
    const mech = brand.locked_terms.mechanism_name.toLowerCase();
    const isMechBody = (bodyAngle as MinedBodyAngle | undefined)?.type === 'mechanism';
    if (isMechBody && !bodyText.toLowerCase().includes(mech.split(' ')[0])) {
      issues.push({
        severity: 'info',
        field: 'body_angle.mechanism',
        message: `Body angle is tagged "mechanism" but doesn't mention "${brand.locked_terms.mechanism_name}".`,
      });
    }
  }

  // 7) CTA fits the funnel stage
  if (cta && 'funnel_fit' in cta && cta.funnel_fit && cta.funnel_fit !== 'any' && cta.funnel_fit !== funnel) {
    issues.push({
      severity: 'warning',
      field: 'cta.funnel',
      message: `CTA is tuned for ${cta.funnel_fit} but you're generating a ${funnel} ad.`,
      suggestion: `Pick a ${funnel} CTA for stage-appropriate intensity.`,
    });
  }

  // 8) Funnel stage vs sub-avatar recommended awareness level
  if (sa?.recommended_awareness_level) {
    const lvl = sa.recommended_awareness_level;
    const tofLvls = ['unaware', 'problem_aware'];
    const mofLvls = ['solution_aware', 'product_aware'];
    const bofLvls = ['product_aware', 'most_aware'];
    const bucket = funnel === 'TOF' ? tofLvls : funnel === 'MOF' ? mofLvls : bofLvls;
    if (!bucket.includes(lvl)) {
      issues.push({
        severity: 'info',
        field: 'funnel_stage',
        message: `Sub-avatar's recommended awareness level is "${lvl}" which is a poor fit for ${funnel}. Consider switching stage or sub-avatar.`,
      });
    }
  }

  // 9) Character grounded in product?
  if (character && brand?.product_specs?.product_format) {
    const fmt = brand.product_specs.product_format.toLowerCase();
    const objT = ('object_type' in character ? character.object_type : '').toLowerCase();
    if (objT && !objT.includes(fmt.split(' ')[0]) && objT !== 'problem-personified' && !objT.includes('companion')) {
      issues.push({
        severity: 'info',
        field: 'character',
        message: `Character object "${objT}" doesn't match product format "${fmt}". That's fine if intentional (metaphor).`,
      });
    }
  }

  // 10) Guarantee in BOF
  if (funnel === 'BOF' && !brand?.locked_terms?.guarantee_wording) {
    issues.push({
      severity: 'info',
      field: 'bof.guarantee',
      message: 'BOF ads convert harder with a guarantee. Brand DNA has no guarantee_wording set.',
    });
  }

  // === SCORE ===
  const criticalPenalty = issues.filter(i => i.severity === 'critical').length * 40;
  const warningPenalty = issues.filter(i => i.severity === 'warning').length * 12;
  const infoPenalty = issues.filter(i => i.severity === 'info').length * 4;
  const score = Math.max(0, 100 - criticalPenalty - warningPenalty - infoPenalty);

  return {
    score,
    issues,
    ok: !issues.some(i => i.severity === 'critical'),
  };
}

// === SERIALIZE GUARDRAILS FOR CLAUDE ===
// Inject a short block into the system prompt so the LLM ALSO enforces
// congruence when drafting scenes (not just our pre-check).

export function serializeCongruenceGuardrails(input: CongruenceInput): string {
  const { project, subAvatarId, funnel, hook, bodyAngle, cta, character, customHookText } = input;
  const sa = project.avatarRunResult?.sub_avatars?.find(
    s => s.id === (subAvatarId ?? project.selectedSubAvatarId),
  );
  const brand = project.brandDNA;

  const parts: string[] = [];
  parts.push('=== CONGRUENCE GUARDRAILS (enforce in EVERY scene) ===');
  parts.push(`- Target language: ${project.targetLanguage} — dialogue MUST be in this language verbatim.`);
  parts.push(`- Target market: ${project.targetMarket} — cultural references must fit this market.`);
  parts.push(`- Funnel stage: ${funnel} — adapt awareness level, CTA intensity, and claim boldness.`);
  if (sa) {
    parts.push(`- Sub-avatar locked: "${sa.nickname}" (${sa.dominant_category}) — EVERY scene speaks to THIS persona.`);
    if (sa.emotional_triggers?.length) {
      parts.push(`  - Emotional triggers to hit: ${sa.emotional_triggers.slice(0, 3).join(' | ')}`);
    }
  }
  if (brand?.locked_terms?.mechanism_name) {
    parts.push(`- Mechanism name (USE EXACT): "${brand.locked_terms.mechanism_name}"`);
  }
  if (brand?.voice_profile?.emotional_tone) {
    parts.push(`- Voice tone: ${brand.voice_profile.emotional_tone}`);
  }
  if (brand?.customer_language?.always_use?.length) {
    parts.push(`- Always use: ${brand.customer_language.always_use.slice(0, 5).join(' | ')}`);
  }
  if (brand?.customer_language?.never_use?.length) {
    parts.push(`- NEVER use: ${brand.customer_language.never_use.slice(0, 5).join(' | ')}`);
  }
  const hookText = customHookText || hook?.text;
  if (hookText) parts.push(`- Locked hook: "${hookText}" — Scene 1 MUST open on this hook.`);
  if (bodyAngle?.text) parts.push(`- Locked body angle: "${bodyAngle.text.slice(0, 180)}" — middle scenes develop this.`);
  if (cta?.text) parts.push(`- Locked CTA: "${cta.text}" — final scene ends on this exact CTA.`);
  if (character && 'name' in character) {
    parts.push(`- Locked character: "${character.name}" (${character.object_type}) — appears in EVERY scene.`);
  }
  parts.push('- If any locked element clashes with the scene goal, DO NOT override it — bend the scene around the lock.');

  return parts.join('\n');
}
