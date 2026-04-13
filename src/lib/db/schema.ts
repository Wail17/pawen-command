// ============================================================
// AutoEcom Lab — Collaborative KB schema (TypeScript types)
// Tables: contributions, curated_knowledge, curation_runs
// ============================================================

// Agents map to the personas defined in src/lib/agents/personas.ts.
// 'general' is a bucket for cross-agent knowledge that doesn't fit one persona.
export type AgentId =
  | 'marcus'   // Customer researcher (avatars)
  | 'alex'     // Copywriter
  | 'nina'     // Creative director
  | 'david'    // Media buyer
  | 'lea'      // PM / Director
  | 'sarah'    // Strategist
  | 'general'; // Cross-agent

export const AGENT_IDS: readonly AgentId[] = [
  'marcus',
  'alex',
  'nina',
  'david',
  'lea',
  'sarah',
  'general',
] as const;

// What kind of knowledge the contributor is dropping.
export type ContributionType =
  | 'rule'          // "Always X", "Never Y"
  | 'example'       // a real ad, a real hook, a case study
  | 'framework'     // a step-by-step process
  | 'anti-pattern'  // a mistake others have made
  | 'resource';     // link / file / course reference

export const CONTRIBUTION_TYPES: readonly ContributionType[] = [
  'rule',
  'example',
  'framework',
  'anti-pattern',
  'resource',
] as const;

export type ContributionStatus =
  | 'pending'   // just submitted, not yet reviewed
  | 'merged'    // Claude merged it into an existing curated entry (duplicate)
  | 'approved'  // promoted into curated_knowledge as a new entry
  | 'rejected'; // admin rejected

export interface Contribution {
  id: string;
  contributor: string;        // app-user tag (Sykss, AIO, …)
  agent_id: AgentId;
  type: ContributionType;
  title: string;
  content: string;            // markdown
  tags: string[];
  attachment_url: string | null;   // Vercel Blob URL (private)
  attachment_name: string | null;  // original filename for display
  attachment_size: number | null;  // bytes
  attachment_type: string | null;  // mime type
  status: ContributionStatus;
  created_at: string;         // ISO
  updated_at: string;
}

export interface CuratedKnowledge {
  id: string;
  agent_id: AgentId;
  type: ContributionType;
  title: string;
  content: string;            // deduped / polished markdown
  tags: string[];
  source_contribution_ids: string[]; // which raw contributions fed this entry
  source_contributors: string[];     // attribution — all contributors who fed it
  approved_by: string;        // app-user tag of the admin who approved
  approved_at: string;
  version: number;            // bumps on each merge
}

export interface CurationRun {
  id: string;
  agent_id: AgentId;
  pending_count: number;
  merged_count: number;
  approved_count: number;
  rejected_count: number;
  claude_reasoning: string;   // what Claude decided and why
  run_by: string;             // admin who triggered
  created_at: string;
}

// === Server-side user registry ===
export type AppUserRole = 'admin' | 'user' | 'blocked';

export interface AppUserRow {
  name: string;
  role: AppUserRole;
  enabled: boolean;
  quota_monthly_usd: number;
  quota_used_usd: number;
  quota_reset_at: string;
  notes: string;
  created_at: string;
  last_seen_at: string | null;
  last_seen_ip: string | null;
}

// === Audit log ===
export interface AuditLogRow {
  id: number;
  user_name: string;
  action: string;             // e.g. "login", "project.create", "gate.save"
  details: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

// === Mirrored project ===
export interface ProjectsMirrorRow {
  id: string;
  owner: string;
  name: string;
  data: Record<string, unknown>;   // full Project object
  created_at: string;
  updated_at: string;
}

// === Mirrored gate output ===
export interface GateOutputsMirrorRow {
  id: string;              // "projectId:gateId"
  project_id: string;
  gate_id: string;
  owner: string;
  status: string;
  data: Record<string, unknown>;   // full GateOutput object
  created_at: string;
  updated_at: string;
}
