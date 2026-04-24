// ============================================================
// PAWEN COMMAND CENTER — Core Types
// ============================================================

import type { CoreAvatarInput, AvatarRunResult, SourceConfig } from '../avatars/types';
import type { LocalizationCheckpoint } from '../avatars/localizeReverseEngineered';
import type { ReverseEngineeredFunnel } from '../competitor/types';
import type { BrandSearchBrand } from '../brandsearch/types';

// === PROJECT ===

export interface Project {
  id: string;
  name: string;
  productUrl: string;
  productDescription: string;
  targetLanguage: string;     // "es-ES", "fr-FR", "de-DE", "ja-JP", etc.
  sourceLanguage: string;     // "en-US" default
  targetMarket: string;       // "Spain", "France", "DACH", etc.
  niche: string;              // inferred or manual
  createdAt: string;
  updatedAt: string;
  currentGate: GateId;
  gateStatuses: Record<GateId, GateStatus>;
  brandDNA: BrandDNA | null;
  startAnywhereMode: boolean;

  // --- Avatar Excavation (Gate 1, new pipeline) ---
  // Optional for backward compatibility with existing projects.
  coreAvatarInput?: CoreAvatarInput;       // human-provided input
  avatarSourceConfig?: SourceConfig;       // per-source toggles
  avatarRunResult?: AvatarRunResult;       // final sub-avatars + angles

  // --- Selected sub-avatar (currently VIEWED, drives display of per-SA gate outputs) ---
  // In single-SA mode: the SA the human picked after Gate 1.
  // In batch mode: the SA currently being viewed in the gate tabs.
  selectedSubAvatarId?: string;

  // --- Batch-run sub-avatar IDs (Matrix Mode) ---
  // User checks N sub-avatars on Gate 1 + clicks "Launch Batch" → each runs
  // Gate 2→9 in parallel, each on its own recommended funnel + sophistication.
  // When set, gate outputs are stored per-SA under key `${projectId}:${gateId}:${saId}`.
  // The legacy single-SA key `${projectId}:${gateId}` remains for Gate 1 + Brand DNA.
  batchSubAvatarIds?: string[];

  // --- Batch run progress (per-SA status during/after a batch pipeline) ---
  // Map of subAvatarId → progress snapshot. Written live by runBatchPipeline.
  // Surfaces per-SA progress bars on the project home page.
  batchRunStatus?: Record<string, BatchSubAvatarRunStatus>;

  // --- Funnel type (global override) ---
  // Used in single-SA mode or as a manual override. In batch mode, each SA
  // derives its own funnel from sa.recommended_awareness_level unless set.
  selectedFunnel?: FunnelType;

  // --- Long-form copy format selector (G5) ---
  // 'advertorial' = ZAK 7-block sales page (existing G5)
  // 'native' = 300-600 word story-driven native ad
  // 'listicle' = numbered list ad (scaffold, not yet implemented)
  // 'skipped' = user skips G5 entirely, unlocks G6+G7 directly
  selectedCopyFormat?: 'advertorial' | 'native' | 'listicle' | 'skipped';

  // --- Ad Script format selector (G6) ---
  // 'ugc' = talking-head UGC scripts (~45s, current default)
  // 'vsl' = long-form Video Sales Letter (5-15min, structured 7-block)
  // 'both' = produce both UGC + VSL
  // 'skipped' = skip G6 entirely (static-only strategy), unlocks G7
  selectedAdScriptFormat?: 'ugc' | 'vsl' | 'both' | 'skipped';

  // --- Ad Performance (real metrics fed back into learning engine) ---
  adPerformance?: AdPerformance[];

  // --- Shopify product data (auto-imported, drives entire pipeline) ---
  // Structured product intelligence pulled from a Shopify store URL.
  // Every downstream gate reads this for real prices, features, images,
  // reviews, variants — no more generic placeholders.
  shopifyData?: ShopifyProductData;

  // --- Competitor Intelligence (Gate 1.1) ---
  // Stores reverse-engineered funnel data and/or cloned funnel assets.
  competitorIntel?: {
    // Full reverse-engineered funnel — stored whole so Gate 1 can promote
    // it into a real SubAvatarV2 without losing copy_arsenal / mechanism /
    // creative_strategy / insights.
    reverseEngineered?: ReverseEngineeredFunnel & { injected_at: string };
    clonedFunnel?: Record<string, unknown>;
  };

  // --- Reference Ads (winning static ads the user uploads for Gate 7 inspiration) ---
  referenceAds?: AnalyzedAd[];

  // --- BrandSearch Intel (PRE-GATE competitor brand research) ---
  competitorBrands?: BrandSearchBrand[];

  // --- Per-gate generation config (how many variants, hooks, beats to generate) ---
  // User-controlled. Kept outside the auto-run loop so generation stays deterministic
  // given a config. Read by gate prompts at run time.
  gateConfigs?: Record<string, GateGenerationConfig>;

  // --- Localization in-flight checkpoint ---
  // Stashed mid-flow so a crash (API timeout, 500, empty scrape) can resume
  // from the last completed phase instead of re-running from zero. Cleared
  // once the localize run completes successfully.
  localizationCheckpoint?: LocalizationCheckpoint | null;

  // --- Background avatar excavation job (Gate 1) ---
  // When non-null, a server-side runAvatarJob is in flight or has finished.
  // Gate1 polls /api/avatars/jobs/{id} on mount; once status === 'completed'
  // it hydrates the result into avatarRunResult and clears this field.
  activeAvatarJobId?: string | null;

  // --- Background deep-dive jobs (Gate 1, per sub-avatar) ---
  // Map of subAvatarId → jobId. Set when a deep-dive runs in background;
  // cleared once Gate1 polls completion and appends the dive to the
  // sub-avatar. Per-sub-avatar so multiple users / multiple sub-avatars
  // can have dives in flight independently.
  activeDeepDiveJobs?: Record<string, string>;
}

export interface GateGenerationConfig {
  hookCount?: number;          // G5 Native: opening-line variants. Default 3.
  bodyVariantCount?: number;   // G5 Native: full body variants (different angle/POV). Default 1.
  imageBeatCount?: number;     // G5 Native: image beats for creative handoff. Default 4.
  closeVariantCount?: number;  // G5 Native: soft-close variants. Default 2.
}

// === ANALYZED AD (Claude vision analysis of uploaded reference images) ===

export interface AnalyzedAd {
  id: string;
  imageDataUrl: string;           // base64 data URL (thumbnail for display)
  analyzedAt: string;
  headline: string;
  visual_description: string;     // what the viewer SEES (100+ words)
  layout_structure: string;       // how elements are arranged
  color_palette: string[];        // hex colors
  mood: string;
  format_type: string;            // static_graphic|product_photo|native_style|quote_text|ugc_image|meme_style|etc
  why_it_works: string;           // psychological analysis
  pattern_name: string;           // reusable pattern (e.g. "transformation", "comparison", "subversion")
  target_emotion: string;
  copywriting_elements: string;   // headline style, CTA, subtext
}

// === SHOPIFY PRODUCT DATA ===
// Structured product intelligence pulled from Shopify's public JSON endpoints.
// Stored on Project, injected into every gate prompt as productContext.

export interface ShopifyProductData {
  // Core info
  storeUrl: string;
  productUrl: string;
  productTitle: string;
  productDescription: string;         // plain text, HTML stripped
  productDescriptionHtml?: string;    // original HTML

  // Pricing
  price: string | null;               // main variant price
  compareAtPrice: string | null;      // crossed-out "was" price
  currency: string;                   // USD, EUR, etc. (inferred from store)
  pricePosition?: 'budget' | 'mid' | 'premium';

  // Product details
  vendor: string;
  productType: string;                // Shopify product type
  tags: string[];
  productFormat?: string;             // pill, cream, app, ebook, device, etc.

  // Variants
  variants: ShopifyVariant[];

  // Images
  images: ShopifyImage[];

  // Reviews (scraped from product page)
  reviews: ShopifyReviewData[];
  reviewStats?: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution?: Record<number, number>; // 1-5 star counts
  };

  // Metadata
  importedAt: string;                 // ISO
  shopifyProductId?: number;
}

export interface ShopifyVariant {
  title: string;
  price: string;
  compareAtPrice: string | null;
  sku: string;
  available: boolean;
}

export interface ShopifyImage {
  src: string;
  alt: string | null;
}

export interface ShopifyReviewData {
  author: string;
  rating: number;
  title: string;
  body: string;
  date: string;
}

// === AD PERFORMANCE (real metrics from Meta Ads) ===
// Fed back into learning engine as the ultimate signal.
// Agents see what actually converts, not just what scores well.

export interface AdPerformance {
  id: string;
  adName: string;
  funnel: string;
  // Core metrics
  impressions: number;
  clicks: number;
  ctr: number;             // click-through rate %
  cpc: number;             // cost per click
  cpa: number;             // cost per acquisition
  roas: number;            // return on ad spend
  spend: number;
  conversions: number;
  // Context
  dateRange: string;       // "2026-03-01 to 2026-03-15"
  notes: string;
  addedAt: string;
  // --- Optional creative tagging (auto-extracted from ad name when CSV
  // is uploaded via the feedback loop). Backward compatible — manual
  // entries leave these undefined and the prompt builder degrades.
  hookType?: string;       // question | stat_number | social_proof | …
  formatType?: string;     // ugc | advertorial | static_graphic | …
  angle?: string;          // transformation | mechanism | proof | …
  awareness?: string;      // unaware | problem | solution | product | most | retargeting
  verdict?: 'winner' | 'loser' | 'mid' | 'unscored';
  source?: 'manual' | 'csv';
}

// === BATCH RUN STATUS (Matrix Mode) ===
// Per-sub-avatar snapshot of the batch pipeline. Written live by runBatchPipeline.

export interface BatchSubAvatarRunStatus {
  subAvatarId: string;
  subAvatarNickname: string;
  funnel: FunnelType;
  sophisticationStage?: 1 | 2 | 3 | 4 | 5;
  // The gates this SA is configured to run in the batch (may be a subset of
  // gate2-9 if the user chose a range like gate2→gate5). Used by the UI as
  // the progress denominator.
  plannedGates: GateId[];
  currentGate: GateId | null;
  completedGates: GateId[];
  stoppedAt: GateId | null;
  reason: string | null;
  startedAt: string;
  updatedAt: string;
  status: 'queued' | 'running' | 'stopped' | 'completed' | 'failed';
}

export type FunnelType =
  | 'full_unaware'       // prospect doesn't know they have a problem
  | 'problem_aware'      // knows the pain, not the solution
  | 'solution_aware'     // knows solutions exist, doesn't know yours
  | 'product_aware'      // knows your product, hasn't decided
  | 'most_aware'         // ready to buy, just needs the offer
  | 'retargeting';       // already visited, needs a nudge back

export const FUNNEL_LABELS: Record<FunnelType, string> = {
  full_unaware: 'Full Unaware',
  problem_aware: 'Problem Aware',
  solution_aware: 'Solution Aware',
  product_aware: 'Product Aware',
  most_aware: 'Most Aware',
  retargeting: 'Retargeting',
};

export const FUNNEL_DESCRIPTIONS: Record<FunnelType, string> = {
  full_unaware: "They don't even know they have a problem. Ads must disrupt and educate. Longest funnel, highest volume.",
  problem_aware: "They feel the pain but haven't looked for solutions. Agitate the wound, then introduce the category.",
  solution_aware: "They know solutions exist but don't know YOUR product. Differentiate via mechanism and proof.",
  product_aware: "They know your product but haven't decided. Overcome objections, stack proof, create urgency.",
  most_aware: "Ready to buy — just needs the right offer. Direct response, scarcity, bonuses, guarantee.",
  retargeting: "Already visited or engaged. Reminder-style ads, social proof, limited-time offers.",
};

export const FUNNEL_COLORS: Record<FunnelType, string> = {
  full_unaware: 'border-red-500/50 bg-red-500/10 text-red-400',
  problem_aware: 'border-orange-500/50 bg-orange-500/10 text-orange-400',
  solution_aware: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
  product_aware: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
  most_aware: 'border-green-500/50 bg-green-500/10 text-green-400',
  retargeting: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
};

export type GateId = 'gate1' | 'gate2' | 'gate3' | 'brand-dna' | 'gate4' | 'gate5' | 'gate6' | 'gate7' | 'gate8' | 'gate9';

export type GateStatus = 'locked' | 'available' | 'in_progress' | 'pending_review' | 'pending_decisions' | 'approved' | 'skipped';

// === GATE ===

export interface GateConfig {
  id: GateId;
  name: string;
  shortName: string;
  description: string;
  inputMode: 'ai' | 'manual';
  reviewerCriteria: ReviewCriterion[];
  reviewThreshold: number;
  hasCongruenceCheck: boolean;
  congruenceThreshold: number;
  decisionPoints: DecisionPointConfig[];
}

export interface GateOutput {
  gateId: GateId;
  projectId: string;
  // Which sub-avatar this output was built for. Set in batch mode (Gate 2-9).
  // Null/undefined = legacy single-SA output or shared output (Gate 1, Brand DNA).
  subAvatarId?: string;
  status: 'generating' | 'reviewing' | 'pending_decisions' | 'congruence_check' | 'approved' | 'stuck';
  data: Record<string, unknown>;
  generationLog: GenerationLogEntry[];
  reviewResult: ReviewResult | null;
  congruenceResult: CongruenceResult | null;
  humanDecisions: Record<string, unknown>;
  checkpoint: GateCheckpoint | null;
  createdAt: string;
  updatedAt: string;
}

// === GATES that are per-sub-avatar in batch mode ===
// Gate 1 (contains all sub-avatars) and Brand DNA (one per project) stay shared.
export const PER_SUB_AVATAR_GATES: GateId[] = [
  'gate2', 'gate3', 'gate4', 'gate5', 'gate6', 'gate7', 'gate8', 'gate9',
];

export function isPerSubAvatarGate(gateId: GateId): boolean {
  return PER_SUB_AVATAR_GATES.includes(gateId);
}

// Awareness level (from SubAvatarV2.recommended_awareness_level) → FunnelType.
// Single source of truth — used by GateContextBar, runBatchPipeline, selectedSubAvatar helper.
export const AWARENESS_TO_FUNNEL: Record<string, FunnelType> = {
  unaware: 'full_unaware',
  problem_aware: 'problem_aware',
  solution_aware: 'solution_aware',
  product_aware: 'product_aware',
  most_aware: 'most_aware',
};

export interface GateCheckpoint {
  step: string;
  iteration: number;
  intermediateData: Record<string, unknown>;
}

export interface GenerationLogEntry {
  timestamp: string;
  agent: 'generator' | 'reviewer' | 'congruence' | 'sub-agent' | 'lead' | 'manager' | 'director';
  model: string;
  iteration: number;
  input_summary: string;
  output_summary: string;
  // Full raw output — persisted on sub-agent + lead entries so we can recover
  // structured data when the lead compiler truncates mid-JSON. output_summary
  // stays as the 200-char preview for UI density.
  raw_output?: string;
  score?: number;
  tokens_used?: { input: number; output: number };
}

// === DECISION POINTS ===

export interface DecisionPointConfig {
  id: string;
  type: 'pick' | 'reorder' | 'edit' | 'choose' | 'toggle';
  label: string;
  description: string;
  required: boolean;
  multiple?: boolean;
  minSelections?: number;
  maxSelections?: number;
}

export interface DecisionPointValue {
  pointId: string;
  value: unknown;
  modifiedAt: string;
}

// === REVIEW ===

export interface ReviewCriterion {
  id: string;
  name: string;
  maxScore: number;
  description: string;
}

export interface ReviewResult {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  dimensions: ReviewDimension[];
  feedback: string;
  iteration: number;
}

export interface ReviewDimension {
  criterionId: string;
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

// === CONGRUENCE ===

export interface CongruenceResult {
  score: number;
  passed: boolean;
  dimensions: {
    locked_terms_match: number;
    customer_language: number;
    emotional_arc: number;
    cross_gate_consistency: number;
    visual_metaphor: number;
    forbidden_content: number;
  };
  driftReport: DriftItem[];
  verdict: 'CONGRUENT' | 'NEEDS_ALIGNMENT' | 'REBUILD';
  alignmentInstructions: string;
  iteration: number;
}

export interface DriftItem {
  location: string;
  expected: string;
  found: string;
  severity: 'CRITICAL' | 'WARNING' | 'MINOR';
}

// === BRAND DNA ===

export interface BrandDNA {
  version: string;
  locked: boolean;
  product_name: string;
  brand_name: string;
  target_market: string;
  target_language: string;

  locked_terms: {
    mechanism_name: string;
    root_cause_one_sentence: string;
    belief_error: string;
    mechanism_3_steps: Array<{ step: number; name: string; description: string }>;
    product_descriptor: string;
    key_proof_points: string[];
    guarantee_wording: string;
  };

  customer_language: {
    pain_quotes: Array<{ quote: string; source: string; emotion: string; sub_avatar_id: string }>;
    desire_quotes: Array<{ quote: string; source: string; depth: string }>;
    objection_quotes: Array<{ quote: string; handler: string }>;
    always_use: string[];
    never_use: string[];
    conditional_use: Array<{ term: string; allowed_in: string[]; forbidden_in: string[] }>;
  };

  emotional_arc: {
    primary_emotion: string;
    secondary_emotion: string;
    resolution_emotion: string;
    funnel_arc: Array<{ touchpoint: string; emotion: string; intensity: number }>;
    awareness_progression: {
      ad_level: string;
      advertorial_journey: string;
      lp_level: string;
    };
  };

  voice_profile: {
    vocabulary: string[];
    sentence_style: string;
    formality_level: number;
    emotional_tone: string;
    phrases_to_use: string[];
    phrases_to_avoid: string[];
    sample_paragraph: string;
  };

  visual_identity: {
    metaphor: string | null;
    color_associations: { problem: string; solution: string; brand: string };
    product_image_rules: string[];
  };

  // Product specs — auto-populated from Shopify data when available.
  // Every downstream gate reads these for real pricing, features, proof.
  product_specs?: {
    price: string;
    compare_at_price?: string;
    currency: string;
    price_position: 'budget' | 'mid' | 'premium';
    product_format: string;           // pill, cream, app, ebook, device, etc.
    key_features: string[];
    key_benefits: string[];
    guarantee_days?: number;
    shipping_info?: string;
    available_variants: Array<{ name: string; price: string; available: boolean }>;
    product_images: string[];         // URLs to real product images
  };

  // Proof inventory — real testimonials, data points from reviews/research.
  // Gates 4-9 pull from here instead of inventing social proof.
  proof_inventory?: {
    testimonials: Array<{ text: string; author: string; rating: number; verified: boolean }>;
    average_rating?: number;
    total_reviews?: number;
    data_points: Array<{ stat: string; source: string }>;
  };

  sub_avatars: Array<SubAvatar>;
}

export interface SubAvatar {
  id: string;
  name: string;
  nickname: string;
  urgency_score: number;
  launch_order: number;
  tam?: string;
  trigger_moment?: string;
  primary_angle: { name: string; description: string };
  secondary_angles?: Array<{ name: string; description: string }>;
}

// === AI ABSTRACTION ===

export type AIProviderType = 'anthropic' | 'openai' | 'google' | 'custom';

export interface ModelConfig {
  id: string;
  name: string;
  provider: AIProviderType;
  model: string;
  maxTokens: number;
  costPerInputMTok: number;
  costPerOutputMTok: number;
}

export interface AIGenerateParams {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  cacheControl?: boolean;  // enable prompt caching
  stream?: boolean;
}

export interface AIGenerateResult {
  content: string;
  tokensUsed: { input: number; output: number };
  model: string;
  cached: boolean;
}

// === AGENT ROLES ===

export type AgentRole = 'generator' | 'reviewer' | 'congruence';

export interface AgentConfig {
  role: AgentRole;
  modelConfigId: string;
  temperature: number;
  maxRetries: number;
  scoreThreshold: number;
}

// === UI ===

export interface PipelineStep {
  gateId: GateId;
  label: string;
  icon: string;
  status: GateStatus;
}
