// ============================================================
// PAWEN — Proactive conversation triggers (client-side helpers)
//
// Wraps /api/conversations/system-start with templated openings
// per trigger type. Fire-and-forget — UI shouldn't wait.
// ============================================================

import { isConversationsEnabled } from '../learning/autonomousMode';

interface ProjectLite {
  id: string;
  name: string;
  niche?: string;
  targetMarket?: string;
}

async function fire(payload: {
  projectId: string;
  trigger: string;
  topic: string;
  opening: string;
  maxChainLength?: number;
}): Promise<{ ok: boolean; conversationId?: string; skipped?: string }> {
  try {
    const res = await fetch('/api/conversations/system-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json() as { ok: boolean; created?: boolean; conversationId?: string; skipped?: string };
    return { ok: true, conversationId: data.conversationId, skipped: data.skipped };
  } catch {
    return { ok: false };
  }
}

// --- Triggers ---

export async function triggerOnGateApproved(args: {
  project: ProjectLite;
  gateId: string;
  score: number;
  outputPreview?: string;
}): Promise<void> {
  if (!isConversationsEnabled()) return;
  if (args.score < 85) return; // only celebrate / debate winning outputs
  void fire({
    projectId: args.project.id,
    trigger: 'GATE_APPROVED',
    topic: `Gate ${args.gateId} approved on ${args.project.name} (${args.score}%)`,
    opening: `Team — ${args.gateId} just landed at ${args.score}% on ${args.project.name}${args.project.niche ? ` (${args.project.niche})` : ''}. Quick debrief: what worked, what should we lock for the next sub-avatar variant? 2-3 sentences each, then I'll close with the pattern to remember.`,
    maxChainLength: 3,
  });
}

export async function triggerOnGoldPick(args: {
  project: ProjectLite;
  sectionPath: string;
  content: string;
}): Promise<void> {
  if (!isConversationsEnabled()) return;
  void fire({
    projectId: args.project.id,
    trigger: 'GOLD_PICK',
    topic: `User picked a ${args.sectionPath} on ${args.project.name}`,
    opening: `Team — the user just picked this in the ${args.sectionPath} bucket on ${args.project.name}:\n\n"${args.content.slice(0, 300).replace(/\n+/g, ' ')}"\n\n@alex @marcus — what made this one hit? Pattern to extract for the next batch?`,
    maxChainLength: 2,
  });
}

export async function triggerStandup(args: {
  project: ProjectLite;
}): Promise<void> {
  if (!isConversationsEnabled()) return;
  void fire({
    projectId: args.project.id,
    trigger: 'STANDUP',
    topic: `Standup — ${args.project.name}`,
    opening: `Team — quick standup on ${args.project.name}${args.project.niche ? ` (${args.project.niche})` : ''}. Where are we, what's blocking, what's the next concrete move? Each agent: ONE sentence on your area. I'll close with the priority list.`,
    maxChainLength: 4,
  });
}

export async function triggerIdleCheckin(args: {
  project: ProjectLite;
  minutesIdle: number;
}): Promise<void> {
  if (!isConversationsEnabled()) return;
  if (args.minutesIdle < 20) return;
  void fire({
    projectId: args.project.id,
    trigger: 'IDLE_CHECKIN',
    topic: `Idle check on ${args.project.name}`,
    opening: `Team — ${args.minutesIdle}m of silence on ${args.project.name}. What's the unresolved question we should be working on? Be honest if there's nothing — I'll close immediately.`,
    maxChainLength: 2,
  });
}
