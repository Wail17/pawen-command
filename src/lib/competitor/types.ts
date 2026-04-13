// ============================================================
// PAWEN — Gate 1.1: Competitor Funnel Intelligence Types
// ============================================================

export type CompetitorMode = 'clone' | 'reverse';

// === CLONE & TRANSLATE MODE ===

export interface ClonedFunnel {
  original_language: string;
  target_language: string;
  product: {
    name: string;
    description: string;
    price: string;
    images: string[];
  };
  advertorial: {
    headline: string;
    subheadline: string;
    story_opening: string;
    root_cause_section: string;
    mechanism_section: string;
    proof_section: string;
    cta: string;
    full_translated_html: string;
  };
  hooks: string[];
  headlines: string[];
  body_copies: string[];
  ctas: string[];
  testimonials: string[];
  urgency_messages: string[];
  guarantee: string;
  images_found: string[];
  visual_style: {
    colors: string[];
    fonts_detected: string[];
    layout_style: string;
  };
}

// === REVERSE ENGINEER MODE ===

export interface ReverseEngineeredFunnel {
  competitor_url: string;
  competitor_brand: string;

  // Extracted sub-avatar (matching our SubAvatar-like structure)
  sub_avatar: {
    name: string;
    nickname: string;
    description: string;
    demographics: string;
    psychographics: string;
    pain_points: string[];
    desires: string[];
    fears: string[];
    objections: string[];
    trigger_moments: string[];
    awareness_level: string;
    verbatim_quotes: string[];
    identity_statements: string[];
  };

  // Funnel strategy
  mechanism: {
    name: string;
    description: string;
    root_cause: string;
    belief_error: string;
    three_steps: Array<{ step: number; name: string; description: string }>;
  };

  // Copy analysis
  copy_arsenal: {
    hooks: Array<{ text: string; type: string; why_it_works: string }>;
    headlines: string[];
    emotional_triggers: string[];
    proof_points: string[];
    social_proof_strategy: string;
    urgency_tactics: string[];
    guarantee_angle: string;
    cta_strategy: string;
  };

  // Creative analysis
  creative_strategy: {
    visual_style: string;
    color_psychology: string;
    image_types: string[];
    layout_patterns: string[];
    branding_elements: string[];
  };

  // Funnel structure
  funnel_structure: {
    type: string; // "advertorial", "VSL", "quiz", "landing_page", etc.
    stages: Array<{ name: string; description: string; url?: string }>;
    traffic_source_guess: string;
    conversion_flow: string;
  };

  // Strategic insights
  insights: {
    strengths: string[];
    weaknesses: string[];
    opportunities_for_your_market: string[];
    angles_to_steal: string[];
    angles_to_avoid: string[];
  };
}

export interface CompetitorIntelResult {
  mode: CompetitorMode;
  urls_scraped: string[];
  scraped_at: string;
  clone?: ClonedFunnel;
  reverse?: ReverseEngineeredFunnel;
}
