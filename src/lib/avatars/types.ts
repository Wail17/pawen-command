// ============================================================
// PAWEN — Avatar Excavation Types
// Core Avatar input → multi-source deep mining → sub-avatars + angles
// ============================================================

// === CORE AVATAR INPUT (fourni par l'humain) ===

export interface CoreAvatarInput {
  surface_desire: string;   // ex: "wants restorative sleep"
  niche: string;            // ex: "sleep", "skincare 40+", "dog health"
  product: string;          // nom + description courte
  language: string;         // "fr-FR", "es-ES", "en-US", ...
  market: string;           // "France", "Spain", "US", ...
  notes?: string;           // contexte libre optionnel
}

// === SOURCES ===

export type SourceType =
  | 'reddit'
  | 'amazon'
  | 'youtube'
  | 'tiktok'
  | 'quora'
  | 'forums'
  | 'reviews'
  | 'searchWide'
  | 'shopify'
  | 'instagram'
  | 'facebook';

export interface SourceConfig {
  reddit: boolean;
  amazon: boolean;
  youtube: boolean;
  tiktok: boolean;
  quora: boolean;
  forums: boolean;
  reviews: boolean;
  searchWide: boolean;
  shopify: boolean;
  instagram: boolean;
  facebook: boolean;
}

export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  reddit: true,
  amazon: true,
  youtube: true,
  tiktok: true,
  quora: true,
  forums: true,
  reviews: true,
  searchWide: true,
  shopify: true,
  // Apify path retired 2026-04-26 — Bright Data has no keyword/hashtag
  // discovery for IG (only profile-URL ingestion) and FB has no BD
  // dataset at all. Both default OFF until we wire a non-Apify path.
  instagram: false,
  facebook: false,
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  reddit: 'Reddit',
  amazon: 'Amazon Reviews',
  youtube: 'YouTube Comments',
  tiktok: 'TikTok Comments',
  quora: 'Quora',
  forums: 'Niche Forums',
  reviews: 'Review Sites (Trustpilot, etc.)',
  searchWide: 'Wide Web Search',
  shopify: 'Shopify Store Data',
  instagram: 'Instagram Comments',
  facebook: 'Facebook Groups & Pages',
};

// === SOURCE DISCOVERY (Phase 1) ===
// Outputs produced by the "Discovery" sub-agent before fetching kicks in.

export interface SourceDiscoveryPlan {
  reddit: {
    subreddits: string[];        // ["r/sleep", "r/insomnia", ...]
    queries: string[];           // fallback queries if subreddits are thin
  };
  amazon: {
    product_queries: string[];   // ex: ["blackout curtains", "sleep mask"]
    marketplace: string;         // "amazon.com", "amazon.fr", ...
  };
  youtube: {
    video_queries: string[];     // search terms for videos
  };
  tiktok: {
    hashtags: string[];
    search_queries: string[];
  };
  quora: {
    queries: string[];
  };
  forums: {
    domains: string[];           // ex: ["doctissimo.fr", "sleepfoundation.org"]
    queries: string[];
  };
  reviews: {
    sites: string[];             // trustpilot.com, sitejabber.com, ...
    queries: string[];
  };
  searchWide: {
    queries: string[];
  };
  shopify: {
    store_urls: string[];       // full product URLs or store domains
    product_queries: string[];  // search terms to find competitor Shopify stores
  };
  instagram: {
    hashtags: string[];         // ["#dimagriremamma", "#sleeptricks"]
    search_queries: string[];   // keyword searches when hashtags are thin
  };
  facebook: {
    page_urls: string[];        // pre-known public pages or groups (facebook.com/groups/xxx)
    search_queries: string[];   // text search for Tavily fallback
  };
}

// === RAW SCRAPED DATA (Phase 2) ===

export interface RawSourceItem {
  url: string;
  title?: string;
  content: string;               // markdown or plain text
  comments?: string[];           // for YT, Reddit, etc.
  source: SourceType;
  metadata?: Record<string, unknown>;
}

export interface RawSourceData {
  source: SourceType;
  queries: string[];             // what was actually searched
  items: RawSourceItem[];
  fetchDurationMs: number;
  itemCount: number;
  error?: string;
}

// === STRUCTURED EXTRACTION (Phase 3 — after per-source analyzer) ===

export interface VerbatimQuote {
  quote: string;                 // exact words
  source_url: string;
  source_type: SourceType;
  context?: string;              // 1-line context
  emotion_tag?: string;
}

export interface SourceAnalysis {
  source: SourceType;
  verbatim_quotes: VerbatimQuote[];
  experiences: string[];          // things that happened to them
  emotions: string[];             // how they feel now
  behaviors: string[];            // what they do / avoid
  implicit_demographics: string[];
  past_attempts_failures: string[];
  triggers: string[];             // trigger moments
  patterns_observed: string[];    // cross-item patterns in this source
  item_count_analyzed: number;

  // === Phase O enrichments (backward-compat: all optional) ===
  identity_statements?: string[];       // "I am a…", "I'm not the kind of person who…"
  language_dna?: string[];              // exact phrases, metaphors, slang the audience uses
  desire_ladder?: {
    surface: string;                    // what they SAY they want
    real: string;                       // what they ACTUALLY want
    hidden: string;                     // what they won't admit they want
  };
  buying_journey_signals?: string[];    // comparison shopping, price talk, "should I buy X or Y"
  objection_clusters?: string[];        // what stops them from buying
  contradiction_patterns?: string[];    // say X but do Y
  trust_signals?: string[];             // who/what they trust (influencers, brands, friends, studies)
  emotional_intensity_peaks?: string[]; // moments of highest emotional charge in verbatims
}

// === SUB-AVATAR V2 (enriched output) ===

export type DominantCategory = 'experience' | 'emotion' | 'behavior' | 'demographic';

export type PositioningFramework =
  | 'new_mechanism'
  | 'new_information'
  | 'new_identity'
  | 'elevation';

export interface SubAvatarAngles {
  positioning: {
    framework: PositioningFramework;
    description: string;
    rationale: string;
  };
  hooks: string[];                // 3-5 ad hooks
  story_angle: {
    problem: string;
    agitation: string;
    solution: string;
    mechanism: string;
    cta: string;
  };
}

export interface SubAvatarV2 {
  id: string;
  name: string;                   // ex: "The overwhelmed non-sleeper"
  nickname: string;               // ex: "on-edge mom"
  dominant_category: DominantCategory;
  surface_desire: string;         // inherited from core avatar

  description: string;            // 3-4 lines describing this sub-avatar

  // scoring
  tam_estimate: string;           // rough TAM estimate w/ reasoning
  urgency_score: number;          // 1-10
  scope_score: number;            // 1-10
  staying_power_score: number;    // 1-10

  // evidence
  verbatim_quotes: VerbatimQuote[];     // 8-10 quotes minimum
  emotional_triggers: string[];         // top 3-5
  past_attempts_failures: string[];
  implicit_demographics: string[];

  // angles (3 by spec)
  angles: SubAvatarAngles;

  // provenance
  source_references: SourceType[];      // which sources fed this sub-avatar
  source_subreddits?: string[];
  source_urls?: string[];

  // ordering
  launch_order: number;
  recommended_for_test: boolean;
  recommendation_reason: string;

  // The awareness level where this sub-avatar is most likely to convert.
  // Populated by the Gate 1 compile prompt based on verbatim signals
  // (self-described pain vs. solution-shopping vs. ready-to-buy). Drives
  // the recommended-funnel badge in GateContextBar.
  recommended_awareness_level?: AwarenessLevel;

  // Why this awareness level was picked — references verbatim signals.
  // Surfaced on the sub-avatar card so the user understands the call.
  recommended_awareness_reason?: string;

  // Eugene Schwartz's 5 stages of market sophistication. Tells you what
  // copy approach the MARKET expects (not just the prospect's awareness).
  // Stage 1 = virgin market, direct claim wins.
  // Stage 2 = direct claim works but you must shout louder.
  // Stage 3 = bigger/more dramatic claim needed.
  // Stage 4 = unique mechanism becomes the wedge.
  // Stage 5 = explain the mechanism / new mechanism / story-driven angle.
  market_sophistication?: MarketSophistication;

  // === Stackable, non-destructive enrichments ===
  // These are generated on-demand AFTER the main compile pass. They are
  // appended (never overwritten) so the user can re-run freely and compare.
  awareness_variants?: AwarenessVariant[];  // one per (awareness level, run)
  deep_dives?: DeepDiveResult[];            // stackable deep-dive passes

  // === Reverse-engineer provenance + enrichment ===
  // Populated when this sub-avatar was built from a competitor funnel
  // (via fromReverseEngineered + optional localization + enrichment pass).
  // The UI uses these to surface a warning banner and to render richer
  // sections than the base sub-avatar fields.
  is_from_reverse_engineer?: boolean;
  reverse_source_brand?: string;
  reverse_source_url?: string;

  // Stacked angles (up to 5) — extends base `angles` with identity /
  // failed_attempts / fear / social_proof frameworks when available.
  additional_angles?: SubAvatarAngles[];

  // Structured past attempts: what they tried, why it failed, what it
  // left them feeling. Replaces the flat past_attempts_failures list
  // in the UI when present.
  structured_past_attempts?: StructuredPastAttempt[];

  // Sensory-anchored triggers: each trigger tagged with its dominant
  // sense + intensity/frequency so downstream copy can be sensory-rich.
  sensory_triggers?: SensoryTrigger[];

  // Scored hooks (ranked by intensity/curiosity/relevance).
  scored_hooks?: ScoredHook[];

  // Buying-behavior block (decision cycle, price sensitivity, proof type).
  buying_behavior?: BuyingBehavior;

  // Demographics re-anchored to the target market (currency, cultural refs).
  localized_demographics?: LocalizedDemographics;

  // Story-arc enrichment shared across all angles.
  narrator_persona?: string;
  bridge_moment?: string;            // the awareness shift between agitation and solution

  // Adversarial validation — structured per-sub-avatar weakness report
  // from the Phase 4.5A auditor pass. Kept separate from
  // `recommendation_reason` so the UI can render challenges + merge
  // suggestions without mangling the lead copy.
  adversarial_challenge?: {
    confidence_score: number;                // 0-100
    evidence_density: 'strong' | 'moderate' | 'weak';
    cross_source_confirmed: boolean;
    challenges: string[];                    // specific weaknesses
    overlap_with: string[];                  // overlapping sub-avatar IDs
    recommendation: 'keep' | 'merge' | 'flag_weak' | 'drop';
    reasoning: string;
  };
}

export interface StructuredPastAttempt {
  what_tried: string;
  why_failed: string;
  residual_emotion: string;          // what feeling it left behind
}

export type SensoryAnchor = 'visual' | 'touch' | 'sound' | 'smell' | 'taste' | 'interoceptive';

export interface SensoryTrigger {
  trigger: string;
  sensory_anchor: SensoryAnchor;
  intensity_score: number;           // 1-10
  frequency_score: number;           // 1-10
  context: string;                   // 1-line situational hook
}

export interface ScoredHook {
  hook: string;
  curiosity_score: number;           // 1-10
  intensity_score: number;           // 1-10
  relevance_score: number;           // 1-10
  target_language: string;           // ISO tag — confirms localization
}

export interface BuyingBehavior {
  decision_cycle: string;            // impulsive | researcher | long_deliberation
  price_sensitivity: string;         // high | medium | low + short rationale
  preferred_social_proof: string;    // reviews | studies | before_after | testimonials | experts
  preferred_channel: string;         // Meta feed | Stories | Reels | TikTok | email | retargeting
  top_objections: Array<{
    objection: string;
    severity: 'deal_breaker' | 'hesitation' | 'minor';
    counter_argument: string;
  }>;
}

export interface LocalizedDemographics {
  age_range: string;
  income_range: string;              // localized to market currency
  income_currency: string;           // "EUR", "USD", "GBP", ...
  geographic_concentration: string[];
  cultural_references: string[];     // brands/figures/events native to target market
  language_register: string;         // "formal italian", "familiar fr-CA", ...
}

// === MARKET SOPHISTICATION (Eugene Schwartz) ===
// Independent of awareness level. Describes how *crowded/jaded* the market is.
// A prospect can be "problem-aware" in a Stage 5 market — same pain, but every
// competitor has already promised the moon, so direct claim falls flat and you
// need a unique mechanism or new story.

export type MarketSophisticationStage = 1 | 2 | 3 | 4 | 5;

export interface MarketSophistication {
  stage: MarketSophisticationStage;
  stage_name: string;             // "virgin market" | "direct claim" | "bigger claim" | "unique mechanism" | "new mechanism / story"
  reasoning: string;              // 2-3 sentences citing competitor density, ad fatigue signals, claim escalation seen in scraped data
  recommended_approach: string;   // what copy strategy actually works at this stage
  copy_implications: string[];    // 3-5 actionable rules for downstream copy gates
}

// === AWARENESS LEVELS (Eugene Schwartz) ===
// The 5 canonical awareness levels. Used as a FILTER applied to a sub-avatar
// to re-generate copy angles tuned to where the prospect is on the awareness
// ladder. Re-runnable: each run produces a new AwarenessVariant that stacks
// into sub_avatar.awareness_variants — previous runs are never destroyed.
export type AwarenessLevel =
  | 'unaware'          // doesn't know they have a problem
  | 'problem_aware'    // knows the pain, no solution in mind
  | 'solution_aware'   // knows solutions exist, doesn't know yours
  | 'product_aware'    // knows your product, hasn't decided
  | 'most_aware';      // ready to buy, just needs the offer

export const AWARENESS_LEVELS: AwarenessLevel[] = [
  'unaware',
  'problem_aware',
  'solution_aware',
  'product_aware',
  'most_aware',
];

export interface AwarenessVariant {
  id: string;
  awareness_level: AwarenessLevel;
  generated_at: string;             // ISO
  tokens_used: number;

  // The filter-adapted copy for THIS awareness level.
  // Re-generating for the same level produces a NEW id/entry (non-destructive).
  headline: string;                 // the big promise, level-appropriate
  hook: string;                     // opening line that meets them where they are
  agitation: string;                // what they already feel vs. what to surface
  bridge: string;                   // how to move them to the next level of awareness
  proof_angle: string;              // the most credible proof type for this level
  cta_style: string;                // how to ask for action (hard sell vs. soft)
  claude_notes: string;             // 2-3 lines of "why I wrote it this way"
}

export interface MicroSegment {
  name: string;                     // "night-shift nurses", "new dads", etc.
  description: string;              // 1-2 lines
  what_makes_them_different: string;
  recommended_hook: string;
}

export interface DeepDiveResult {
  id: string;
  generated_at: string;             // ISO
  tokens_used: number;

  // Enriched data that appends onto the sub-avatar without overwriting.
  // Each deep-dive should go DEEPER than the last — model gets told which
  // angle to push on when the user fires another round.
  focus: string;                    // what this round focused on (user-provided or auto)
  new_verbatims: VerbatimQuote[];
  hidden_fears: string[];           // the stuff they don't say out loud
  contradictions: string[];         // where the avatar's stated vs. actual desires clash
  sharper_triggers: string[];       // higher-precision emotional triggers
  micro_segments: MicroSegment[];   // sub-cuts of this sub-avatar
  buying_objections: string[];      // what stops them pulling the trigger
  meta_story: string;               // 4-6 lines, "the real story behind this avatar"
  claude_notes: string;

  // === Phase O enrichments (backward-compat: all optional) ===
  identity_map?: {
    self_image: string;             // who they see themselves as
    anti_identity: string;          // who they do NOT want to be
    aspiration: string;             // who they want to become
    tribal_markers: string[];       // signals of in-group membership
  };
  linguistic_dna?: {
    power_words: string[];          // words that trigger action
    emotional_vocabulary: string[]; // how they describe their feelings (their words, not clinical)
    metaphors_used: string[];       // "I feel like I'm drowning", "it's a rollercoaster"
    recurring_phrases: string[];    // phrases they repeat across sources
  };
  transformation_narrative?: {
    before_state: string;           // vivid description of current pain
    turning_point: string;          // what would make them change
    after_state: string;            // the promised land they dream of
    proof_they_need: string;        // what evidence would convince them
  };
  dark_funnel?: {
    influencers: string[];          // who they listen to
    content_consumed: string[];     // podcasts, YT channels, subreddits they follow
    trusted_sources: string[];      // where they go for buying advice
    peer_pressure: string;          // how their social circle influences decisions
  };
  objection_hierarchy?: {
    objection: string;
    severity: 'deal_breaker' | 'hesitation' | 'minor';
    counter_argument: string;
  }[];
}

// === RAW SIGNAL (preserved verbatim corpus + n-grams + emotion hits) ===
// Deterministic output from src/lib/avatars/rawSignal.ts. Never touched by an
// LLM. Lives on AvatarRunResult so every downstream read (UI, gates, deep-dives)
// can go back to the raw scraped voice-of-customer instead of relying on the
// compile-phase summary.

export interface RawSignalItem {
  text: string;
  source_type: SourceType;
  source_url: string;
  title?: string;
  scraped_at: string;       // ISO
  char_count: number;       // original char length before slicing
}

export interface NgramStat {
  gram: string;
  count: number;
  sources: number;          // number of distinct source types that hit this gram
}

export type EmotionCategoryV2 =
  | 'fear'
  | 'frustration'
  | 'hope'
  | 'desperation'
  | 'shame'
  | 'exhaustion'
  | 'urgency'
  | 'skepticism'
  | 'desire'
  | 'guilt'
  | 'isolation'
  | 'anger'
  | 'envy'
  | 'pride'
  | 'helplessness';

export interface EmotionMarkerHit {
  category: EmotionCategoryV2;
  phrase: string;
  lang: string;
  count: number;
  sources: number;
}

export interface ScoredPhrase {
  phrase: string;
  score: number;           // 0-100 marketing value score
  count: number;
  sources: number;
  tags: string[];          // e.g. ['buying_signal', 'identity', 'high_emotion']
}

export interface IdentityMarkerHit {
  pattern: string;         // the matched text
  type: 'self_identify' | 'anti_identify' | 'aspiration' | 'tribal';
  source_type: SourceType;
  count: number;
}

export interface BuyingSignalHit {
  pattern: string;
  type: 'comparison' | 'price_sensitivity' | 'purchase_intent' | 'recommendation_seeking' | 'urgency';
  count: number;
  sources: number;
}

export interface RawSignal {
  generated_at: string;
  items: RawSignalItem[];             // all preserved, never LLM-processed
  total_items: number;
  total_char_count: number;
  source_breakdown: Record<string, number>;
  source_errors?: Record<string, string>;  // diagnostic messages from failed / 0-item fetchers

  top_unigrams: NgramStat[];
  top_bigrams: NgramStat[];
  top_trigrams: NgramStat[];
  top_phrases: NgramStat[];           // 4-6 word motifs (the gold)

  emotion_markers: EmotionMarkerHit[];

  // === Phase O enrichments (backward-compat: all optional) ===
  scored_phrases?: ScoredPhrase[];         // n-grams ranked by marketing value
  identity_markers?: IdentityMarkerHit[];  // "I am / I'm not" patterns
  buying_signals?: BuyingSignalHit[];      // purchase intent, comparison, price signals
  golden_sentences?: {                     // full sentences with high emotional charge
    sentence: string;
    source_type: SourceType;
    source_url: string;
    emotion_tags: string[];
    score: number;                         // 0-100
  }[];

  // User-curated golden nuggets. Downstream gates can read these via
  // project.avatarRunResult.raw_signal.picks.
  picks?: {
    phrases: string[];
    verbatims: string[];      // pick full verbatim text
    emotion_markers: string[];
  };
}

// === FINAL AVATAR RUN RESULT ===

export interface ComparativeRow {
  sub_avatar_id: string;
  nickname: string;
  tam: string;
  urgency: number;
  scope: number;
  staying_power: number;
  recommended: boolean;
}

export interface FinalRecommendation {
  first_to_test: string;          // sub-avatar id
  reason: string;
  strategy: string;               // how to position the test
}

export interface AvatarRunMetadata {
  sources_used: SourceType[];
  total_verbatims: number;
  total_items_scraped: number;
  run_duration_ms: number;
  cost_estimate_usd: number;
  phase_timings: {
    discovery_ms: number;
    fetch_ms: number;
    analyze_ms: number;
    compile_ms: number;
  };
}

export interface AvatarRunResult {
  core_avatar: CoreAvatarInput;
  discovery_plan: SourceDiscoveryPlan;
  sub_avatars: SubAvatarV2[];
  comparative_table: ComparativeRow[];
  final_recommendation: FinalRecommendation;
  metadata: AvatarRunMetadata;

  // Preserved voice-of-customer corpus (never touched by an LLM) + computed
  // n-gram / emotion stats. Populated by runAvatarExcavation after Phase 2.
  // Optional for backward-compat with existing projects that ran before this
  // field existed.
  raw_signal?: RawSignal;

  // Top-level summary of the adversarial validation pass. Per-sub-avatar
  // detail lives on each SubAvatarV2's `adversarial_challenge` field.
  adversarial_summary?: {
    overall_quality: 'excellent' | 'good' | 'needs_work' | 'poor';
    strongest_sub_avatar: string;
    weakest_sub_avatar: string;
    merge_suggestions: Array<{ merge: [string, string]; reason: string }>;
    missing_angles: string[];
  };
}

// === PROGRESS EVENTS (for streaming UI) ===

export type AvatarProgressPhase =
  | 'idle'
  | 'discovery'
  | 'fetching'
  | 'analyzing'
  | 'compiling'
  | 'done'
  | 'error';

export interface AvatarProgressEvent {
  phase: AvatarProgressPhase;
  source?: SourceType;
  message: string;
  progress?: number;              // 0-1
  itemCount?: number;
}
