// ============================================================
// PAWEN — Gate Registry v4.0
// Multi-Agent Architecture: Sub-Agents → Lead → Reviewer → Congruence
// Each gate defined in its own file for maintainability
// ============================================================

import { GateId, Project } from '../types';
import { GateConfigDef } from './types';

import gate1 from './gate1';
import gate2 from './gate2';
import gate3 from './gate3';
import gate4 from './gate4';
import gate5 from './gate5';
import gate5Native from './gate5Native';
import gate5Listicle from './gate5Listicle';
import gate6 from './gate6';
import gate7 from './gate7';
import gate8 from './gate8';
import gate9 from './gate9';

// Re-export types for backward compatibility
export type { GateConfigDef } from './types';
export type { SubAgentDef, SubAgentResult } from './types';

const GATE_CONFIGS: Record<string, GateConfigDef> = {
  gate1,
  gate2,
  gate3,
  gate4,
  gate5,
  gate6,
  gate7,
  gate8,
  gate9,
};

export function getGateConfig(gateId: GateId, project?: Project): GateConfigDef {
  if (gateId === 'brand-dna') {
    // Brand DNA is handled by its own page, not the gate runner
    return {
      id: 'brand-dna',
      description: 'Compile & lock the Brand DNA — single source of truth',
      generatorPrompt: () => '',
      userMessage: () => '',
      reviewerPrompt: '',
      reviewCriteria: '',
      reviewThreshold: 0,
      hasCongruenceCheck: false,
    };
  }

  // Gate 5 dispatch — format selector lives on Project.selectedCopyFormat
  if (gateId === 'gate5' && project) {
    switch (project.selectedCopyFormat) {
      case 'native':
        return gate5Native;
      case 'listicle':
        return gate5Listicle;
      case 'skipped':
      case 'advertorial':
      default:
        return gate5;
    }
  }

  const config = GATE_CONFIGS[gateId];
  if (!config) {
    throw new Error(`Unknown gate: ${gateId}`);
  }
  return config;
}

// Sub-agent summary for debugging/UI
export function getGateSubAgentCount(gateId: GateId): number {
  if (gateId === 'brand-dna') return 0;
  const config = GATE_CONFIGS[gateId];
  return config?.subAgents?.length ?? 0;
}

export function getGateSubAgentNames(gateId: GateId): string[] {
  if (gateId === 'brand-dna') return [];
  const config = GATE_CONFIGS[gateId];
  return config?.subAgents?.map(a => a.name) ?? [];
}
