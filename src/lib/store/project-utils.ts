// ============================================================
// PAWEN — Project Utilities
// Create, initialize, manage project state
// ============================================================

import { v4 as uuid } from 'uuid';
import { Project, GateId, GateStatus } from '../types';

const ALL_GATES: GateId[] = [
  'gate1', 'gate2', 'gate3', 'brand-dna',
  'gate4', 'gate5', 'gate6', 'gate7', 'gate8', 'gate9',
];

const GATE_LABELS: Record<GateId, string> = {
  'gate1': 'Avatar Excavation',
  'gate2': 'Avatar Deep Dive',
  'gate3': 'Root Cause & Mechanism',
  'brand-dna': 'Brand DNA',
  'gate4': 'Copy Arsenal',
  'gate5': 'Advertorial',
  'gate6': 'Ad Scripts & Copy',
  'gate7': 'Creative Briefs',
  'gate8': 'Image Generation',
  'gate9': 'Campaign Blueprint',
};

const GATE_SHORT_NAMES: Record<GateId, string> = {
  'gate1': 'G1',
  'gate2': 'G2',
  'gate3': 'G3',
  'brand-dna': 'DNA',
  'gate4': 'G4',
  'gate5': 'G5',
  'gate6': 'G6',
  'gate7': 'G7',
  'gate8': 'G8',
  'gate9': 'G9',
};

export { ALL_GATES, GATE_LABELS, GATE_SHORT_NAMES };

export function createProject(
  name: string,
  targetLanguage: string = 'en-US',
  targetMarket: string = 'United States',
): Project {
  const now = new Date().toISOString();

  const gateStatuses: Record<GateId, GateStatus> = {} as Record<GateId, GateStatus>;
  for (const gate of ALL_GATES) {
    gateStatuses[gate] = gate === 'gate1' ? 'available' : 'locked';
  }

  // The new pipeline starts from CORE AVATAR (Gate 1), not from product
  // research. productUrl/productDescription/niche are populated later
  // by the Core Avatar form inside Gate 1.
  return {
    id: uuid(),
    name,
    productUrl: '',
    productDescription: '',
    targetLanguage,
    sourceLanguage: 'en-US',
    targetMarket,
    niche: '',
    createdAt: now,
    updatedAt: now,
    currentGate: 'gate1',
    gateStatuses,
    brandDNA: null,
    startAnywhereMode: false,
  };
}

export function getNextGate(currentGate: GateId): GateId | null {
  const idx = ALL_GATES.indexOf(currentGate);
  if (idx === -1 || idx >= ALL_GATES.length - 1) return null;
  return ALL_GATES[idx + 1];
}

export function getPreviousGates(gateId: GateId): GateId[] {
  const idx = ALL_GATES.indexOf(gateId);
  if (idx <= 0) return [];
  return ALL_GATES.slice(0, idx);
}

export function unlockNextGate(project: Project, approvedGateId?: GateId): Project {
  const gateToApprove = approvedGateId || project.currentGate;
  const next = getNextGate(gateToApprove);
  if (!next) {
    return {
      ...project,
      gateStatuses: { ...project.gateStatuses, [gateToApprove]: 'approved' },
      currentGate: gateToApprove,
    };
  }

  const nextStatus = project.gateStatuses[next];
  return {
    ...project,
    gateStatuses: {
      ...project.gateStatuses,
      [gateToApprove]: 'approved',
      [next]: nextStatus === 'approved' ? 'approved' : 'available',
    },
    currentGate: next,
  };
}

/**
 * Set G5 copy format. If 'skipped', marks G5 as skipped and unlocks BOTH
 * G6 (short-form copy) and G7 (creative briefs) immediately. This lets the
 * user bypass long-form copy entirely and jump to statics.
 */
export function setCopyFormat(
  project: Project,
  format: 'advertorial' | 'native' | 'listicle' | 'skipped',
): Project {
  const gateStatuses = { ...project.gateStatuses };

  if (format === 'skipped') {
    gateStatuses.gate5 = 'skipped';
    // Unlock both branches — short-form copy AND statics — independently
    if (gateStatuses.gate6 === 'locked') gateStatuses.gate6 = 'available';
    if (gateStatuses.gate7 === 'locked') gateStatuses.gate7 = 'available';
  } else {
    // User is entering G5 in a specific format — make sure it's available
    if (gateStatuses.gate5 === 'locked' || gateStatuses.gate5 === 'skipped') {
      gateStatuses.gate5 = 'available';
    }
  }

  return {
    ...project,
    selectedCopyFormat: format,
    gateStatuses,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Set G6 ad-script format. If 'skipped', marks G6 as skipped and unlocks G7
 * so the user can go straight to static creatives.
 */
export function setAdScriptFormat(
  project: Project,
  format: 'ugc' | 'vsl' | 'both' | 'skipped',
): Project {
  const gateStatuses = { ...project.gateStatuses };

  if (format === 'skipped') {
    gateStatuses.gate6 = 'skipped';
    if (gateStatuses.gate7 === 'locked') gateStatuses.gate7 = 'available';
  } else {
    if (gateStatuses.gate6 === 'locked' || gateStatuses.gate6 === 'skipped') {
      gateStatuses.gate6 = 'available';
    }
  }

  return {
    ...project,
    selectedAdScriptFormat: format,
    gateStatuses,
    updatedAt: new Date().toISOString(),
  };
}

export function canAccessGate(project: Project, gateId: GateId): boolean {
  if (project.startAnywhereMode) return true;
  return project.gateStatuses[gateId] !== 'locked';
}

export function getGateLabel(gateId: GateId): string {
  return GATE_LABELS[gateId] ?? gateId;
}

export function getGateShortName(gateId: GateId): string {
  return GATE_SHORT_NAMES[gateId] ?? gateId;
}

export function getCompletedGateCount(project: Project): number {
  return ALL_GATES.filter(g => project.gateStatuses[g] === 'approved').length;
}

export function getProgressPercentage(project: Project): number {
  return Math.round((getCompletedGateCount(project) / ALL_GATES.length) * 100);
}
