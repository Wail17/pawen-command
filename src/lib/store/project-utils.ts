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
  'gate7': 'Image Ads',
  'gate8': 'Creative Generation',
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
