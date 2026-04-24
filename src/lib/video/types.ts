// ============================================================
// PAWEN — Animated Video Ads types
// Scene-by-scene spec for AI animated object ads (Kling / Veo).
// ============================================================

export type ScenePersonality =
  | 'confident'
  | 'playful'
  | 'angry'
  | 'desperate'
  | 'curious'
  | 'authoritative'
  | 'empathetic'
  | 'excited'
  | 'skeptical'
  | 'shocked';

export type SceneDuration = 5 | 10;

export type VideoModel = 'kling-2-5-turbo' | 'kling-2-master' | 'veo-3';

export interface VideoCharacter {
  name: string;                  // e.g. "The Pineapple Doctor"
  object_type: string;           // e.g. "pineapple", "protein bar", "coffee cup"
  visual_style: string;          // e.g. "pixar-style 3D, warm colors"
  wardrobe?: string;             // e.g. "white lab coat, stethoscope"
  voice_tone?: string;
  reference_image_url?: string;  // uploaded or generated reference
}

export interface Scene {
  id: string;
  order: number;
  role: 'hook' | 'problem' | 'agitation' | 'mechanism' | 'proof' | 'cta' | 'transition';
  duration: SceneDuration;
  personality: ScenePersonality;
  environment: string;                  // e.g. "dimly-lit kitchen counter"
  dialogue: string;                     // the VO line
  action: string;                       // what the object does
  companion_object?: string;            // optional 2nd character
  starting_image_prompt: string;        // 9:16 still to generate
  ending_image_prompt?: string;         // optional
  animation_prompt: string;             // prompt to fal.ai kling/veo

  // Generated artifacts
  starting_image_url?: string;
  video_url?: string;
  video_seed?: number;
  generated_at?: string;
  generation_error?: string;
  is_generating_image?: boolean;
  is_generating_video?: boolean;
}

export interface VideoAdScript {
  id: string;
  project_id: string;
  title: string;
  hook_angle: string;                   // which hook this ad targets (from Gate 4)
  sub_avatar_id?: string;
  funnel_position: 'TOF' | 'MOF' | 'BOF';
  target_language: string;
  target_market: string;
  total_duration_s: number;
  aspect_ratio: '9:16' | '16:9' | '1:1';
  character: VideoCharacter;
  scenes: Scene[];
  model_used?: VideoModel;
  created_at: string;
  updated_at: string;

  // Aggregated state
  status: 'draft' | 'images_ready' | 'animating' | 'complete' | 'failed';
  notes?: string;
}
