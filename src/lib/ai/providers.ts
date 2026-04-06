// ============================================================
// PAWEN — Model-Agnostic AI Provider Abstraction
// Switch models/providers by changing config, not code.
// ============================================================

import { AIGenerateParams, AIGenerateResult, AIProviderType, ModelConfig } from '../types';

// === MODEL REGISTRY ===
// Add new models here. That's it. No code changes needed.

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  'opus-4-6': {
    id: 'opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    maxTokens: 16384,
    costPerInputMTok: 5,
    costPerOutputMTok: 25,
  },
  'sonnet-4-6': {
    id: 'sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxTokens: 16384,
    costPerInputMTok: 3,
    costPerOutputMTok: 15,
  },
  'haiku-4-5': {
    id: 'haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 8192,
    costPerInputMTok: 0.8,
    costPerOutputMTok: 4,
  },
  // === ADD NEW MODELS HERE ===
  // 'gpt-5': {
  //   id: 'gpt-5',
  //   name: 'GPT-5',
  //   provider: 'openai',
  //   model: 'gpt-5',
  //   maxTokens: 16384,
  //   costPerInputMTok: 5,
  //   costPerOutputMTok: 15,
  // },
  // 'gemini-3': {
  //   id: 'gemini-3',
  //   name: 'Gemini 3 Ultra',
  //   provider: 'google',
  //   model: 'gemini-3-ultra',
  //   maxTokens: 16384,
  //   costPerInputMTok: 3,
  //   costPerOutputMTok: 12,
  // },
};

// === AGENT ROLE → MODEL MAPPING ===
// Change which model each agent uses here.

export const AGENT_MODEL_MAP = {
  generator: 'opus-4-6',
  reviewer: 'sonnet-4-6',
  congruence: 'sonnet-4-6',
  vision: 'sonnet-4-6',
  compiler: 'opus-4-6',
  manager: 'opus-4-6',     // Gate manager reviews sub-agent work
  director: 'opus-4-6',    // Léa — final quality + cross-gate review
} as const;

export function getModelForRole(role: keyof typeof AGENT_MODEL_MAP): ModelConfig {
  const modelId = AGENT_MODEL_MAP[role];
  const config = MODEL_REGISTRY[modelId];
  if (!config) throw new Error(`Model ${modelId} not found in registry`);
  return config;
}

// === PROVIDER INTERFACE ===

export interface AIProvider {
  generate(model: ModelConfig, params: AIGenerateParams): Promise<AIGenerateResult>;
  generateStream(model: ModelConfig, params: AIGenerateParams): AsyncGenerator<string, AIGenerateResult>;
}

// === PROVIDER REGISTRY ===

const providers: Record<AIProviderType, AIProvider | null> = {
  anthropic: null,
  openai: null,
  google: null,
  custom: null,
};

export function registerProvider(type: AIProviderType, provider: AIProvider) {
  providers[type] = provider;
}

export function getProvider(type: AIProviderType): AIProvider {
  const provider = providers[type];
  if (!provider) throw new Error(`Provider ${type} not registered. Add it in providers.ts`);
  return provider;
}

// === UNIFIED CALL FUNCTION ===

export async function callAI(
  role: keyof typeof AGENT_MODEL_MAP,
  params: AIGenerateParams
): Promise<AIGenerateResult> {
  const modelConfig = getModelForRole(role);
  const provider = getProvider(modelConfig.provider);
  return provider.generate(modelConfig, params);
}

export async function* streamAI(
  role: keyof typeof AGENT_MODEL_MAP,
  params: AIGenerateParams
): AsyncGenerator<string, AIGenerateResult> {
  const modelConfig = getModelForRole(role);
  const provider = getProvider(modelConfig.provider);
  return yield* provider.generateStream(modelConfig, params);
}
