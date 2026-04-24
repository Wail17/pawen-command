// ============================================================
// PAWEN — Phase U — Autonomous-mode feature flags (client + server)
// All defaults OFF so legacy behavior is preserved until explicitly enabled.
// ============================================================

function boolish(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.toLowerCase().trim();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

// Client-readable (needs NEXT_PUBLIC_ prefix). Master switch.
export function isAutonomousModeEnabled(): boolean {
  return boolish(process.env.NEXT_PUBLIC_USE_AUTONOMOUS_MODE);
}

// Client-readable. Governs automatic constitution refresh.
export function isAutoConstitutionEnabled(): boolean {
  return boolish(process.env.NEXT_PUBLIC_AUTO_CONSTITUTION);
}

// Server-only.
export function isAutoDistillEnabled(): boolean {
  return boolish(process.env.AUTO_DISTILL);
}

// Server-only.
export function isAutoRerunEnabled(): boolean {
  return boolish(process.env.AUTO_RERUN_ON_DROP);
}

// Server-only. Off by default — NOT implemented in U.3 MVP.
export function isAutoPushCreativesEnabled(): boolean {
  return boolish(process.env.AUTO_PUSH_CREATIVES);
}

// Per Q-002. Default 20 invocations per project per day. Overridable via env.
export function getScoutDailyCap(): number {
  const raw = Number(process.env.SCOUT_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

// Per Q-002. Default 3 invocations per gate run. Overridable via env.
export function getScoutPerGateCap(): number {
  const raw = Number(process.env.SCOUT_PER_GATE_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

// Per Q-002. Hard stop if Scout cost estimate exceeds this (USD) for one job.
export function getScoutMaxJobCostUsd(): number {
  const raw = Number(process.env.SCOUT_MAX_JOB_COST_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

// Server-only. Default cadence.
export function getConstitutionRefreshEvery(): number {
  const raw = Number(process.env.CONSTITUTION_REFRESH_EVERY);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}

// --- Phase V flags ---

// Client-readable. Master switch for the chat room.
export function isConversationsEnabled(): boolean {
  return boolish(process.env.NEXT_PUBLIC_CONVERSATIONS_ENABLED);
}

// Server-only. Creates a system conversation on CRITICAL Meta drop.
export function isAutoConversationOnDropEnabled(): boolean {
  return boolish(process.env.AUTO_CONVERSATION_ON_DROP);
}

// Server-only. Creates a standup conversation after a distillation completes.
export function isAutoConversationOnDistillEnabled(): boolean {
  return boolish(process.env.AUTO_CONVERSATION_ON_DISTILL);
}

// Server-only. Per-conversation cost ceiling (USD). Léa forced to close above this.
export function getConversationCostCeilingUsd(): number {
  const raw = Number(process.env.CONVERSATION_COST_CEILING_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

// Server-only. Hard cap on authored messages per conversation.
export function getConversationMaxMessages(): number {
  const raw = Number(process.env.CONVERSATION_MAX_MESSAGES);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

// Server-only. Model Léa uses for routing decisions (lightweight).
export function getLeaRoutingModel(): string {
  return process.env.LEA_ROUTING_MODEL || 'claude-sonnet-4-6';
}
