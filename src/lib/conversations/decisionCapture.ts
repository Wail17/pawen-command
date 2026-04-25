// ============================================================
// PAWEN — Conversation → team-decision capture
//
// When a conversation closes (Léa CLOSE_CONVERSATION or user-initiated
// close that asked for a Léa summary), the summary becomes a long-lived
// memory entry for every agent that participated. From the next gate
// run onwards, those agents see the team's agreement under
// `=== TEAM DECISIONS ===` in their prompt.
// ============================================================

import { v4 as uuid } from 'uuid';
import { saveAgentMemory } from '../store/db';
import type { AgentId, AgentMemoryEntry, Conversation } from '../kb/types';

const KNOWN_AGENT_IDS: AgentId[] = ['sarah', 'marcus', 'alex', 'nina', 'david', 'lea'];

export async function captureTeamDecision(conv: Conversation, summary: string | undefined): Promise<AgentMemoryEntry[]> {
  const trimmed = (summary ?? '').trim();
  if (!trimmed || trimmed.length < 20) return [];

  const targetAgents = (conv.participants ?? [])
    .map(p => p.toLowerCase())
    .filter((p): p is AgentId => (KNOWN_AGENT_IDS as string[]).includes(p));
  if (targetAgents.length === 0) return [];

  const now = new Date().toISOString();
  const entries: AgentMemoryEntry[] = targetAgents.map(agentId => ({
    id: uuid(),
    agentId,
    projectId: conv.projectId,
    type: 'team_decision',
    title: `Team decision · ${conv.title.slice(0, 80)}`,
    content: trimmed.slice(0, 1500),
    confidence: 9,                       // high — team agreed
    context: `conversation:${conv.id}`,
    createdAt: now,
  }));

  for (const e of entries) await saveAgentMemory(e);
  return entries;
}
