// ============================================================
// PAWEN — Knowledge Base Types
// Training ingestion, knowledge entries, agent memory
// ============================================================

// === TRAINING SOURCES ===

export interface TrainingSource {
  id: string;
  name: string;                    // "ZAK Scaling SOP", "EVOLVE Copy Framework"
  description: string;
  type: 'course' | 'document' | 'video_transcript' | 'experience';
  status: 'processing' | 'ready' | 'error';
  entryCount: number;
  rawContentLength: number;
  createdAt: string;
  updatedAt: string;
}

// === KNOWLEDGE ENTRIES ===

export type KnowledgeCategory =
  | 'product_research'
  | 'avatar_research'
  | 'copywriting'
  | 'hooks'
  | 'advertorial'
  | 'video_scripts'
  | 'image_ads'
  | 'media_buying'
  | 'campaign_strategy'
  | 'scaling'
  | 'testing'
  | 'psychology'
  | 'mechanism'
  | 'root_cause'
  | 'brand_voice'
  | 'general';

export interface KnowledgeEntry {
  id: string;
  sourceId: string;                // which training source this came from
  category: KnowledgeCategory;
  title: string;                   // "The 50-Conversion Rule for CBO Scaling"
  content: string;                 // the actual knowledge
  keyTakeaway: string;             // one-line summary for quick reference
  importance: 'critical' | 'important' | 'nice_to_know';
  tags: string[];                  // ["scaling", "budget", "cbo", "meta ads"]
  applicableGates: string[];       // ["gate9"] — which gates should use this
  createdAt: string;
}

// === AGENT MEMORY ===

export type AgentId = 'sarah' | 'marcus' | 'alex' | 'nina' | 'david' | 'lea';

export interface AgentMemoryEntry {
  id: string;
  agentId: AgentId;
  projectId: string | null;        // null = cross-project learning
  type: 'learning' | 'opinion' | 'decision' | 'feedback' | 'error' | 'rejection';
  title: string;                   // "Pain-led hooks outperform desire-led for health niche"
  content: string;                 // detailed learning
  confidence: number;              // 1-10: how confident is the agent in this learning
  context: string;                 // what project/situation led to this learning
  createdAt: string;
}

// === TRAINING CHUNKS (full-text storage) ===

export interface TrainingChunk {
  id: string;
  sourceId: string;
  sourceName: string;
  chunkIndex: number;
  content: string;                   // FULL original text — not summarized
  summary: string;                   // short summary for search/display
  applicableGates: string[];         // which gates this chunk is relevant to
  createdAt: string;
}

// === AGENT PERSONA ===

export interface AgentPersona {
  id: AgentId;
  name: string;
  role: string;
  emoji: string;
  expertise: string[];
  personality: string;
  decisionStyle: string;
  communicationStyle: string;
  gates: string[];                 // which gates this agent leads
  subAgentIds: string[];           // which sub-agents this persona drives
}
