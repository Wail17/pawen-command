// ============================================================
// PAWEN — runGate v4 — Management Hierarchy
// Sub-Agents → Manager Review → Lead Agent → Léa Director → Congruence
// Like a real agency: workers → manager → director
// ============================================================

import { GateOutput, GateId, ReviewResult, CongruenceResult, BrandDNA, GenerationLogEntry, Project } from '../types';
import { GateConfigDef } from '../gates/types';
import { getModelForRole } from '../ai/providers';
import { saveGateOutput, getKnowledgeForGate } from '../store/db';
import { runSubAgents } from './runSubAgents';
import { AGENT_PERSONAS, getPersonaForGate, buildPersonaPrompt, buildKnowledgePrompt, buildMemoryPrompt, buildTrainingPrompt } from './personas';
import { getRelevantMemories, learnFromErrors } from './memory';
import { getTrainingChunksForGate } from '../store/db';

export interface RunGateParams {
  gateId: GateId;
  projectId: string;
  project: Project;
  config: GateConfigDef;
  previousGateOutputs: Record<string, unknown>;
  maxReviewIterations: number;
  maxCongruenceIterations?: number;
  onStreamChunk?: (chunk: string) => void;
  onStatusChange?: (status: string) => void;
  onLogEntry?: (entry: GenerationLogEntry) => void;
}

export interface ManagerReviewResult {
  reviews: {
    agentId: string;
    agentName: string;
    score: number;
    verdict: 'APPROVED' | 'WEAK' | 'REJECTED';
    feedback: string;
  }[];
  overallAssessment: string;
  managerName: string;
  managerEmoji: string;
}

export interface RunGateResult {
  output: string;
  parsedOutput: Record<string, unknown>;
  managerReview?: ManagerReviewResult | null;
  reviewResult: ReviewResult | null;
  congruenceResult: CongruenceResult | null;
  generationLog: GenerationLogEntry[];
  subAgentOutputs?: Record<string, string>;
  status: 'pending_decisions' | 'stuck' | 'error';
  totalTokens: { input: number; output: number };
}

// Helper to call our API routes
async function callAPI(
  endpoint: string,
  body: Record<string, unknown>,
  onStreamChunk?: (chunk: string) => void,
  stream = false,
): Promise<{ content: string; tokensUsed: { input: number; output: number } }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API call failed');
  }

  if (stream && onStreamChunk) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body for streaming');

    const decoder = new TextDecoder();
    let fullContent = '';
    let tokensUsed = { input: 0, output: 0 };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullContent += parsed.delta.text;
              onStreamChunk(parsed.delta.text);
            }
            if (parsed.type === 'message_start' && parsed.message?.usage) {
              tokensUsed.input = parsed.message.usage.input_tokens;
            }
            if (parsed.type === 'message_delta' && parsed.usage) {
              tokensUsed.output = parsed.usage.output_tokens;
            }
          } catch { /* skip */ }
        }
      }
    }

    return { content: fullContent, tokensUsed };
  }

  return response.json();
}

// Extract JSON from text — balanced brace matching
function extractJSON(text: string): Record<string, unknown> {
  // Strategy 1: ```json fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* fall through */ }
  }
  // Strategy 2: balanced braces
  const startIdx = text.indexOf('{');
  if (startIdx !== -1) {
    let depth = 0;
    let endIdx = startIdx;
    for (let ci = startIdx; ci < text.length; ci++) {
      if (text[ci] === '{') depth++;
      else if (text[ci] === '}') { depth--; if (depth === 0) { endIdx = ci; break; } }
    }
    try { return JSON.parse(text.slice(startIdx, endIdx + 1)); } catch { /* fall through */ }
  }
  return { rawContent: text };
}

export async function runGate(params: RunGateParams): Promise<RunGateResult> {
  const {
    gateId,
    projectId,
    project,
    config,
    previousGateOutputs,
    maxReviewIterations,
    onStreamChunk,
    onStatusChange,
    onLogEntry,
  } = params;

  const generationLog: GenerationLogEntry[] = [];
  const totalTokens = { input: 0, output: 0 };
  const generatorModel = getModelForRole('generator');
  const reviewerModel = getModelForRole('reviewer');

  function addLog(entry: Omit<GenerationLogEntry, 'timestamp'>) {
    const log: GenerationLogEntry = { ...entry, timestamp: new Date().toISOString() };
    generationLog.push(log);
    onLogEntry?.(log);
  }

  function addTokens(tokens: { input: number; output: number }) {
    totalTokens.input += tokens.input;
    totalTokens.output += tokens.output;
  }

  // Build Brand DNA injection prefix
  const brandDNA = project.brandDNA;
  let brandDNAPrefix = '';
  if (brandDNA?.locked) {
    brandDNAPrefix = `=== BRAND DNA (DO NOT DEVIATE) ===
${JSON.stringify(brandDNA, null, 2)}

RULES:
1. Mechanism name EXACTLY as written: "${brandDNA.locked_terms.mechanism_name}"
2. Root cause framing EXACTLY as written
3. ONLY customer language from the approved quote bank
4. Words in "never_use" are FORBIDDEN
5. Words in "conditional_use" — check allowed_in for this gate
6. Follow the emotional arc for this touchpoint
7. Same proof points — do not invent new ones
8. Visual metaphor maintained if exists

=== GATE-SPECIFIC INSTRUCTIONS ===
`;
  }

  // Build previous outputs context
  let previousContext = '';
  if (previousGateOutputs && Object.keys(previousGateOutputs).length > 0) {
    previousContext = `=== PREVIOUS GATE OUTPUTS (for context) ===
${JSON.stringify(previousGateOutputs, null, 2)}

=== CURRENT GATE INPUT ===
`;
  }

  // Build persona + KB + training + memory enrichment for lead agent
  const leadPersona = getPersonaForGate(gateId);
  const kbEntries = await getKnowledgeForGate(gateId);
  const trainingChunks = await getTrainingChunksForGate(gateId);
  const leadMemories = await getRelevantMemories(leadPersona.id, 8);

  let personaPrefix = buildPersonaPrompt(leadPersona) + '\n\n';
  if (trainingChunks.length > 0) {
    personaPrefix += buildTrainingPrompt(
      trainingChunks.map(c => ({ sourceName: c.sourceName, content: c.content, summary: c.summary }))
    ) + '\n\n';
  }
  if (kbEntries.length > 0) {
    personaPrefix += buildKnowledgePrompt(
      kbEntries.map(k => ({ title: k.title, content: k.content, keyTakeaway: k.keyTakeaway }))
    ) + '\n\n';
  }
  if (leadMemories.length > 0) {
    personaPrefix += buildMemoryPrompt(
      leadMemories.map(m => ({ title: m.title, content: m.content, confidence: m.confidence, type: m.type }))
    ) + '\n\n';
  }

  try {
    // ================================================================
    // PHASE 0: SUB-AGENTS (workers do the actual work)
    // ================================================================
    let subAgentOutputs: Record<string, string> | undefined;

    if (config.subAgents && config.subAgents.length > 0) {
      onStatusChange?.('running_sub_agents');

      const subResult = await runSubAgents({
        subAgents: config.subAgents,
        project,
        gateId,
        previousOutputs: previousGateOutputs,
        onSubAgentStart: (id, name) => {
          onStatusChange?.(`sub_agent:${name}`);
        },
        onSubAgentComplete: (result) => {
          addTokens(result.tokensUsed);
        },
        onLogEntry: (entry) => {
          generationLog.push(entry);
          onLogEntry?.(entry);
        },
      });

      subAgentOutputs = subResult.outputs;

      addLog({
        agent: 'sub-agent',
        model: 'multi',
        iteration: 0,
        input_summary: `${config.subAgents.length} sub-agents completed`,
        output_summary: `Total sub-agent tokens: ${subResult.totalTokens.input}in / ${subResult.totalTokens.output}out`,
        tokens_used: subResult.totalTokens,
      });
    }

    // ================================================================
    // PHASE 1: MANAGER REVIEW (gate persona judges sub-agent work)
    // The manager scores each sub-agent output, flags weak ones,
    // and provides guidance for the lead agent compilation.
    // ================================================================
    let managerReview: ManagerReviewResult | null = null;

    if (subAgentOutputs && Object.keys(subAgentOutputs).length > 0) {
      onStatusChange?.('manager_review');

      const managerModel = getModelForRole('manager');
      const managerPersona = getPersonaForGate(gateId);

      // Build manager's enriched prompt (persona + memories)
      const managerMemories = await getRelevantMemories(managerPersona.id, 5);
      let managerSystemPrompt = buildPersonaPrompt(managerPersona) + '\n\n';

      if (managerMemories.length > 0) {
        managerSystemPrompt += buildMemoryPrompt(
          managerMemories.map(m => ({ title: m.title, content: m.content, confidence: m.confidence, type: m.type }))
        ) + '\n\n';
      }

      managerSystemPrompt += `=== YOUR ROLE: MANAGER REVIEW ===
You are reviewing your team's work before it gets compiled into the final deliverable.
You are ${managerPersona.name}, the ${managerPersona.role}. This is YOUR team — YOU are responsible for the quality.

YOUR DECISION STYLE: ${managerPersona.decisionStyle}

INSTRUCTIONS:
1. Review EACH sub-agent output individually
2. Score each one from 1-10 based on quality, relevance, and depth
3. For outputs scoring below 6: provide SPECIFIC feedback on what's wrong
4. For outputs scoring 6-7: note what could be improved
5. For outputs scoring 8+: note what they did well
6. Give your overall assessment as the manager — is this team's work ready?

Be honest. Be demanding. Your reputation depends on the quality you let through.

Respond in valid JSON:
{
  "reviews": [
    {
      "agentId": "the-sub-agent-id",
      "agentName": "the-sub-agent-name",
      "score": 1-10,
      "verdict": "APPROVED|WEAK|REJECTED",
      "feedback": "your specific feedback as their manager"
    }
  ],
  "overallAssessment": "your assessment — what's strong, what's weak, what the lead agent should focus on when compiling",
  "compilationGuidance": "specific instructions for the lead agent on how to compile this work — what to emphasize, what to downplay, what to fix"
}`;

      // Build sub-agent output listing with names
      const subAgentEntries = Object.entries(subAgentOutputs).map(([id, output]) => {
        const agentDef = config.subAgents?.find(s => s.id === id);
        return `--- ${agentDef?.name || id} (${id}) ---\n${output}`;
      }).join('\n\n');

      const managerResponse = await callAPI('/api/generate', {
        model: managerModel.model,
        systemPrompt: managerSystemPrompt,
        userMessage: `=== SUB-AGENT OUTPUTS TO REVIEW ===\n\n${subAgentEntries}`,
        temperature: 0.4,
        maxTokens: 4096,
        cacheControl: true,
      });

      addTokens(managerResponse.tokensUsed);

      const managerParsed = extractJSON(managerResponse.content);
      if (managerParsed.reviews) {
        managerReview = {
          reviews: (managerParsed.reviews as Record<string, unknown>[]).map(r => ({
            agentId: String(r.agentId || ''),
            agentName: String(r.agentName || ''),
            score: Number(r.score) || 5,
            verdict: (String(r.verdict) as 'APPROVED' | 'WEAK' | 'REJECTED') || 'APPROVED',
            feedback: String(r.feedback || ''),
          })),
          overallAssessment: String(managerParsed.overallAssessment || ''),
          managerName: managerPersona.name,
          managerEmoji: managerPersona.emoji,
        };
      }

      addLog({
        agent: 'manager',
        model: managerModel.model,
        iteration: 1,
        input_summary: `${managerPersona.emoji} ${managerPersona.name} reviewing ${Object.keys(subAgentOutputs).length} sub-agent outputs`,
        output_summary: managerReview
          ? `Scores: ${managerReview.reviews.map(r => `${r.agentName}=${r.score}/10`).join(', ')}`
          : 'Manager review completed',
        tokens_used: managerResponse.tokensUsed,
      });

      // If manager rejected any outputs, re-run those sub-agents with feedback
      const rejected = managerReview?.reviews.filter(r => r.verdict === 'REJECTED') || [];
      if (rejected.length > 0 && config.subAgents) {
        onStatusChange?.('manager_revision');

        const rerunAgents = config.subAgents.filter(sa =>
          rejected.some(r => r.agentId === sa.id)
        );

        if (rerunAgents.length > 0) {
          // Re-run rejected sub-agents with manager's feedback injected
          const rerunResult = await runSubAgents({
            subAgents: rerunAgents.map(sa => ({
              ...sa,
              // Wrap the original system prompt to include manager feedback
              systemPrompt: (proj: typeof project, prev: Record<string, unknown>) => {
                const rejection = rejected.find(r => r.agentId === sa.id);
                return `${sa.systemPrompt(proj, prev)}

=== MANAGER FEEDBACK (${managerPersona.name} — your manager — REJECTED your previous work) ===
${rejection?.feedback || 'Improve quality.'}
=== YOU MUST ADDRESS THIS FEEDBACK. DO NOT REPEAT THE SAME MISTAKES. ===`;
              },
            })),
            project,
            gateId,
            previousOutputs: previousGateOutputs,
            onSubAgentStart: (id, name) => {
              onStatusChange?.(`revision:${name}`);
            },
            onSubAgentComplete: (result) => {
              addTokens(result.tokensUsed);
            },
            onLogEntry: (entry) => {
              generationLog.push(entry);
              onLogEntry?.(entry);
            },
          });

          // Replace rejected outputs with revised ones
          for (const [id, output] of Object.entries(rerunResult.outputs)) {
            subAgentOutputs[id] = output;
          }

          addLog({
            agent: 'manager',
            model: managerModel.model,
            iteration: 2,
            input_summary: `${managerPersona.emoji} ${managerPersona.name} re-ran ${rejected.length} rejected sub-agents`,
            output_summary: `Revised: ${rejected.map(r => r.agentName).join(', ')}`,
            tokens_used: rerunResult.totalTokens,
          });
        }
      }
    }

    // ================================================================
    // PHASE 2: LEAD AGENT / GENERATOR (Opus)
    // Compiles sub-agent outputs + manager's guidance into final output
    // ================================================================
    onStatusChange?.('generating');

    // Include manager's compilation guidance in the system prompt
    let managerGuidance = '';
    if (managerReview) {
      const managerParsedFull = managerReview;
      managerGuidance = `\n\n=== MANAGER ASSESSMENT (from ${managerParsedFull.managerEmoji} ${managerParsedFull.managerName}) ===
${managerParsedFull.overallAssessment}

SUB-AGENT SCORES:
${managerParsedFull.reviews.map(r =>
  `- ${r.agentName}: ${r.score}/10 (${r.verdict}) — ${r.feedback}`
).join('\n')}
=== USE THIS ASSESSMENT TO GUIDE YOUR COMPILATION ===\n`;
    }

    const systemPrompt = personaPrefix + brandDNAPrefix + managerGuidance + config.generatorPrompt(project, subAgentOutputs);
    const userMsg = previousContext + config.userMessage(project, previousGateOutputs, subAgentOutputs);

    let genResult = await callAPI(
      '/api/generate',
      {
        model: generatorModel.model,
        systemPrompt,
        userMessage: userMsg,
        temperature: 0.7,
        maxTokens: generatorModel.maxTokens,
        cacheControl: true,
      },
      onStreamChunk,
      !!onStreamChunk,
    );

    addTokens(genResult.tokensUsed);
    addLog({
      agent: subAgentOutputs ? 'lead' : 'generator',
      model: generatorModel.model,
      iteration: 1,
      input_summary: subAgentOutputs
        ? `Lead agent compiling ${Object.keys(subAgentOutputs).length} sub-agent outputs${managerReview ? ' (with manager guidance)' : ''}`
        : `Gate ${gateId} generation`,
      output_summary: genResult.content.slice(0, 200) + '...',
      tokens_used: genResult.tokensUsed,
    });

    // ================================================================
    // PHASE 3: DIRECTOR REVIEW — Léa (replaces generic reviewer)
    // Léa reviews with her full persona, personality, and memories.
    // She checks quality, cross-gate consistency, and brand alignment.
    // ================================================================
    onStatusChange?.('director_review');

    const directorModel = getModelForRole('director');
    const leaPersona = AGENT_PERSONAS.lea;
    const leaMemories = await getRelevantMemories(leaPersona.id, 5);

    // Build Léa's enriched review prompt
    let directorPrompt = buildPersonaPrompt(leaPersona) + '\n\n';

    if (leaMemories.length > 0) {
      directorPrompt += buildMemoryPrompt(
        leaMemories.map(m => ({ title: m.title, content: m.content, confidence: m.confidence, type: m.type }))
      ) + '\n\n';
    }

    directorPrompt += `=== YOUR ROLE: DIRECTOR REVIEW ===
You are Léa, the Director of Pawen Agency. You are the FINAL quality gate.
The ${leadPersona.emoji} ${leadPersona.name} (${leadPersona.role}) and their team produced this output.

YOUR JOB:
1. Judge the output against the review criteria below
2. Check cross-gate consistency (does this align with previous gate outputs?)
3. Apply YOUR standards — you are demanding and detail-oriented
4. Score each dimension honestly
5. If it's not good enough, say exactly what needs to change

${config.reviewerPrompt}

You've seen hundreds of outputs. You know what "good" looks like. Don't settle for mediocre.`;

    let reviewResult: ReviewResult | null = null;
    let bestOutput = genResult.content;
    let bestScore = 0;

    for (let i = 0; i < maxReviewIterations; i++) {
      const reviewResponse = await callAPI('/api/review', {
        model: directorModel.model,
        systemPrompt: directorPrompt,
        userMessage: `=== CONTENT TO REVIEW (Gate: ${gateId}) ===
${genResult.content}

=== REVIEW CRITERIA ===
${config.reviewCriteria}

${previousContext ? `=== PREVIOUS GATE OUTPUTS (check consistency) ===\n${previousContext}` : ''}

Respond in valid JSON with this structure:
{
  "score": <number>,
  "maxScore": <number>,
  "dimensions": [{"criterionId": "...", "name": "...", "score": <number>, "maxScore": <number>, "feedback": "..."}],
  "feedback": "your overall assessment as Director — be specific and actionable",
  "passed": <boolean>
}`,
      });

      addTokens(reviewResponse.tokensUsed);

      try {
        const parsed = extractJSON(reviewResponse.content);
        if ('score' in parsed && 'maxScore' in parsed) {
          const percentage = Math.round(((parsed.score as number) / (parsed.maxScore as number)) * 100);
          reviewResult = {
            ...(parsed as unknown as ReviewResult),
            percentage,
            passed: percentage >= config.reviewThreshold,
            iteration: i + 1,
          };
        }
      } catch {
        reviewResult = {
          score: 0,
          maxScore: 100,
          percentage: 0,
          passed: false,
          dimensions: [],
          feedback: reviewResponse.content,
          iteration: i + 1,
        };
      }

      addLog({
        agent: 'director',
        model: directorModel.model,
        iteration: i + 1,
        input_summary: `👑 Léa — Director review iteration ${i + 1}`,
        output_summary: `Score: ${reviewResult!.percentage}% — ${reviewResult!.passed ? 'APPROVED by Léa' : 'Léa says: NEEDS WORK'}`,
        score: reviewResult!.percentage,
        tokens_used: reviewResponse.tokensUsed,
      });

      // Circuit breaker: if score decreased, stop and keep best
      if (reviewResult!.percentage < bestScore && i > 0) {
        addLog({
          agent: 'director',
          model: directorModel.model,
          iteration: i + 1,
          input_summary: 'Circuit breaker — Léa stops the loop',
          output_summary: `Score not improving (${reviewResult!.percentage}% <= ${bestScore}%). Keeping best output.`,
        });
        genResult = { content: bestOutput, tokensUsed: { input: 0, output: 0 } };
        break;
      }

      if (reviewResult!.percentage > bestScore) {
        bestScore = reviewResult!.percentage;
        bestOutput = genResult.content;
      }

      if (reviewResult!.passed) break;

      // Re-generate with Léa's feedback (if not last iteration)
      if (i < maxReviewIterations - 1) {
        onStatusChange?.('director_revision');
        genResult = await callAPI(
          '/api/generate',
          {
            model: generatorModel.model,
            systemPrompt,
            userMessage: `${userMsg}

=== 👑 DIRECTOR FEEDBACK FROM LÉA (address ALL of these issues) ===
${reviewResult!.feedback}

${reviewResult!.dimensions?.map((d: { name: string; score: number; maxScore: number; feedback: string }) =>
  `- ${d.name} (${d.score}/${d.maxScore}): ${d.feedback}`
).join('\n') || ''}

Léa is watching. Fix EVERY issue she flagged. She WILL check again.`,
            temperature: 0.7,
            cacheControl: true,
          },
          onStreamChunk,
          !!onStreamChunk,
        );

        addTokens(genResult.tokensUsed);
        addLog({
          agent: 'lead',
          model: generatorModel.model,
          iteration: i + 2,
          input_summary: `Re-generation with Léa's feedback (iteration ${i + 2})`,
          output_summary: genResult.content.slice(0, 200) + '...',
          tokens_used: genResult.tokensUsed,
        });
      }
    }

    // === ERROR LEARNING: If Léa rejected, save what went wrong ===
    if (reviewResult && !reviewResult.passed) {
      // Lead agent learns from Léa's feedback
      learnFromErrors({
        agentId: leadPersona.id,
        projectId,
        gateId,
        reviewFeedback: reviewResult.feedback || '',
        reviewDimensions: (reviewResult.dimensions || []).map(d => ({
          name: d.name,
          score: d.score,
          maxScore: d.maxScore,
          feedback: d.feedback,
        })),
        reviewScore: reviewResult.percentage,
        projectContext: `${project.name} — ${project.targetMarket} — Léa Director review`,
      }).catch(err => console.error('Error learning failed:', err));

      // Léa also learns (so she remembers recurring problems)
      learnFromErrors({
        agentId: leaPersona.id,
        projectId,
        gateId,
        reviewFeedback: `As Director, I flagged issues in ${gateId}: ${reviewResult.feedback}`,
        reviewDimensions: (reviewResult.dimensions || []).map(d => ({
          name: d.name,
          score: d.score,
          maxScore: d.maxScore,
          feedback: d.feedback,
        })),
        reviewScore: reviewResult.percentage,
        projectContext: `${project.name} — ${project.targetMarket} — Director oversight`,
      }).catch(err => console.error('Léa learning failed:', err));
    }

    // Save checkpoint
    const intermediateOutput: GateOutput = {
      gateId,
      projectId,
      status: 'pending_decisions',
      data: { rawContent: bestOutput },
      generationLog,
      reviewResult,
      congruenceResult: null,
      humanDecisions: {},
      checkpoint: { step: 'post-review', iteration: generationLog.length, intermediateData: {} },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveGateOutput(intermediateOutput);

    // Parse output to structured JSON
    const parsedOutput = extractJSON(bestOutput);

    return {
      output: bestOutput,
      parsedOutput,
      managerReview,
      reviewResult,
      congruenceResult: null,
      generationLog,
      subAgentOutputs,
      status: reviewResult?.passed ? 'pending_decisions' : 'stuck',
      totalTokens,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    addLog({
      agent: 'generator',
      model: generatorModel.model,
      iteration: 0,
      input_summary: 'Error',
      output_summary: message,
    });

    return {
      output: '',
      parsedOutput: {},
      reviewResult: null,
      congruenceResult: null,
      generationLog,
      status: 'error',
      totalTokens,
    };
  }
}

// === CONGRUENCE CHECK (runs after human decisions) ===
export async function runCongruenceCheck(params: {
  gateId: GateId;
  content: string;
  brandDNA: BrandDNA;
  congruencePrompt: string;
  previousGateOutputs: Record<string, unknown>;
  maxIterations?: number;
  threshold?: number;
  onStatusChange?: (status: string) => void;
}): Promise<{
  congruenceResult: CongruenceResult;
  revisedContent: string | null;
  log: GenerationLogEntry[];
}> {
  const {
    gateId,
    content,
    brandDNA,
    congruencePrompt,
    previousGateOutputs,
    maxIterations = 2,
    threshold = 85,
    onStatusChange,
  } = params;

  const log: GenerationLogEntry[] = [];
  const reviewerModel = getModelForRole('congruence');
  const generatorModel = getModelForRole('generator');
  let currentContent = content;
  let congruenceResult: CongruenceResult | null = null;

  for (let i = 0; i < maxIterations; i++) {
    onStatusChange?.('congruence_check');

    const response = await callAPI('/api/congruence', {
      model: reviewerModel.model,
      systemPrompt: congruencePrompt,
      userMessage: `=== BRAND DNA ===
${JSON.stringify(brandDNA, null, 2)}

=== PREVIOUS GATE OUTPUTS ===
${JSON.stringify(previousGateOutputs, null, 2)}

=== CONTENT TO CHECK (Gate: ${gateId}) ===
${currentContent}

Respond in valid JSON:
{
  "score": <number 0-100>,
  "dimensions": {
    "locked_terms_match": <0-20>,
    "customer_language": <0-20>,
    "emotional_arc": <0-15>,
    "cross_gate_consistency": <0-20>,
    "visual_metaphor": <0-10>,
    "forbidden_content": <0-15>
  },
  "driftReport": [{"location": "...", "expected": "...", "found": "...", "severity": "CRITICAL|WARNING|MINOR"}],
  "verdict": "CONGRUENT|NEEDS_ALIGNMENT|REBUILD",
  "alignmentInstructions": "specific fixes..."
}`,
    });

    try {
      const parsed = extractJSON(response.content);
      if ('score' in parsed) {
        congruenceResult = {
          ...(parsed as unknown as CongruenceResult),
          passed: (parsed.score as number) >= threshold,
          iteration: i + 1,
        };
      }
    } catch {
      congruenceResult = {
        score: 0,
        passed: false,
        dimensions: {
          locked_terms_match: 0,
          customer_language: 0,
          emotional_arc: 0,
          cross_gate_consistency: 0,
          visual_metaphor: 0,
          forbidden_content: 0,
        },
        driftReport: [],
        verdict: 'REBUILD',
        alignmentInstructions: response.content,
        iteration: i + 1,
      };
    }

    log.push({
      timestamp: new Date().toISOString(),
      agent: 'congruence',
      model: reviewerModel.model,
      iteration: i + 1,
      input_summary: `Congruence check iteration ${i + 1}`,
      output_summary: `Score: ${congruenceResult!.score}/100 - ${congruenceResult!.verdict}`,
      score: congruenceResult!.score,
      tokens_used: response.tokensUsed,
    });

    if (congruenceResult!.passed) break;

    // Re-generate with alignment instructions
    if (i < maxIterations - 1 && congruenceResult!.alignmentInstructions) {
      onStatusChange?.('realigning');

      const regenResponse = await callAPI('/api/generate', {
        model: generatorModel.model,
        systemPrompt: `=== BRAND DNA (DO NOT DEVIATE) ===
${JSON.stringify(brandDNA, null, 2)}

You are revising content to fix congruence issues. Apply the alignment instructions precisely.`,
        userMessage: `=== ORIGINAL CONTENT ===
${currentContent}

=== ALIGNMENT INSTRUCTIONS ===
${congruenceResult!.alignmentInstructions}

=== DRIFT REPORT ===
${congruenceResult!.driftReport.map((d: { severity: string; location: string; expected: string; found: string }) =>
  `[${d.severity}] ${d.location}: expected "${d.expected}", found "${d.found}"`
).join('\n')}

Revise the content to fix ALL congruence issues. Maintain the same structure and quality.`,
        temperature: 0.5,
        cacheControl: true,
      });

      currentContent = regenResponse.content;

      log.push({
        timestamp: new Date().toISOString(),
        agent: 'generator',
        model: generatorModel.model,
        iteration: i + 1,
        input_summary: `Congruence re-alignment iteration ${i + 1}`,
        output_summary: currentContent.slice(0, 200) + '...',
        tokens_used: regenResponse.tokensUsed,
      });
    }
  }

  return {
    congruenceResult: congruenceResult!,
    revisedContent: currentContent !== content ? currentContent : null,
    log,
  };
}

// Re-export extractJSON for use by other modules
export { extractJSON };
