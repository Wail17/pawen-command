// ============================================================
// PAWEN — Localize a Reverse-Engineered Avatar to a New Market
//
// When a user reverse-engineers a US brand's funnel and wants to run it in
// Italy (or France, DACH, whatever), the mechanism / fears / desires are
// usually 90% transferable — but the VERBATIMS, cultural anchors, and
// emotional language need to be re-mined in the target market.
//
// This module does a targeted mini-excavation:
//   1. Translates the reverse-engineered pain points + mechanism into
//      target-language search queries
//   2. Hits Tavily (searchWide) scoped to the target market
//   3. Scrapes the top results
//   4. Sends everything to Claude Sonnet via /api/avatars/localize for a
//      single-shot verbatim extract (API route so the key stays server-side)
//   5. Merges the localized signals into the SubAvatarV2 built by
//      fromReverseEngineered — keeping angles/mechanism/description intact
//      but replacing verbatim_quotes, emotional_triggers, swipe vocabulary.
//
// Faster than a full runAvatarExcavation (no multi-source orchestration,
// no gap-fill wave, no cross-source validation) — typically 2-5 min vs 30+.
// ============================================================

import type { ReverseEngineeredFunnel } from '@/lib/competitor/types';
import type {
  AvatarRunResult,
  CoreAvatarInput,
  SubAvatarV2,
  VerbatimQuote,
} from './types';
import { webSearch, scrapeMany, languageModifier } from '@/lib/sources/common';
import { convertReverseEngineeredToAvatarRunResult } from './fromReverseEngineered';

export interface LocalizationProgress {
  phase: 'queries' | 'search' | 'scrape' | 'extract' | 'done';
  message: string;
  pct: number;
}

export interface LocalizedVerbatimBundle {
  verbatim_quotes: string[];
  emotional_triggers: string[];
  identity_statements: string[];
  localized_fears: string[];
  localized_desires: string[];
  cultural_anchors: string[];
  notes: string;
}

// Build 6-8 targeted search queries in the target language using the
// reverse-engineered pain points and mechanism as seeds. Literal templates,
// no LLM call — keeps localization fast and cheap.
function buildLocalizationQueries(
  reverse: ReverseEngineeredFunnel,
  targetLanguage: string,
  targetMarket: string,
): string[] {
  const pains = (reverse.sub_avatar.pain_points || []).slice(0, 4);
  const desires = (reverse.sub_avatar.desires || []).slice(0, 2);
  const mech = reverse.mechanism.name || '';

  const langMod = languageModifier(targetLanguage);
  const marketTag = targetMarket ? ` ${targetMarket}` : '';

  const seeds: string[] = [];
  for (const pain of pains) {
    seeds.push(`${pain} forum${marketTag}`);
    seeds.push(`"${pain}" reddit OR forum${marketTag}`);
  }
  for (const desire of desires) {
    seeds.push(`${desire} témoignage OR review${marketTag}`);
  }
  if (mech) seeds.push(`${mech} avis OR testimonial${marketTag}`);

  return seeds
    .map(s => `${s} ${langMod}`.trim())
    .slice(0, 8);
}

// Thin wrapper over /api/avatars/localize — the actual Claude call happens
// server-side so the ANTHROPIC_API_KEY never leaves the edge.
async function extractLocalizedVerbatims(
  reverse: ReverseEngineeredFunnel,
  scrapedContent: string,
  targetLanguage: string,
  targetMarket: string,
): Promise<LocalizedVerbatimBundle> {
  const res = await fetch('/api/avatars/localize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reverse,
      scrapedContent,
      targetLanguage,
      targetMarket,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Localize API failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data?.ok || !data?.bundle) {
    throw new Error(data?.message || 'Localize API returned no bundle');
  }
  return data.bundle as LocalizedVerbatimBundle;
}

function mergeLocalizedIntoSubAvatar(
  base: SubAvatarV2,
  bundle: LocalizedVerbatimBundle,
  targetMarket: string,
  competitorUrl: string,
): SubAvatarV2 {
  const localizedVerbatims: VerbatimQuote[] = bundle.verbatim_quotes.map(quote => ({
    quote,
    source_url: competitorUrl || 'localization://target-market-research',
    source_type: 'searchWide',
    context: `Localized to ${targetMarket}`,
  }));

  return {
    ...base,
    verbatim_quotes: localizedVerbatims,
    emotional_triggers: [
      ...bundle.emotional_triggers,
      ...(base.emotional_triggers || []).slice(0, 3),
    ],
    past_attempts_failures: [
      ...bundle.localized_fears.slice(0, 4),
      ...base.past_attempts_failures.slice(0, 4),
    ],
    implicit_demographics: [
      ...base.implicit_demographics,
      ...(bundle.cultural_anchors.length
        ? [`Cultural anchors (${targetMarket}): ${bundle.cultural_anchors.join(', ')}`]
        : []),
      ...(bundle.notes ? [`Localization notes: ${bundle.notes}`] : []),
    ],
    recommendation_reason:
      `${base.recommendation_reason} Re-localized to ${targetMarket} with ${bundle.verbatim_quotes.length} native verbatims.`,
  };
}

export async function localizeReverseEngineered(
  reverse: ReverseEngineeredFunnel,
  core: CoreAvatarInput,
  targetLanguage: string,
  targetMarket: string,
  onProgress?: (p: LocalizationProgress) => void,
): Promise<AvatarRunResult> {
  const startedAt = Date.now();
  const report = (phase: LocalizationProgress['phase'], message: string, pct: number) => {
    onProgress?.({ phase, message, pct });
  };

  const baseResult = convertReverseEngineeredToAvatarRunResult(reverse, core, startedAt);
  const baseSubAvatar = baseResult.sub_avatars[0];
  if (!baseSubAvatar) throw new Error('Reverse conversion produced no sub-avatar');

  report('queries', `Building ${targetLanguage} search queries...`, 10);
  const queries = buildLocalizationQueries(reverse, targetLanguage, targetMarket);

  report('search', `Searching ${targetMarket} web...`, 25);
  const searchResults = await Promise.all(queries.map(q => webSearch(q, { maxResults: 8 })));
  const urlSet = new Set<string>();
  const snippets: string[] = [];
  for (const sr of searchResults) {
    if (!sr) continue;
    if (sr.answer) snippets.push(sr.answer);
    for (const r of sr.results) {
      if (/reddit\.com|amazon\.|youtube\.com|tiktok\.com/.test(r.url)) continue;
      urlSet.add(r.url);
      snippets.push(`[${r.title}] ${r.content}`);
    }
  }
  const uniqueUrls = Array.from(urlSet).slice(0, 12);

  report('scrape', `Scraping ${uniqueUrls.length} ${targetMarket} pages...`, 50);
  const scraped = await scrapeMany(uniqueUrls, 4);
  const scrapedContent = [
    snippets.join('\n---\n'),
    ...scraped.map(p => `=== ${p.url} ===\n${p.markdown.slice(0, 8000)}`),
  ].join('\n\n');

  report('extract', 'Extracting localized verbatims with Claude...', 80);
  const bundle = await extractLocalizedVerbatims(
    reverse,
    scrapedContent,
    targetLanguage,
    targetMarket,
  );

  const localizedSubAvatar = mergeLocalizedIntoSubAvatar(
    baseSubAvatar,
    bundle,
    targetMarket,
    reverse.competitor_url || '',
  );

  const now = Date.now();
  report('done', `Localization complete — ${bundle.verbatim_quotes.length} native verbatims`, 100);

  return {
    ...baseResult,
    sub_avatars: [localizedSubAvatar],
    comparative_table: [
      {
        sub_avatar_id: localizedSubAvatar.id,
        nickname: localizedSubAvatar.nickname,
        tam: localizedSubAvatar.tam_estimate,
        urgency: localizedSubAvatar.urgency_score,
        scope: localizedSubAvatar.scope_score,
        staying_power: localizedSubAvatar.staying_power_score,
        recommended: true,
      },
    ],
    metadata: {
      ...baseResult.metadata,
      run_duration_ms: now - startedAt,
      total_verbatims: bundle.verbatim_quotes.length,
      total_items_scraped: scraped.length,
      phase_timings: {
        discovery_ms: 0,
        fetch_ms: 0,
        analyze_ms: now - startedAt,
        compile_ms: 0,
      },
    },
  };
}
