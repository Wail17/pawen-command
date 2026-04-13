// ============================================================
// PAWEN — Agent Memory & Learning System v2
// Three learning channels:
// 1. Post-approval learnings (what worked)
// 2. Error learnings (what went wrong — reviewer feedback)
// 3. Rejection learnings (human said NO — highest priority)
// ============================================================

import { v4 as uuid } from 'uuid';
import { AgentMemoryEntry, AgentId } from '../kb/types';
import { saveAgentMemory, getAgentMemories } from '../store/db';
import { extractJSON } from '../util/extractJson';

// === CHANNEL 1: Post-approval learnings ===
export async function extractLearnings(params: {
  agentId: AgentId;
  projectId: string;
  gateId: string;
  gateOutput: Record<string, unknown>;
  reviewScore: number;
  projectContext: string;
}): Promise<AgentMemoryEntry[]> {
  const { agentId, projectId, gateId, gateOutput, reviewScore, projectContext } = params;

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      systemPrompt: `You are an AI agent reflecting on work you just completed. Extract 2-4 learnings.

Focus on:
- What worked well and WHY
- Patterns about this product/market/niche that apply to similar projects
- Specific techniques that produced good results
- Anything surprising you discovered

Each learning must be ACTIONABLE for future projects.`,
      userMessage: `CONTEXT: ${projectContext}
GATE: ${gateId}
REVIEW SCORE: ${reviewScore}%

OUTPUT PRODUCED:
${JSON.stringify(gateOutput, null, 2).slice(0, 6000)}

Extract as valid JSON:
{
  "learnings": [
    {
      "type": "learning|opinion|decision",
      "title": "concise title",
      "content": "what you learned and how to apply it next time",
      "confidence": 1-10
    }
  ]
}`,
      temperature: 0.5,
      maxTokens: 2048,
      cacheControl: false,
      stream: false,
    }),
  });

  if (!response.ok) return [];
  const result = await response.json();
  const parsed = extractJSON(result.content);
  if (!parsed) return [];

  const memories: AgentMemoryEntry[] = ((parsed.learnings as Record<string, unknown>[]) || []).map(
    (l) => ({
      id: uuid(),
      agentId,
      projectId,
      type: (String(l.type) || 'learning') as AgentMemoryEntry['type'],
      title: String(l.title || ''),
      content: String(l.content || ''),
      confidence: Number(l.confidence) || 5,
      context: `${projectContext} — ${gateId} (score: ${reviewScore}%)`,
      createdAt: new Date().toISOString(),
    })
  );

  for (const mem of memories) await saveAgentMemory(mem);
  return memories;
}

// === CHANNEL 2: Error learning (from reviewer feedback) ===
export async function learnFromErrors(params: {
  agentId: AgentId;
  projectId: string;
  gateId: string;
  reviewFeedback: string;
  reviewDimensions: { name: string; score: number; maxScore: number; feedback: string }[];
  reviewScore: number;
  projectContext: string;
}): Promise<AgentMemoryEntry[]> {
  const { agentId, projectId, gateId, reviewFeedback, reviewDimensions, reviewScore, projectContext } = params;

  // Only learn from failures (score < 80%)
  if (reviewScore >= 80) return [];

  // Find the weakest dimensions
  const weakDims = reviewDimensions
    .filter(d => (d.score / d.maxScore) < 0.7)
    .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore));

  if (weakDims.length === 0) return [];

  const errors: AgentMemoryEntry[] = weakDims.slice(0, 3).map(dim => ({
    id: uuid(),
    agentId,
    projectId,
    type: 'error' as const,
    title: `ERROR: ${dim.name} scored ${dim.score}/${dim.maxScore}`,
    content: `WHAT WENT WRONG: ${dim.feedback}\n\nNEVER REPEAT THIS. Next time: focus on ${dim.name} quality before submitting. The reviewer specifically flagged: "${dim.feedback}"`,
    confidence: 9, // High confidence — these are hard facts
    context: `${projectContext} — ${gateId} (score: ${reviewScore}%)`,
    createdAt: new Date().toISOString(),
  }));

  // Also save the overall feedback as an error memory
  if (reviewFeedback) {
    errors.push({
      id: uuid(),
      agentId,
      projectId,
      type: 'error' as const,
      title: `REVIEW FAILURE: ${gateId} scored ${reviewScore}%`,
      content: `Overall feedback: ${reviewFeedback}\n\nThis is what the reviewer said. Study it. Don't repeat these mistakes.`,
      confidence: 9,
      context: `${projectContext} — ${gateId}`,
      createdAt: new Date().toISOString(),
    });
  }

  for (const err of errors) await saveAgentMemory(err);
  return errors;
}

// === CHANNEL 3: Human rejection learning (highest priority) ===
export async function learnFromRejection(params: {
  agentId: AgentId;
  projectId: string;
  gateId: string;
  rejectionReason: string;
  projectContext: string;
}): Promise<AgentMemoryEntry> {
  const { agentId, projectId, gateId, rejectionReason, projectContext } = params;

  const memory: AgentMemoryEntry = {
    id: uuid(),
    agentId,
    projectId,
    type: 'rejection',
    title: `HUMAN REJECTED: ${gateId} — "${rejectionReason.slice(0, 80)}"`,
    content: `The human rejected my output for ${gateId}. Their exact words: "${rejectionReason}"\n\nThis is the HIGHEST priority learning. The human's judgment overrides everything. I MUST adjust my approach to avoid this rejection in all future projects.`,
    confidence: 10, // Maximum confidence — human said NO
    context: `${projectContext} — ${gateId} — HUMAN REJECTION`,
    createdAt: new Date().toISOString(),
  };

  await saveAgentMemory(memory);
  return memory;
}

// === MEMORY RETRIEVAL ===

// Get relevant memories, prioritized: rejections > errors > learnings
export async function getRelevantMemories(
  agentId: AgentId,
  maxEntries: number = 10,
): Promise<AgentMemoryEntry[]> {
  const memories = await getAgentMemories(agentId);

  // Priority: rejection (10) > error (9) > learning/opinion/decision (by confidence)
  const typePriority: Record<string, number> = {
    rejection: 100,
    error: 90,
    feedback: 50,
    decision: 30,
    opinion: 20,
    learning: 10,
  };

  return memories
    .sort((a, b) => {
      const aPriority = (typePriority[a.type] || 0) + a.confidence;
      const bPriority = (typePriority[b.type] || 0) + b.confidence;
      if (bPriority !== aPriority) return bPriority - aPriority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, maxEntries);
}

// Get total memory count per agent
export async function getAgentMemoryStats(): Promise<Record<AgentId, number>> {
  const agents: AgentId[] = ['sarah', 'marcus', 'alex', 'nina', 'david', 'lea'];
  const stats: Record<string, number> = {};

  for (const agentId of agents) {
    const memories = await getAgentMemories(agentId);
    stats[agentId] = memories.length;
  }

  return stats as Record<AgentId, number>;
}

// Get error + rejection count (for UI display)
export async function getAgentErrorCount(agentId: AgentId): Promise<number> {
  const memories = await getAgentMemories(agentId);
  return memories.filter(m => m.type === 'error' || m.type === 'rejection').length;
}
