// ============================================================
// GATE 1 — AVATAR EXCAVATION (new as of 2026-04-07)
//
// This gate is a CUSTOM PIPELINE gate — it does NOT use the
// standard runGate.ts orchestration (sub-agents → manager → lead → director).
//
// Instead, it runs a 4-phase pipeline defined in:
//   src/lib/avatars/runAvatarExcavation.ts
//
//   Phase 1: Discovery       (1 Sonnet call → hunting plan)
//   Phase 2: Fetching        (REAL scraping via Firecrawl + Tavily)
//   Phase 3: Analyzers       (N Sonnet calls — 1 per source, parallel)
//   Phase 4: Lead Compile    (1 Opus call — Marcus clusters → sub-avatars + angles)
//
// Input  = CoreAvatarInput (surface_desire + niche + product + language + market)
//          Provided manually by the human, NOT derived from product research.
// Output = AvatarRunResult (sub_avatars[] + comparative_table + final_recommendation)
//
// The Gate 1 UI page detects this is an avatar-excavation gate and calls
// runAvatarExcavation() directly instead of runGate().
//
// This GateConfigDef is kept as a minimal shim so Gate 1 still registers
// with the gate registry and appears in the pipeline UI. The generatorPrompt
// / userMessage / reviewerPrompt fields are left empty because runGate.ts
// is not invoked for this gate.
//
// The previous Product Intelligence Gate 1 is archived in gate1-legacy.ts.
// ============================================================

import { GateConfigDef } from './types';

const gate1: GateConfigDef = {
  id: 'gate1',
  description:
    'Avatar Excavation — multi-source deep mining from a human-provided Core Avatar, outputs sub-avatars + angles',

  // No standard sub-agents: the real pipeline lives in runAvatarExcavation.ts
  subAgents: [],

  // Unused — Gate 1 bypasses runGate.ts and calls runAvatarExcavation() directly.
  generatorPrompt: () =>
    'Gate 1 uses the custom Avatar Excavation pipeline. See src/lib/avatars/runAvatarExcavation.ts.',
  userMessage: () => '',

  // The reviewer / director layer is handled inside runAvatarExcavation (Marcus compile step).
  reviewerPrompt: '',
  reviewCriteria: '',
  reviewThreshold: 0,
  hasCongruenceCheck: false,
};

export default gate1;
