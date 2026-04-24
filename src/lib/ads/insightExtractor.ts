// ============================================================
// PAWEN — Ad Insights Extractor
// Turns raw CSV rows into structured learnings the agents can act on:
//   - Winners / Losers (with confidence)
//   - Hook-type patterns that convert
//   - Format winners (UGC, advertorial, static, video)
//   - Angle clusters
//   - Awareness / funnel performance
//   - Concrete fix-this rules
// All deterministic — no LLM round-trip needed.
// ============================================================

import type { AdRow } from './csvParser';

// =====================================================================
// AGGREGATED AD ROLLUP — one entry per ad_name across the date range
// =====================================================================

export interface AdRollup {
  name: string;
  campaign: string;
  adset: string;
  funnel: AdRow['funnel_stage'];
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  cpm: number;
  cpc: number;
  cpa: number;
  roas: number;
  frequency: number;
  daysActive: number;
  // Extracted creative signals
  hookType: HookType;
  formatType: FormatType;
  angle: AngleCluster;
  awareness: AwarenessLevel;
  // Verdict
  verdict: 'winner' | 'loser' | 'mid' | 'unscored';
  verdictReason: string;
}

export type HookType =
  | 'question'
  | 'stat_number'
  | 'social_proof'
  | 'before_after'
  | 'curiosity_gap'
  | 'fear_warning'
  | 'authority_expert'
  | 'how_to'
  | 'urgency_scarcity'
  | 'mechanism_secret'
  | 'unknown';

export type FormatType =
  | 'ugc'
  | 'advertorial'
  | 'native_listicle'
  | 'static_graphic'
  | 'video_short'
  | 'video_long'
  | 'carousel'
  | 'unboxing'
  | 'testimonial'
  | 'unknown';

export type AngleCluster =
  | 'transformation'
  | 'mechanism'
  | 'comparison'
  | 'proof'
  | 'identity'
  | 'pain_agitation'
  | 'aspiration'
  | 'us_vs_them'
  | 'unknown';

export type AwarenessLevel =
  | 'unaware'
  | 'problem'
  | 'solution'
  | 'product'
  | 'most'
  | 'retargeting'
  | 'unknown';

// Ad-name pattern dictionaries. Names like
//   "TOF_UGC_Q-hook_transformation_v3" or
//   "BOF | Advertorial | StatHook | mechanism"
// get parsed deterministically. Falls back to 'unknown' when nothing matches.
const HOOK_PATTERNS: Array<[HookType, RegExp]> = [
  ['question', /\b(q[-_]?hook|question|why|how|what|did[-_ ]you|saviez)\b/i],
  ['stat_number', /\b(stat|number|\d+\s?%|\d{2,}\s?(people|women|men|x|times)|nombre)\b/i],
  ['social_proof', /\b(testi?monial|review|ugc[-_ ]?proof|customer|client|avis|rating|étoiles?)\b/i],
  ['before_after', /\b(before[-_ ]?after|b[-_]?a|avant[-_ ]?apr[èe]s|transformation)\b/i],
  ['curiosity_gap', /\b(secret|unknown|hidden|nobody[-_ ]tells|trick|hack|mystery|cach[ée])\b/i],
  ['fear_warning', /\b(warning|danger|stop|avoid|mistake|never|attention|risk|risque|peur)\b/i],
  ['authority_expert', /\b(doctor|dr[-_ .]|expert|md|phd|scientist|m[ée]decin|professeur)\b/i],
  ['how_to', /\b(how[-_ ]?to|comment|tutorial|guide|step)\b/i],
  ['urgency_scarcity', /\b(now|today|last[-_ ]chance|limited|sale|maintenant|aujourdhui|derni[èe]r|dernière)\b/i],
  ['mechanism_secret', /\b(mechanism|method|formula|protocol|breakthrough|m[ée]thode|protocole)\b/i],
];

const FORMAT_PATTERNS: Array<[FormatType, RegExp]> = [
  ['ugc', /\b(ugc|talking[-_ ]?head|selfie|raw|phone|cam[-_ ]?vert|tt[-_ ]?style|tiktok)\b/i],
  ['advertorial', /\b(advertorial|article|editorial|publi[-_ ]?reportage|press|news|blog)\b/i],
  ['native_listicle', /\b(listicle|list|top[-_ ]?\d|\d[-_ ]?reasons|n°?\d|num[ée]ro)\b/i],
  ['static_graphic', /\b(static|graphic|design|infographic|image[-_ ]?only|gfx)\b/i],
  ['video_short', /\b(short|reel|6s|15s|30s|stories?|stry|hooky)\b/i],
  ['video_long', /\b(vsl|long[-_ ]?form|2min|3min|5min|webinar|long)\b/i],
  ['carousel', /\b(carousel|carrousel|swipe|slides|slideshow)\b/i],
  ['unboxing', /\b(unbox|unboxing|opening|reveal)\b/i],
  ['testimonial', /\b(testi?monial|review|customer[-_ ]?story|case[-_ ]?study|t[ée]moignage)\b/i],
];

const ANGLE_PATTERNS: Array<[AngleCluster, RegExp]> = [
  ['transformation', /\b(transformation|before[-_ ]?after|results?|r[ée]sultat|change)\b/i],
  ['mechanism', /\b(mechanism|method|how[-_ ]it[-_ ]works|science|formula|m[ée]thode|protocole|principe)\b/i],
  ['comparison', /\b(vs|versus|compar|contre|alternative|better[-_ ]than|mieux[-_ ]que)\b/i],
  ['proof', /\b(proof|study|research|clinical|backed|prouv[ée]|[ée]tude|recherche)\b/i],
  ['identity', /\b(identity|for[-_ ]women|for[-_ ]men|moms|dads|busy|over[-_ ]?\d{2}|si[-_ ]vous|pour[-_ ]les)\b/i],
  ['pain_agitation', /\b(pain|tired|exhausted|frustrated|stuck|fatigue?|fatigu[ée]|frustr[ée])\b/i],
  ['aspiration', /\b(dream|finally|freedom|confidence|enfin|libert[ée]|confiance)\b/i],
  ['us_vs_them', /\b(industry|big[-_ ]pharma|companies|hide|industrie|cach[ée]nt)\b/i],
];

const AWARENESS_PATTERNS: Array<[AwarenessLevel, RegExp]> = [
  ['unaware', /\b(unaware|cold|broad|prospect|froid|inconnu)\b/i],
  ['problem', /\b(problem[-_ ]?aware|pain|symptom|sympt[ôo]me|probl[èe]me)\b/i],
  ['solution', /\b(solution[-_ ]?aware|category|alternative|cat[ée]gorie)\b/i],
  ['product', /\b(product[-_ ]?aware|brand|differentiat|marque|diff[ée]rence)\b/i],
  ['most', /\b(most[-_ ]?aware|offer|discount|bof|promo)\b/i],
  ['retargeting', /\b(retarget|remarket|warm|atc|view[-_ ]?content|rt|rmk)\b/i],
];

function classify<T>(text: string, patterns: Array<[T, RegExp]>, fallback: T): T {
  for (const [tag, re] of patterns) {
    if (re.test(text)) return tag;
  }
  return fallback;
}

function awarenessFromFunnel(funnel: AdRow['funnel_stage'] | undefined): AwarenessLevel {
  if (funnel === 'tof') return 'unaware';
  if (funnel === 'mof') return 'solution';
  if (funnel === 'bof') return 'product';
  if (funnel === 'retarget') return 'retargeting';
  return 'unknown';
}

// =====================================================================
// ROLLUP — one row per ad
// =====================================================================

export function rollupAds(rows: AdRow[]): AdRollup[] {
  const byAd = new Map<string, AdRow[]>();
  for (const r of rows) {
    const key = r.ad_name || r.adset_name || r.campaign_name;
    if (!key) continue;
    const arr = byAd.get(key) ?? [];
    arr.push(r);
    byAd.set(key, arr);
  }

  const rollups: AdRollup[] = [];
  for (const [name, adRows] of byAd) {
    const spend = adRows.reduce((s, r) => s + r.spend, 0);
    const impressions = adRows.reduce((s, r) => s + r.impressions, 0);
    const reach = adRows.reduce((s, r) => s + r.reach, 0);
    const clicks = adRows.reduce((s, r) => s + r.clicks, 0);
    const conversions = adRows.reduce((s, r) => s + r.conversions, 0);
    const conversion_value = adRows.reduce((s, r) => s + r.conversion_value, 0);
    const dates = new Set(adRows.map(r => r.date).filter(Boolean));

    const haystack = [name, adRows[0].adset_name, adRows[0].campaign_name].join(' ');
    const detectedAwareness = classify(haystack, AWARENESS_PATTERNS, 'unknown');
    const awareness = detectedAwareness === 'unknown'
      ? awarenessFromFunnel(adRows[0].funnel_stage)
      : detectedAwareness;

    rollups.push({
      name,
      campaign: adRows[0].campaign_name,
      adset: adRows[0].adset_name,
      funnel: adRows[0].funnel_stage,
      spend,
      impressions,
      reach,
      clicks,
      conversions,
      conversion_value,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpa: conversions > 0 ? spend / conversions : Infinity,
      roas: spend > 0 ? conversion_value / spend : 0,
      frequency: reach > 0 ? impressions / reach : 0,
      daysActive: dates.size,
      hookType: classify(haystack, HOOK_PATTERNS, 'unknown'),
      formatType: classify(haystack, FORMAT_PATTERNS, 'unknown'),
      angle: classify(haystack, ANGLE_PATTERNS, 'unknown'),
      awareness,
      verdict: 'unscored',
      verdictReason: '',
    });
  }

  return rollups;
}

// =====================================================================
// VERDICT — winner / loser based on percentile + spend gate
// =====================================================================

const MIN_SPEND_FOR_VERDICT = 20;        // need at least $20 to score
const MIN_IMPRESSIONS_FOR_VERDICT = 1000;

export function scoreVerdicts(rollups: AdRollup[]): AdRollup[] {
  const scorable = rollups.filter(r => r.spend >= MIN_SPEND_FOR_VERDICT && r.impressions >= MIN_IMPRESSIONS_FOR_VERDICT);
  if (scorable.length < 3) {
    // Not enough data — single-ad shortcuts
    return rollups.map(r => {
      if (r.spend < MIN_SPEND_FOR_VERDICT) {
        return { ...r, verdict: 'unscored', verdictReason: 'insufficient spend' };
      }
      if (r.roas >= 2 && r.conversions >= 1) {
        return { ...r, verdict: 'winner', verdictReason: `ROAS ${r.roas.toFixed(2)}x with conversions` };
      }
      if (r.spend >= 50 && r.conversions === 0) {
        return { ...r, verdict: 'loser', verdictReason: `$${r.spend.toFixed(0)} spent, 0 conversions` };
      }
      return { ...r, verdict: 'mid', verdictReason: '' };
    });
  }

  // Percentile-based: top quartile by ROAS = winners, bottom quartile by ROAS = losers
  const byRoas = [...scorable].sort((a, b) => b.roas - a.roas);
  const topQuartileCutoff = byRoas[Math.floor(byRoas.length * 0.25)]?.roas ?? 0;
  const bottomQuartileCutoff = byRoas[Math.floor(byRoas.length * 0.75)]?.roas ?? 0;
  const accountAvgRoas = scorable.reduce((s, r) => s + r.roas, 0) / scorable.length;

  return rollups.map(r => {
    if (r.spend < MIN_SPEND_FOR_VERDICT || r.impressions < MIN_IMPRESSIONS_FOR_VERDICT) {
      return { ...r, verdict: 'unscored', verdictReason: 'insufficient spend or impressions' };
    }
    if (r.roas >= topQuartileCutoff && r.roas >= 1 && r.conversions >= 1) {
      return {
        ...r,
        verdict: 'winner',
        verdictReason: `Top 25% — ROAS ${r.roas.toFixed(2)}x vs account avg ${accountAvgRoas.toFixed(2)}x`,
      };
    }
    if (r.roas <= bottomQuartileCutoff || (r.spend >= 50 && r.conversions === 0)) {
      return {
        ...r,
        verdict: 'loser',
        verdictReason: r.conversions === 0
          ? `$${r.spend.toFixed(0)} spent, 0 conversions`
          : `Bottom 25% — ROAS ${r.roas.toFixed(2)}x vs account avg ${accountAvgRoas.toFixed(2)}x`,
      };
    }
    return { ...r, verdict: 'mid', verdictReason: 'middle of the pack' };
  });
}

// =====================================================================
// CREATIVE INSIGHTS — what patterns actually win/lose
// =====================================================================

export interface PatternInsight<K extends string> {
  key: K;
  label: string;
  spend: number;
  conversions: number;
  roas: number;
  ctr: number;
  cpa: number;
  adCount: number;
  winnerCount: number;
  loserCount: number;
  winRate: number; // winners / (winners + losers)
  confidence: 'high' | 'medium' | 'low';
}

function aggregateBy<K extends string>(
  rollups: AdRollup[],
  pick: (r: AdRollup) => K,
  labeler: (k: K) => string,
): PatternInsight<K>[] {
  const groups = new Map<K, AdRollup[]>();
  for (const r of rollups) {
    const k = pick(r);
    const arr = groups.get(k) ?? [];
    arr.push(r);
    groups.set(k, arr);
  }

  const out: PatternInsight<K>[] = [];
  for (const [k, group] of groups) {
    if (k === ('unknown' as K)) continue; // skip unclassified bucket
    const spend = group.reduce((s, r) => s + r.spend, 0);
    const conversions = group.reduce((s, r) => s + r.conversions, 0);
    const conversion_value = group.reduce((s, r) => s + r.conversion_value, 0);
    const impressions = group.reduce((s, r) => s + r.impressions, 0);
    const clicks = group.reduce((s, r) => s + r.clicks, 0);
    const winners = group.filter(r => r.verdict === 'winner').length;
    const losers = group.filter(r => r.verdict === 'loser').length;
    const totalScored = winners + losers;
    const winRate = totalScored > 0 ? winners / totalScored : 0;

    let confidence: PatternInsight<K>['confidence'] = 'low';
    if (group.length >= 5 && spend >= 200) confidence = 'high';
    else if (group.length >= 3 && spend >= 50) confidence = 'medium';

    out.push({
      key: k,
      label: labeler(k),
      spend,
      conversions,
      roas: spend > 0 ? conversion_value / spend : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpa: conversions > 0 ? spend / conversions : Infinity,
      adCount: group.length,
      winnerCount: winners,
      loserCount: losers,
      winRate,
      confidence,
    });
  }

  return out.sort((a, b) => b.roas - a.roas);
}

const HOOK_LABELS: Record<HookType, string> = {
  question: 'Question hook',
  stat_number: 'Stat / number hook',
  social_proof: 'Social proof hook',
  before_after: 'Before/After hook',
  curiosity_gap: 'Curiosity gap hook',
  fear_warning: 'Fear / warning hook',
  authority_expert: 'Authority / expert hook',
  how_to: 'How-to hook',
  urgency_scarcity: 'Urgency / scarcity hook',
  mechanism_secret: 'Mechanism / secret hook',
  unknown: 'Unclassified',
};

const FORMAT_LABELS: Record<FormatType, string> = {
  ugc: 'UGC',
  advertorial: 'Advertorial',
  native_listicle: 'Listicle',
  static_graphic: 'Static graphic',
  video_short: 'Short video',
  video_long: 'Long video / VSL',
  carousel: 'Carousel',
  unboxing: 'Unboxing',
  testimonial: 'Testimonial',
  unknown: 'Unclassified',
};

const ANGLE_LABELS: Record<AngleCluster, string> = {
  transformation: 'Transformation',
  mechanism: 'Mechanism',
  comparison: 'Comparison / vs',
  proof: 'Proof / studies',
  identity: 'Identity-led',
  pain_agitation: 'Pain agitation',
  aspiration: 'Aspiration',
  us_vs_them: 'Us vs Them',
  unknown: 'Unclassified',
};

const AWARENESS_LABELS: Record<AwarenessLevel, string> = {
  unaware: 'Unaware (cold)',
  problem: 'Problem aware',
  solution: 'Solution aware',
  product: 'Product aware',
  most: 'Most aware (offer)',
  retargeting: 'Retargeting',
  unknown: 'Unknown',
};

export interface AdInsightReport {
  rollups: AdRollup[];
  totals: {
    spend: number;
    conversions: number;
    impressions: number;
    clicks: number;
    revenue: number;
    roas: number;
    ctr: number;
    cpa: number;
    adCount: number;
    winnerCount: number;
    loserCount: number;
  };
  hookInsights: PatternInsight<HookType>[];
  formatInsights: PatternInsight<FormatType>[];
  angleInsights: PatternInsight<AngleCluster>[];
  awarenessInsights: PatternInsight<AwarenessLevel>[];
  topWinners: AdRollup[];
  topLosers: AdRollup[];
  // Concrete agent-facing rules generated from the patterns
  rules: AdLearningRule[];
}

export interface AdLearningRule {
  type: 'do_more' | 'avoid' | 'fix';
  scope: 'hook' | 'format' | 'angle' | 'awareness' | 'creative';
  message: string;
  evidence: string;
  priority: 'high' | 'medium' | 'low';
}

function generateRules(report: Omit<AdInsightReport, 'rules'>): AdLearningRule[] {
  const rules: AdLearningRule[] = [];

  // Top hook
  const winningHooks = report.hookInsights.filter(h => h.winRate >= 0.6 && h.confidence !== 'low');
  for (const h of winningHooks.slice(0, 2)) {
    rules.push({
      type: 'do_more',
      scope: 'hook',
      message: `Lead more ads with ${h.label.toLowerCase()} — they convert.`,
      evidence: `${h.winnerCount}/${h.winnerCount + h.loserCount} scored ads are winners (ROAS ${h.roas.toFixed(2)}x, $${h.spend.toFixed(0)} spent)`,
      priority: h.confidence === 'high' ? 'high' : 'medium',
    });
  }

  // Losing hooks
  const losingHooks = report.hookInsights.filter(h => h.winRate <= 0.25 && h.loserCount >= 2 && h.confidence !== 'low');
  for (const h of losingHooks.slice(0, 2)) {
    rules.push({
      type: 'avoid',
      scope: 'hook',
      message: `Avoid ${h.label.toLowerCase()} — it has been failing in this account.`,
      evidence: `${h.loserCount} losers in ${h.adCount} ads (ROAS ${h.roas.toFixed(2)}x)`,
      priority: 'high',
    });
  }

  // Top format
  const winningFormats = report.formatInsights.filter(f => f.winRate >= 0.5 && f.confidence !== 'low');
  for (const f of winningFormats.slice(0, 2)) {
    rules.push({
      type: 'do_more',
      scope: 'format',
      message: `Prioritize ${f.label} format — best ROAS in the data.`,
      evidence: `ROAS ${f.roas.toFixed(2)}x across ${f.adCount} ads, $${f.spend.toFixed(0)} spend`,
      priority: f.confidence === 'high' ? 'high' : 'medium',
    });
  }

  // Top angle
  const winningAngles = report.angleInsights.filter(a => a.winRate >= 0.5 && a.confidence !== 'low');
  for (const a of winningAngles.slice(0, 2)) {
    rules.push({
      type: 'do_more',
      scope: 'angle',
      message: `Lean into the "${a.label}" angle — it's resonating.`,
      evidence: `ROAS ${a.roas.toFixed(2)}x across ${a.adCount} ads, ${a.winnerCount} winners`,
      priority: a.confidence === 'high' ? 'high' : 'medium',
    });
  }

  // Awareness mismatch
  const awBest = report.awarenessInsights.filter(a => a.confidence !== 'low').sort((a, b) => b.roas - a.roas)[0];
  if (awBest && awBest.roas >= 1.5) {
    rules.push({
      type: 'do_more',
      scope: 'awareness',
      message: `Your "${awBest.label}" funnel slot is your best-performing layer. Generate more variants here first.`,
      evidence: `ROAS ${awBest.roas.toFixed(2)}x at this awareness level`,
      priority: 'medium',
    });
  }

  // Fix-this rules from creative-level losers
  for (const loser of report.topLosers.slice(0, 3)) {
    if (loser.frequency > 4) {
      rules.push({
        type: 'fix',
        scope: 'creative',
        message: `Refresh "${loser.name}" — frequency ${loser.frequency.toFixed(1)}x means audience fatigue.`,
        evidence: loser.verdictReason,
        priority: 'high',
      });
    } else if (loser.ctr < 0.5) {
      rules.push({
        type: 'fix',
        scope: 'creative',
        message: `"${loser.name}" hook isn't grabbing attention (CTR ${loser.ctr.toFixed(2)}%). Re-write the opener.`,
        evidence: loser.verdictReason,
        priority: 'medium',
      });
    } else if (loser.conversions === 0) {
      rules.push({
        type: 'fix',
        scope: 'creative',
        message: `"${loser.name}" gets clicks but no buyers — landing page or offer is the bottleneck, not the ad.`,
        evidence: loser.verdictReason,
        priority: 'medium',
      });
    }
  }

  return rules;
}

export function buildInsightReport(rows: AdRow[]): AdInsightReport {
  const rollups = scoreVerdicts(rollupAds(rows));

  const totalSpend = rollups.reduce((s, r) => s + r.spend, 0);
  const totalConversions = rollups.reduce((s, r) => s + r.conversions, 0);
  const totalImpressions = rollups.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = rollups.reduce((s, r) => s + r.clicks, 0);
  const totalRevenue = rollups.reduce((s, r) => s + r.conversion_value, 0);

  const hookInsights = aggregateBy(rollups, r => r.hookType, k => HOOK_LABELS[k]);
  const formatInsights = aggregateBy(rollups, r => r.formatType, k => FORMAT_LABELS[k]);
  const angleInsights = aggregateBy(rollups, r => r.angle, k => ANGLE_LABELS[k]);
  const awarenessInsights = aggregateBy(rollups, r => r.awareness, k => AWARENESS_LABELS[k]);

  const topWinners = rollups.filter(r => r.verdict === 'winner').sort((a, b) => b.roas - a.roas).slice(0, 5);
  const topLosers = rollups.filter(r => r.verdict === 'loser').sort((a, b) => b.spend - a.spend).slice(0, 5);

  const partial: Omit<AdInsightReport, 'rules'> = {
    rollups,
    totals: {
      spend: totalSpend,
      conversions: totalConversions,
      impressions: totalImpressions,
      clicks: totalClicks,
      revenue: totalRevenue,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpa: totalConversions > 0 ? totalSpend / totalConversions : Infinity,
      adCount: rollups.length,
      winnerCount: rollups.filter(r => r.verdict === 'winner').length,
      loserCount: rollups.filter(r => r.verdict === 'loser').length,
    },
    hookInsights,
    formatInsights,
    angleInsights,
    awarenessInsights,
    topWinners,
    topLosers,
  };

  return { ...partial, rules: generateRules(partial) };
}

// =====================================================================
// PERIOD COMPARISON — week-over-week deltas
// =====================================================================

export interface PeriodCompare {
  current: { from: string; to: string; spend: number; conversions: number; roas: number; ctr: number; cpa: number };
  previous: { from: string; to: string; spend: number; conversions: number; roas: number; ctr: number; cpa: number };
  deltas: { spend: number; conversions: number; roas: number; ctr: number; cpa: number };
}

function summarize(rows: AdRow[]) {
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const conversions = rows.reduce((s, r) => s + r.conversions, 0);
  const conversion_value = rows.reduce((s, r) => s + r.conversion_value, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  return {
    spend,
    conversions,
    roas: spend > 0 ? conversion_value / spend : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
  };
}

function pct(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

export function compareLastTwoPeriods(rows: AdRow[]): PeriodCompare | null {
  const dates = [...new Set(rows.map(r => r.date).filter(Boolean))].sort();
  if (dates.length < 4) return null;

  const mid = Math.floor(dates.length / 2);
  const prevDates = new Set(dates.slice(0, mid));
  const currDates = new Set(dates.slice(mid));

  const prevRows = rows.filter(r => prevDates.has(r.date));
  const currRows = rows.filter(r => currDates.has(r.date));
  const prev = summarize(prevRows);
  const curr = summarize(currRows);

  return {
    current: { from: dates[mid], to: dates[dates.length - 1], ...curr },
    previous: { from: dates[0], to: dates[mid - 1], ...prev },
    deltas: {
      spend: pct(curr.spend, prev.spend),
      conversions: pct(curr.conversions, prev.conversions),
      roas: pct(curr.roas, prev.roas),
      ctr: pct(curr.ctr, prev.ctr),
      cpa: pct(curr.cpa, prev.cpa),
    },
  };
}
