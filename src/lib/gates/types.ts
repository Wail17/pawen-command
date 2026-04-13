// ============================================================
// PAWEN — Gate & Sub-Agent Type Definitions
// Architecture: Sub-Agents → Lead Agent → Reviewer → Congruence
// ============================================================

import { GateId, Project } from '../types';

// === SUB-AGENT DEFINITION ===

export interface SubAgentDef {
  id: string;
  name: string;
  model: 'opus' | 'sonnet';
  systemPrompt: (
    project: Project,
    previousOutputs: Record<string, unknown>,
  ) => string;
  userMessage: (
    project: Project,
    previousOutputs: Record<string, unknown>,
    peerOutputs: Record<string, string>,
  ) => string;
  dependsOn?: string[];       // IDs of sub-agents that must finish first
  temperature?: number;        // default 0.7
  maxTokens?: number;          // default from model config
}

export interface SubAgentResult {
  id: string;
  name: string;
  model: string;
  output: string;
  tokensUsed: { input: number; output: number };
  durationMs: number;
}

// === GATE CONFIG (v2 — with sub-agents) ===

export interface GateConfigDef {
  id: GateId;
  description: string;

  // --- Sub-agent architecture (new) ---
  subAgents?: SubAgentDef[];

  // --- Lead agent (compiles sub-agent outputs OR acts as sole generator) ---
  generatorPrompt: (
    project: Project,
    subAgentOutputs?: Record<string, string>,
    previousOutputs?: Record<string, unknown>,
  ) => string;
  userMessage: (
    project: Project,
    previousOutputs: Record<string, unknown>,
    subAgentOutputs?: Record<string, string>,
  ) => string;
  generatorMaxTokens?: number; // override lead agent max output tokens (default: model config)

  // --- Review ---
  reviewerPrompt: string;
  reviewCriteria: string;
  reviewThreshold: number;

  // --- Congruence ---
  hasCongruenceCheck: boolean;
  congruencePrompt?: string;
  congruenceThreshold?: number;
}
