// ============================================================
// PAWEN — Sub-Agent Orchestration Engine v2
// Now with: Agent Personas + KB Knowledge + Memory injection
// Runs sub-agents in parallel (respecting dependencies),
// collects outputs, feeds them to the Lead Agent.
// ============================================================

import { SubAgentDef, SubAgentResult } from '../gates/types';
import { Project, GenerationLogEntry } from '../types';
import { MODEL_REGISTRY } from '../ai/providers';
import { getKnowledgeForGate, getTrainingChunksForGate } from '../store/db';
import { getPersonaForSubAgent, buildPersonaPrompt, buildKnowledgePrompt, buildMemoryPrompt, buildTrainingPrompt } from './personas';
import { getRelevantMemories } from './memory';

// Model mapping for sub-agents
const SUB_AGENT_MODELS = {
  opus: MODEL_REGISTRY['opus-4-6'],
  sonnet: MODEL_REGISTRY['sonnet-4-6'],
} as const;

async function callSubAgent(
  subAgent: SubAgentDef,
  project: Project,
  previousOutputs: Record<string, unknown>,
  peerOutputs: Record<string, string>,
  gateId: string,
): Promise<SubAgentResult> {
  const modelConfig = SUB_AGENT_MODELS[subAgent.model];
  const start = Date.now();

  // Get persona, KB knowledge, training chunks, and memories for this sub-agent
  const persona = getPersonaForSubAgent(subAgent.id);
  const knowledge = await getKnowledgeForGate(gateId);
  const trainingChunks = await getTrainingChunksForGate(gateId);
  const memories = persona ? await getRelevantMemories(persona.id, 5) : [];

  // Build enriched system prompt: persona + training + knowledge + experience + task
  let enrichedSystemPrompt = '';

  if (persona) {
    enrichedSystemPrompt += buildPersonaPrompt(persona) + '\n\n';
  }

  if (trainingChunks.length > 0) {
    enrichedSystemPrompt += buildTrainingPrompt(
      trainingChunks.map(c => ({ sourceName: c.sourceName, content: c.content, summary: c.summary }))
    ) + '\n\n';
  }

  if (knowledge.length > 0) {
    enrichedSystemPrompt += buildKnowledgePrompt(
      knowledge.map(k => ({ title: k.title, content: k.content, keyTakeaway: k.keyTakeaway }))
    ) + '\n\n';
  }

  if (memories.length > 0) {
    enrichedSystemPrompt += buildMemoryPrompt(
      memories.map(m => ({ title: m.title, content: m.content, confidence: m.confidence }))
    ) + '\n\n';
  }

  enrichedSystemPrompt += '=== YOUR CURRENT TASK ===\n';
  enrichedSystemPrompt += subAgent.systemPrompt(project, previousOutputs);

  const userMsg = subAgent.userMessage(project, previousOutputs, peerOutputs);

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelConfig.model,
      systemPrompt: enrichedSystemPrompt,
      userMessage: userMsg,
      temperature: subAgent.temperature ?? 0.7,
      maxTokens: subAgent.maxTokens ?? modelConfig.maxTokens,
      cacheControl: true,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Sub-agent "${subAgent.name}" failed: ${error.message || 'API error'}`);
  }

  const result = await response.json();

  return {
    id: subAgent.id,
    name: subAgent.name,
    model: modelConfig.model,
    output: result.content,
    tokensUsed: result.tokensUsed,
    durationMs: Date.now() - start,
  };
}

// Topological sort: returns sub-agents grouped by execution wave
function buildExecutionWaves(subAgents: SubAgentDef[]): SubAgentDef[][] {
  const resolved = new Set<string>();
  const waves: SubAgentDef[][] = [];

  let remaining = [...subAgents];
  let safetyCounter = 0;

  while (remaining.length > 0 && safetyCounter < 20) {
    safetyCounter++;
    const wave: SubAgentDef[] = [];
    const stillRemaining: SubAgentDef[] = [];

    for (const agent of remaining) {
      const deps = agent.dependsOn ?? [];
      if (deps.every(d => resolved.has(d))) {
        wave.push(agent);
      } else {
        stillRemaining.push(agent);
      }
    }

    if (wave.length === 0) {
      waves.push(stillRemaining);
      break;
    }

    waves.push(wave);
    for (const a of wave) resolved.add(a.id);
    remaining = stillRemaining;
  }

  return waves;
}

export interface RunSubAgentsParams {
  subAgents: SubAgentDef[];
  project: Project;
  gateId: string;
  previousOutputs: Record<string, unknown>;
  onSubAgentStart?: (agentId: string, agentName: string) => void;
  onSubAgentComplete?: (result: SubAgentResult) => void;
  onLogEntry?: (entry: GenerationLogEntry) => void;
}

export interface RunSubAgentsResult {
  outputs: Record<string, string>;
  results: SubAgentResult[];
  totalTokens: { input: number; output: number };
  log: GenerationLogEntry[];
}

export async function runSubAgents(params: RunSubAgentsParams): Promise<RunSubAgentsResult> {
  const {
    subAgents,
    project,
    gateId,
    previousOutputs,
    onSubAgentStart,
    onSubAgentComplete,
    onLogEntry,
  } = params;

  const outputs: Record<string, string> = {};
  const results: SubAgentResult[] = [];
  const log: GenerationLogEntry[] = [];
  const totalTokens = { input: 0, output: 0 };

  const waves = buildExecutionWaves(subAgents);

  for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
    const wave = waves[waveIdx];

    const wavePromises = wave.map(async (agent) => {
      onSubAgentStart?.(agent.id, agent.name);

      try {
        const result = await callSubAgent(agent, project, previousOutputs, outputs, gateId);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const failResult: SubAgentResult = {
          id: agent.id,
          name: agent.name,
          model: SUB_AGENT_MODELS[agent.model].model,
          output: `[ERROR] ${message}`,
          tokensUsed: { input: 0, output: 0 },
          durationMs: 0,
        };
        return failResult;
      }
    });

    const waveResults = await Promise.all(wavePromises);

    for (const result of waveResults) {
      outputs[result.id] = result.output;
      results.push(result);
      totalTokens.input += result.tokensUsed.input;
      totalTokens.output += result.tokensUsed.output;

      const persona = getPersonaForSubAgent(result.id);
      const logEntry: GenerationLogEntry = {
        timestamp: new Date().toISOString(),
        agent: 'sub-agent',
        model: result.model,
        iteration: waveIdx + 1,
        input_summary: `${persona ? persona.emoji + ' ' + persona.name : ''} → ${result.name} (wave ${waveIdx + 1})`,
        output_summary: result.output.slice(0, 200) + '...',
        tokens_used: result.tokensUsed,
      };
      log.push(logEntry);
      onLogEntry?.(logEntry);
      onSubAgentComplete?.(result);
    }
  }

  return { outputs, results, totalTokens, log };
}
