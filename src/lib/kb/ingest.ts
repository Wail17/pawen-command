// ============================================================
// PAWEN — Training Ingestion v2
// Two-layer storage:
// 1. Full-text chunks — the COMPLETE training material, searchable
// 2. Extracted principles — structured knowledge entries
// Agents get BOTH: the full course text + extracted actionable rules
// ============================================================

import { v4 as uuid } from 'uuid';
import { KnowledgeEntry, KnowledgeCategory, TrainingSource, TrainingChunk } from './types';
import { saveKnowledgeEntries, saveTrainingSource, saveTrainingChunks } from '../store/db';

const CHUNK_SIZE = 6000; // chars per chunk — smaller for better retrieval

// Split long text into processable chunks (paragraph-aware)
function chunkText(text: string, maxSize: number = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += para + '\n\n';
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

// Balanced-brace JSON extraction
function extractJSON(text: string): Record<string, unknown> | null {
  let json = text;
  const fence = json.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) json = fence[1];
  const start = json.indexOf('{');
  if (start === -1) return null;
  let depth = 0, end = start;
  for (let i = start; i < json.length; i++) {
    if (json[i] === '{') depth++;
    else if (json[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  try { return JSON.parse(json.slice(start, end + 1)); } catch { return null; }
}

// Process a single chunk: extract principles + classify for gate relevance
async function processChunk(
  chunk: string,
  sourceId: string,
  sourceName: string,
  chunkIndex: number,
): Promise<{ entries: KnowledgeEntry[]; chunkMeta: { summary: string; gates: string[] } }> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      systemPrompt: `You are a training specialist for an AI marketing agency. You read course material and do TWO things:

1. EXTRACT specific, actionable knowledge entries that agents can apply
2. CLASSIFY which gates this chunk is relevant to

The agents need to DEEPLY UNDERSTAND this material — not just remember bullet points. Extract the reasoning, the examples, the nuances. If the trainer gives a specific technique with steps, capture ALL the steps. If they explain WHY something works, capture the WHY.

CATEGORIES: product_research, avatar_research, copywriting, hooks, advertorial, video_scripts, image_ads, media_buying, campaign_strategy, scaling, testing, psychology, mechanism, root_cause, brand_voice, general

GATES: gate1 (product research), gate2 (avatar/customer), gate3 (root cause/mechanism), gate4 (copy arsenal/hooks), gate5 (advertorial), gate6 (ad scripts/body copy), gate7 (image ads), gate8 (creative gen), gate9 (campaign/scaling), all`,
      userMessage: `SOURCE: "${sourceName}" (chunk ${chunkIndex + 1})

CONTENT TO LEARN:
${chunk}

Output valid JSON:
{
  "summary": "2-3 sentence summary of what this chunk teaches",
  "applicableGates": ["gate1", "gate4", ...],
  "entries": [
    {
      "title": "concise but specific title",
      "content": "the FULL knowledge — include steps, reasoning, examples, nuances. An agent reading only this entry should understand the concept completely.",
      "keyTakeaway": "one actionable sentence",
      "category": "one of the categories",
      "importance": "critical|important|nice_to_know",
      "tags": ["tag1", "tag2"],
      "applicableGates": ["gate1", "gate4", ...]
    }
  ]
}

RULES:
- Extract 3-10 entries per chunk
- Each entry must be SELF-CONTAINED — an agent should be able to apply it without reading the original
- Capture TECHNIQUES with ALL their steps
- Capture REASONING — why does this work?
- Capture EXAMPLES if the trainer gives them
- If the trainer says "NEVER do X" or "ALWAYS do Y" — these are CRITICAL entries`,
      temperature: 0.3,
      maxTokens: 8192,
      cacheControl: false,
      stream: false,
    }),
  });

  if (!response.ok) {
    console.error('Knowledge extraction failed for chunk', chunkIndex);
    return { entries: [], chunkMeta: { summary: '', gates: ['all'] } };
  }

  const result = await response.json();
  const parsed = extractJSON(result.content);

  if (!parsed) {
    return { entries: [], chunkMeta: { summary: '', gates: ['all'] } };
  }

  const entries: KnowledgeEntry[] = ((parsed.entries as Record<string, unknown>[]) || []).map(
    (e: Record<string, unknown>) => ({
      id: uuid(),
      sourceId,
      category: (e.category as KnowledgeCategory) || 'general',
      title: String(e.title || ''),
      content: String(e.content || ''),
      keyTakeaway: String(e.keyTakeaway || ''),
      importance: (e.importance as 'critical' | 'important' | 'nice_to_know') || 'important',
      tags: (e.tags as string[]) || [],
      applicableGates: (e.applicableGates as string[]) || ['all'],
      createdAt: new Date().toISOString(),
    })
  );

  return {
    entries,
    chunkMeta: {
      summary: String(parsed.summary || ''),
      gates: (parsed.applicableGates as string[]) || ['all'],
    },
  };
}

// Main ingestion function — stores BOTH full chunks and extracted entries
export async function ingestTraining(params: {
  name: string;
  description: string;
  content: string;
  type: TrainingSource['type'];
  onProgress?: (processed: number, total: number, entryCount: number) => void;
}): Promise<{ source: TrainingSource; entries: KnowledgeEntry[]; chunks: TrainingChunk[] }> {
  const { name, description, content, type, onProgress } = params;

  const sourceId = uuid();
  const textChunks = chunkText(content);

  // Create training source record
  const source: TrainingSource = {
    id: sourceId,
    name,
    description,
    type,
    status: 'processing',
    entryCount: 0,
    rawContentLength: content.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveTrainingSource(source);

  const allEntries: KnowledgeEntry[] = [];
  const allChunks: TrainingChunk[] = [];

  // Process each chunk sequentially
  for (let i = 0; i < textChunks.length; i++) {
    const { entries, chunkMeta } = await processChunk(textChunks[i], sourceId, name, i);
    allEntries.push(...entries);

    // Store the FULL chunk text — this is what agents read when they need the original material
    allChunks.push({
      id: uuid(),
      sourceId,
      sourceName: name,
      chunkIndex: i,
      content: textChunks[i],        // FULL original text — not summarized
      summary: chunkMeta.summary,
      applicableGates: chunkMeta.gates,
      createdAt: new Date().toISOString(),
    });

    onProgress?.(i + 1, textChunks.length, allEntries.length);
  }

  // Save everything
  await saveKnowledgeEntries(allEntries);
  await saveTrainingChunks(allChunks);

  // Update source status
  source.status = 'ready';
  source.entryCount = allEntries.length;
  source.updatedAt = new Date().toISOString();
  await saveTrainingSource(source);

  return { source, entries: allEntries, chunks: allChunks };
}
