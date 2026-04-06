// ============================================================
// PAWEN COMMAND CENTER — Core Types
// ============================================================

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
}

export type GateId = 'gate1' | 'gate2' | 'gate3' | 'brand-dna' | 'gate4' | 'gate5' | 'gate6' | 'gate7' | 'gate8' | 'gate9';

export type GateStatus = 'locked' | 'available' | 'in_progress' | 'pending_review' | 'approved';

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
