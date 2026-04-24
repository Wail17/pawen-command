// ============================================================
// PAWEN — Sub-Agent Orchestration Engine v2
// Now with: Agent Personas + KB Knowledge + Memory injection
// Runs sub-agents in parallel (respecting dependencies),
// collects outputs, feeds them to the Lead Agent.
// ============================================================

import { SubAgentDef, SubAgentResult } from '../gates/types';
import { Project, GenerationLogEntry } from '../types';
import { MODEL_REGISTRY } from '../ai/providers';
import { getKnowledgeForGate, getTrainingChunksForGate, getPersonaDistillation, getAgentConstitution } from '../store/db';
import { getPersonaForSubAgent, buildPersonaPrompt, buildKnowledgePrompt, buildMemoryPrompt, buildTrainingPrompt } from './personas';
import { getRelevantMemories } from './memory';
import { buildGoldOutputsPrompt } from '../learning/inject';
import { isAutonomousModeEnabled } from '../learning/autonomousMode';
import { AgentId, PersonaDistillation, AgentConstitution } from '../kb/types';
import { runScout } from './scout';
import { getScoutDailyCap, getScoutPerGateCap, getScoutMaxJobCostUsd } from '../learning/autonomousMode';

// Per-agent baked-in expertise (Phase U.1) and self-written rules (Phase U.2).
// Pre-loaded once per gate run and passed through to each sub-agent call.
type AgentAutonomousContext = {
  distillations: Map<AgentId, PersonaDistillation>;
  constitutions: Map<AgentId, AgentConstitution>;
  enabled: boolean;
};

// Model mapping for sub-agents
const SUB_AGENT_MODELS = {
  opus: MODEL_REGISTRY['opus-4-6'],
  sonnet: MODEL_REGISTRY['sonnet-4-6'],
} as const;

// Gate-scoped KB cache: knowledge + training chunks are identical for every
// sub-agent in a gate run, so we fetch them once in runSubAgents and pass
// through rather than hitting IndexedDB N times per wave.
type GateKnowledge = Awaited<ReturnType<typeof getKnowledgeForGate>>;
type GateTrainingChunks = Awaited<ReturnType<typeof getTrainingChunksForGate>>;

async function callSubAgent(
  subAgent: SubAgentDef,
  project: Project,
  previousOutputs: Record<string, unknown>,
  peerOutputs: Record<string, string>,
  gateId: string,
  knowledge: GateKnowledge,
  trainingChunks: GateTrainingChunks,
  autonomousCtx: AgentAutonomousContext,
): Promise<SubAgentResult> {
  const modelConfig = SUB_AGENT_MODELS[subAgent.model];
  const start = Date.now();

  // Persona + memories are still per-agent (they're keyed on persona.id,
  // not gateId). Only the gate-scoped KB reads are now cached upstream.
  const persona = getPersonaForSubAgent(subAgent.id);
  const memories = persona ? await getRelevantMemories(persona.id, 5) : [];

  // Phase U: swap runtime-RAG training chunks for the persona's
  // distilled expertise (baked into the persona prompt) when autonomous
  // mode is ON AND a distillation exists for this persona.
  const distillation = persona && autonomousCtx.enabled
    ? autonomousCtx.distillations.get(persona.id) ?? null
    : null;
  const constitution = persona && autonomousCtx.enabled
    ? autonomousCtx.constitutions.get(persona.id) ?? null
    : null;
  const useBakedInExpertise = !!(autonomousCtx.enabled && distillation);

  // Build enriched system prompt: persona + training + knowledge + experience + task
  let enrichedSystemPrompt = '';

  if (persona) {
    enrichedSystemPrompt += buildPersonaPrompt(persona, { distillation, constitution }) + '\n\n';
  }

  // Phase U.3c — sub-agents opt into the Scout tool when autonomous mode
  // is on. A short protocol section tells the model it may request more
  // intel by emitting a single line in its output:
  //   SCRAPE_REQUEST: <one-sentence intent>
  // The runSubAgents post-process scans for this marker and dispatches
  // Scout. Results are appended to the scoutLedger (see src/lib/store/db).
  if (autonomousCtx.enabled) {
    enrichedSystemPrompt += `=== SCOUT PROTOCOL ===
If — and only if — you need more intel (VOC quotes, competitor ads, recent reviews, etc.) than the context already provides to produce a high-quality output, you may emit EXACTLY ONE line in your response formatted:
  SCRAPE_REQUEST: <one short sentence describing what you need>
Use this sparingly (hard cap: ${getScoutPerGateCap()} Scout calls per gate run, ${getScoutDailyCap()} per project per day). Do NOT request Scout for anything already in the context above.
=== END SCOUT PROTOCOL ===\n\n`;
  }

  if (!useBakedInExpertise && trainingChunks.length > 0) {
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

  // Streamed call helper. With 32k-token Opus calls under tier-1 Anthropic
  // throughput (8k OTPM), a buffered response can exceed the server's 295s
  // AbortSignal ceiling. Streaming keeps the connection alive as tokens
  // arrive and captures partial output if the upstream call hits a hiccup.
  async function streamCall(mt: number) {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelConfig.model,
        systemPrompt: enrichedSystemPrompt,
        userMessage: userMsg,
        temperature: subAgent.temperature ?? 0.7,
        maxTokens: mt,
        cacheControl: true,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'API error');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('no response body for streaming');

    const decoder = new TextDecoder();
    let fullContent = '';
    const tokensUsed = { input: 0, output: 0 };
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullContent += parsed.delta.text;
          }
          if (parsed.type === 'message_start' && parsed.message?.usage) {
            tokensUsed.input = parsed.message.usage.input_tokens ?? 0;
          }
          if (parsed.type === 'message_delta' && parsed.usage) {
            tokensUsed.output = parsed.usage.output_tokens ?? 0;
          }
        } catch { /* skip malformed SSE frames */ }
      }
    }

    return { fullContent, tokensUsed };
  }

  // Fallback cascade: try at full maxTokens first (best quality). On
  // timeout/abort/overload, retry at half (quality drop but still completes
  // under the 295s ceiling on Anthropic tier-1). Users on tier-2+ will almost
  // never hit the fallback; users on tier-1 get graceful degradation instead
  // of a hard crash.
  const primaryMax = subAgent.maxTokens ?? modelConfig.maxTokens;
  const fallbackMax = Math.max(4000, Math.floor(primaryMax / 2));
  let out: { fullContent: string; tokensUsed: { input: number; output: number } };

  try {
    out = await streamCall(primaryMax);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Retry on ANY primary failure (network drop, timeout, rate limit, abort,
    // 5xx) — the fallback budget is smaller so it finishes faster under the
    // 295s ceiling. Only skip the retry when primary already == fallback.
    if (primaryMax <= fallbackMax) {
      throw new Error(`Sub-agent "${subAgent.name}" failed: ${msg}`);
    }
    try {
      out = await streamCall(fallbackMax);
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      throw new Error(`Sub-agent "${subAgent.name}" failed (primary ${primaryMax}tok: ${msg} | fallback ${fallbackMax}tok: ${msg2})`);
    }
  }

  return {
    id: subAgent.id,
    name: subAgent.name,
    model: modelConfig.model,
    output: out.fullContent,
    tokensUsed: out.tokensUsed,
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

  // Fetch gate-scoped KB ONCE per gate run instead of N times per wave.
  // Previously each sub-agent hit IndexedDB to load the same knowledge +
  // training chunks; a 6-agent gate did 12 redundant reads per run.
  const autonomous = isAutonomousModeEnabled();
  const [knowledge, trainingChunks] = await Promise.all([
    getKnowledgeForGate(gateId),
    // Skip the training-chunk pull in autonomous mode; each persona's
    // distillation already embeds this content.
    autonomous ? Promise.resolve([] as Awaited<ReturnType<typeof getTrainingChunksForGate>>) : getTrainingChunksForGate(gateId),
  ]);

  // Preload distillations + constitutions for every persona in the
  // sub-agent list so we don't hit IndexedDB per sub-agent call.
  const autonomousCtx: AgentAutonomousContext = {
    distillations: new Map(),
    constitutions: new Map(),
    enabled: autonomous,
  };
  if (autonomous) {
    const uniqueAgentIds = new Set<AgentId>();
    for (const sa of subAgents) {
      const p = getPersonaForSubAgent(sa.id);
      if (p) uniqueAgentIds.add(p.id);
    }
    await Promise.all(
      [...uniqueAgentIds].map(async (aid) => {
        const [d, c] = await Promise.all([getPersonaDistillation(aid), getAgentConstitution(aid)]);
        if (d) autonomousCtx.distillations.set(aid, d);
        if (c) autonomousCtx.constitutions.set(aid, c);
      }),
    );
  }

  const waves = buildExecutionWaves(subAgents);

  for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
    const wave = waves[waveIdx];

    // Sub-agents within a wave run SEQUENTIALLY, not in parallel. Reason:
    // G2 wave 2 fires desire-driller (opus 32k) + language-miner (opus 24k)
    // simultaneously = 56k output tokens requested concurrently. On Anthropic
    // tier-1 this queues/slows the calls until /api/generate's 295s AbortSignal
    // fires, then retries 4× → ~1180s total hang → gate fails. Serializing
    // within the wave keeps at most 1 Opus call in flight at a time. Slower
    // (wave duration = sum instead of max) but bulletproof under rate limits.
    const waveResults: SubAgentResult[] = [];
    for (const agent of wave) {
      onSubAgentStart?.(agent.id, agent.name);

      try {
        const result = await callSubAgent(agent, project, previousOutputs, outputs, gateId, knowledge, trainingChunks, autonomousCtx);

        // Phase U.3c — detect SCRAPE_REQUEST marker in sub-agent output and
        // dispatch Scout. Fire-and-forget; results are persisted to the
        // scoutLedger and become visible in admin + future gate runs. We
        // do NOT rewrite the current sub-agent output — Scout's role is to
        // enrich the shared signal, not to mutate the active wave.
        if (autonomousCtx.enabled) {
          const match = /^\s*SCRAPE_REQUEST\s*:\s*(.+)$/m.exec(result.output);
          if (match) {
            const intent = match[1].trim().slice(0, 300);
            const persona = getPersonaForSubAgent(agent.id);
            const agentId: AgentId = persona?.id ?? 'lea';
            const gateRunKey = `${project.id}:${gateId}:${Date.now() - (Date.now() % 60000)}`;
            void runScout({
              intent,
              agentId,
              project,
              gateRunKey,
              perGateCap: getScoutPerGateCap(),
              dailyCap: getScoutDailyCap(),
              maxCostUsd: getScoutMaxJobCostUsd(),
            }).catch(() => { /* best-effort, never block the wave */ });
          }
        }

        waveResults.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        waveResults.push({
          id: agent.id,
          name: agent.name,
          model: SUB_AGENT_MODELS[agent.model].model,
          output: `[ERROR] ${message}`,
          tokensUsed: { input: 0, output: 0 },
          durationMs: 0,
        });
      }
    }

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
        raw_output: result.output,
        tokens_used: result.tokensUsed,
      };
      log.push(logEntry);
      onLogEntry?.(logEntry);
      onSubAgentComplete?.(result);
    }
  }

  return { outputs, results, totalTokens, log };
}
