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
import { buildGoldOutputsPrompt } from '../learning/inject';

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

  // Inject gold examples (fewer for sub-agents — they're specialists)
  const goldBlock = await buildGoldOutputsPrompt({
    gateId,
    niche: project.niche || '',
    funnel: project.selectedFunnel || 'any',
    maxExamples: 2,
  });
  if (goldBlock) {
    enrichedSystemPrompt += goldBlock + '\n\n';
  }

  // Inject Brand DNA constraints — sub-agents MUST see mechanism lock,
  // forbidden words, voice profile, and conditional-use rules.
  // Without this, sub-agents write copy that violates Brand DNA and the
  // congruence check catches it too late (after lead compilation).
  const brandDNA = project.brandDNA;
  if (brandDNA?.locked) {
    const neverUse = brandDNA.customer_language?.never_use || [];
    const conditionalUse = brandDNA.customer_language?.conditional_use || [];
    const alwaysUse = brandDNA.customer_language?.always_use || [];
    const phrasesToAvoid = brandDNA.voice_profile?.phrases_to_avoid || [];
    const proofPoints = brandDNA.locked_terms?.key_proof_points || [];

    enrichedSystemPrompt += `=== BRAND DNA (DO NOT DEVIATE) ===
MECHANISM: "${brandDNA.locked_terms?.mechanism_name || ''}" — use this EXACT name
ROOT CAUSE: "${brandDNA.locked_terms?.root_cause_one_sentence || ''}" — use this EXACT framing
BELIEF ERROR: "${brandDNA.locked_terms?.belief_error || ''}"
PRODUCT DESCRIPTOR: "${brandDNA.locked_terms?.product_descriptor || ''}"
${neverUse.length ? `FORBIDDEN WORDS: ${neverUse.join(', ')}` : ''}
${phrasesToAvoid.length ? `PHRASES TO AVOID: ${phrasesToAvoid.join(', ')}` : ''}
${conditionalUse.length ? `CONDITIONAL USE: ${conditionalUse.map(c => `"${c.term}" (only in: ${c.allowed_in?.join(', ') || 'ask'})`).join('; ')}` : ''}
${alwaysUse.length ? `ALWAYS USE: ${alwaysUse.join(', ')}` : ''}
VOICE: ${brandDNA.voice_profile?.emotional_tone || ''} | ${brandDNA.voice_profile?.sentence_style || ''} | formality ${brandDNA.voice_profile?.formality_level ?? 'N/A'}/10
${proofPoints.length ? `PROOF POINTS: ${proofPoints.slice(0, 5).join(' | ')}` : ''}
${brandDNA.customer_language?.pain_quotes?.length ? `KEY PAIN QUOTES:\n${brandDNA.customer_language.pain_quotes.slice(0, 5).map(q => `  "${q.quote}" (${q.emotion})`).join('\n')}` : ''}
RULES: Use mechanism name EXACTLY. Never use forbidden words. Only approved customer language.
=== END BRAND DNA ===\n\n`;
  }

  // Inject funnel + sub-avatar strategic context so every sub-agent
  // writes copy calibrated to the chosen awareness level & persona.
  if (project.selectedFunnel || project.selectedSubAvatarId) {
    const parts: string[] = ['=== STRATEGIC CONTEXT ==='];
    if (project.selectedFunnel) {
      const funnelDesc: Record<string, string> = {
        full_unaware: "Prospect doesn't know they have a problem. Disrupt, educate, create the 'aha' moment.",
        problem_aware: "Prospect feels the pain but hasn't searched for solutions. Agitate the wound, then introduce the category.",
        solution_aware: "Prospect knows solutions exist but doesn't know YOUR product. Differentiate via mechanism and proof.",
        product_aware: "Prospect knows your product but hasn't decided. Overcome objections, stack proof, urgency.",
        most_aware: "Ready to buy. Direct response: price, offer, scarcity, bonuses, guarantee.",
        retargeting: "Already engaged. Reminder ads, social proof, limited-time incentive.",
      };
      parts.push(`FUNNEL: ${project.selectedFunnel.toUpperCase().replace(/_/g, ' ')}`);
      parts.push(`STRATEGY: ${funnelDesc[project.selectedFunnel] ?? ''}`);
      parts.push('ALL output MUST be calibrated to this awareness level.');
    }
    if (project.selectedSubAvatarId && project.avatarRunResult) {
      const sa = project.avatarRunResult.sub_avatars.find(
        (s) => s.id === project.selectedSubAvatarId,
      );
      if (sa) {
        parts.push(`FOCUSED SUB-AVATAR: ${sa.name} ("${sa.nickname}")`);
        if (sa.description) parts.push(`DESCRIPTION: ${sa.description}`);
        if (sa.dominant_category) parts.push(`CATEGORY: ${sa.dominant_category}`);
        if (sa.emotional_triggers?.length) parts.push(`TRIGGERS: ${sa.emotional_triggers.join(', ')}`);
      }
    }
    parts.push('=== END STRATEGIC CONTEXT ===\n');
    enrichedSystemPrompt += parts.join('\n') + '\n';
  }

  // Inject product intelligence from Shopify so every sub-agent knows
  // the real product name, price, features, reviews, images.
  if (project.shopifyData) {
    const sd = project.shopifyData;
    const pp: string[] = ['=== PRODUCT INTELLIGENCE ==='];
    pp.push(`PRODUCT: ${sd.productTitle}`);
    if (sd.price) {
      const sym = sd.currency === 'EUR' ? '€' : sd.currency === 'GBP' ? '£' : '$';
      pp.push(`PRICE: ${sym}${sd.price}${sd.compareAtPrice ? ` (was ${sym}${sd.compareAtPrice})` : ''}`);
    }
    if (sd.vendor) pp.push(`BRAND: ${sd.vendor}`);
    if (sd.productType) pp.push(`TYPE: ${sd.productType}`);
    if (sd.productFormat) pp.push(`FORMAT: ${sd.productFormat}`);
    if (sd.variants.length > 1) {
      pp.push(`VARIANTS: ${sd.variants.map(v => v.title).join(', ')}`);
    }
    if (sd.images.length > 0) {
      pp.push(`IMAGES: ${sd.images.length} product images available`);
    }
    if (sd.reviewStats) {
      pp.push(`REVIEWS: ${sd.reviewStats.totalReviews} reviews, avg ${sd.reviewStats.averageRating}/5`);
    }
    if (sd.reviews.length > 0) {
      const topReviews = sd.reviews.filter(r => r.rating >= 4 && r.body.length > 20).slice(0, 3);
      if (topReviews.length > 0) {
        pp.push('TOP REVIEWS:');
        for (const r of topReviews) {
          pp.push(`  ★${r.rating} "${r.body.slice(0, 150)}" — ${r.author}`);
        }
      }
    }
    pp.push('Use REAL product data in your output. Never invent features or claims.');
    pp.push('=== END PRODUCT INTELLIGENCE ===\n');
    enrichedSystemPrompt += pp.join('\n') + '\n';
  }

  enrichedSystemPrompt += '=== YOUR CURRENT TASK ===\n';
  enrichedSystemPrompt += subAgent.systemPrompt(project, previousOutputs);

  // Compact product reminder at END of user message (recency bias fix)
  let productPin = '';
  if (project.shopifyData) {
    const sd = project.shopifyData;
    const sym = sd.currency === 'EUR' ? '€' : sd.currency === 'GBP' ? '£' : '$';
    productPin = `\n\n[PRODUCT: ${sd.productTitle} | ${sym}${sd.price ?? '?'} | ${sd.vendor || ''} | ${sd.reviewStats ? sd.reviewStats.totalReviews + ' reviews ' + sd.reviewStats.averageRating + '/5' : ''}]`;
  }

  const userMsg = subAgent.userMessage(project, previousOutputs, peerOutputs) + productPin;

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
