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
  type: 'learning' | 'opinion' | 'decision' | 'feedback' | 'error' | 'rejection' | 'team_decision' | 'user_directive';
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
  // Phase U.4 additions (IDB v10, optional on legacy rows)
  embedding?: number[];              // serialized Float32 embedding (length = provider dim)
  embeddingModel?: string;           // e.g. 'voyage-3-lite' | 'simhash-stub'
  qualityScore?: number;             // 0-100 (see src/lib/sources/qualityScore.ts)
  similarityHash?: string;           // sha-256 of normalized content, for exact-dup detection
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

// === PHASE U — PersonaDistillation (baked-in expertise, replaces runtime RAG) ===

export interface PersonaDistillation {
  agentId: AgentId;
  distilledExpertise: string;      // markdown, ~20k chars: Frameworks / Principles / Anti-patterns / Tactical heuristics
  chunkIds: string[];              // training chunks that fed the distillation (provenance)
  sourceCount: number;             // number of TrainingSource docs represented
  chunkCount: number;              // number of chunks ingested
  inputChars: number;              // total input chars sent to Opus
  outputChars: number;             // distilled length
  generatedAt: string;             // ISO
  model: string;                   // e.g. 'claude-opus-4-6'
  tokens: number;                  // total tokens used
  version: number;                 // monotonically increasing; v1 on first run
}

// === PHASE U — AgentConstitution (self-rewritten operating rules) ===

export interface AgentConstitution {
  agentId: AgentId;
  constitution: string;            // first-person markdown, ≤8000 chars: Do / Don't / Watch-out rules
  version: number;
  generatedAt: string;
  basedOnGates: string[];          // gateIds examined
  basedOnOutputCount: number;      // number of GateOutput docs examined
  metrics: {
    avgScore: number;              // 0-100, average reviewer score over window
    rejectionCount: number;        // number of human rejections in window
    approvalRate: number;          // 0-1
  };
  previousVersion?: string;        // short diff or summary of change (optional, nullable)
}

// === PHASE V — Agent Chat Room ===

export type ConversationStatus = 'active' | 'closed' | 'archived';
export type ConversationInitiator = 'user' | 'system' | 'agent';
export type MessageAuthorType = 'user' | 'agent' | 'system';

export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  status: ConversationStatus;
  initiator: ConversationInitiator;
  initiatorTrigger?: string;          // e.g. 'META_DROP_CRITICAL', 'DISTILLATION_COMPLETE', 'user:<userName>'
  topic: string;
  participants: string[];              // agentIds or 'scout' — who may speak in this conv
  createdAt: string;
  closedAt?: string;
  closeReason?: 'user' | 'cap_reached' | 'cost_ceiling' | 'lea_summary' | 'error';
  summary?: string;                    // Léa summary on close
  messageCount: number;                // authored messages only (excludes routing calls)
  tokenCost: number;                   // cumulative token count
  costUsd: number;                     // rough USD estimate
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  authorType: MessageAuthorType;
  authorId: string;                    // agentId for 'agent', userName for 'user', 'system' for 'system'
  content: string;
  mentionedAgents: string[];           // parsed from @agent markers
  scrapeRequest?: string;              // parsed SCRAPE_REQUEST intent (if present)
  closeRequest?: boolean;              // true if message contains CLOSE_CONVERSATION marker
  parentMessageId?: string;
  tokensUsed?: number;                 // for agent messages only
  costUsd?: number;
  modelUsed?: string;
  createdAt: string;
}

// === PHASE U — Scout ledger (daily scraping budget tracking) ===

export interface ScoutLedgerEntry {
  id: string;                      // uuid
  projectId: string;
  gateId: string;                  // which gate's run requested it (or 'cron:meta-drop' / 'manual')
  agentId: AgentId | 'cron';       // who requested
  intent: string;                  // the natural-language intent
  tools: string[];                 // which tools Scout picked
  queries: string[];               // generated queries
  addedItems: number;              // count of items appended to rawSignal/competitor/voc
  costHint: Record<string, number>; // { tavily: 3, firecrawl: 2 } — approximate call count per tool
  summary: string;
  day: string;                     // 'YYYY-MM-DD' — for per-day cap indexing
  createdAt: string;
}
