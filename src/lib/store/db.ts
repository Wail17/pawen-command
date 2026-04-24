// ============================================================
// PAWEN — IndexedDB Store v3 (via idb)
// All data persisted here. No backend DB needed.
// v2: Knowledge Base + Agent Memory
// v3: Training Chunks (full-text storage for deep learning)
// ============================================================

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, GateOutput, isPerSubAvatarGate } from '../types';
import { KnowledgeEntry, TrainingSource, AgentMemoryEntry, TrainingChunk, PersonaDistillation, AgentConstitution, ScoutLedgerEntry, AgentId, Conversation, ConversationMessage } from '../kb/types';
import { GoldOutput, LearningProfile } from '../learning/types';
import { Template } from '../templates/types';
import { VideoAdScript } from '../video/types';
import { SwipeVaultEntry } from '../swipeVault/types';
import { mirrorProject, mirrorProjectDelete, mirrorGateOutput } from './serverMirror';

interface PawenDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': string };
  };
  gateOutputs: {
    key: string;
    value: GateOutput & { _key: string };
    indexes: { 'by-project': string };
  };
  images: {
    key: string;
    value: {
      id: string;
      projectId: string;
      gateId: string;
      blob: Blob;
      url: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    };
    indexes: { 'by-project': string };
  };
  // === v2: Knowledge Base ===
  knowledge: {
    key: string;
    value: KnowledgeEntry;
    indexes: {
      'by-source': string;
      'by-category': string;
    };
  };
  trainingSources: {
    key: string;
    value: TrainingSource;
  };
  // === v3: Training Chunks (full text) — v10 adds embedding + similarityHash indexes ===
  trainingChunks: {
    key: string;
    value: TrainingChunk;
    indexes: {
      'by-source': string;
      'by-similarity-hash': string;
    };
  };
  // === v2: Agent Memory ===
  agentMemory: {
    key: string;
    value: AgentMemoryEntry;
    indexes: {
      'by-agent': string;
      'by-project': string;
    };
  };
  // === v4: Adaptive Learning Engine ===
  goldOutputs: {
    key: string;
    value: GoldOutput;
    indexes: {
      'by-gate': string;
      'by-niche': string;
      'by-project': string;
    };
  };
  learningProfile: {
    key: string;
    value: LearningProfile;
  };
  // === v5: Template Editor ===
  templates: {
    key: string;
    value: Template;
    indexes: {
      'by-project': string;
      'by-category': string;
    };
  };
  // === v6: Animated Video Ads ===
  videoAds: {
    key: string;
    value: VideoAdScript;
    indexes: {
      'by-project': string;
    };
  };
  // === v7: Swipe Vault (global ads library) ===
  swipeVault: {
    key: string;
    value: SwipeVaultEntry;
    indexes: {
      'by-status': string;
      'by-niche': string;
      'by-format': string;
      'by-awareness': string;
    };
  };
  // === v8: Phase U — Persona distillation (baked-in expertise) ===
  personaDistillations: {
    key: string;                   // agentId
    value: PersonaDistillation;
  };
  // === v8: Phase U — Agent constitutions (self-rewritten rules) ===
  agentConstitutions: {
    key: string;                   // agentId — latest version lives here
    value: AgentConstitution;
  };
  // === v8: Phase U — Scout ledger (scraping budget tracking) ===
  scoutLedger: {
    key: string;                   // uuid
    value: ScoutLedgerEntry;
    indexes: {
      'by-project': string;
      'by-day': string;
    };
  };
  // === v9: Phase V — Agent chat room ===
  conversations: {
    key: string;                   // conversation id (uuid)
    value: Conversation;
    indexes: {
      'by-project': string;
      'by-status': string;
    };
  };
  conversationMessages: {
    key: string;                   // message id (uuid)
    value: ConversationMessage;
    indexes: {
      'by-conversation': string;
    };
  };
}

const DB_NAME = 'pawen-command-center';
const DB_VERSION = 10;

let dbInstance: IDBPDatabase<PawenDB> | null = null;

async function getDB(): Promise<IDBPDatabase<PawenDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PawenDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      // === v1 stores ===
      if (oldVersion < 1) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-updated', 'updatedAt');

        const gateStore = db.createObjectStore('gateOutputs', { keyPath: '_key' });
        gateStore.createIndex('by-project', 'projectId');

        const imageStore = db.createObjectStore('images', { keyPath: 'id' });
        imageStore.createIndex('by-project', 'projectId');
      }

      // === v2 stores: Knowledge Base + Agent Memory ===
      if (oldVersion < 2) {
        const kbStore = db.createObjectStore('knowledge', { keyPath: 'id' });
        kbStore.createIndex('by-source', 'sourceId');
        kbStore.createIndex('by-category', 'category');

        db.createObjectStore('trainingSources', { keyPath: 'id' });

        const memoryStore = db.createObjectStore('agentMemory', { keyPath: 'id' });
        memoryStore.createIndex('by-agent', 'agentId');
        memoryStore.createIndex('by-project', 'projectId');
      }

      // === v3 stores: Training Chunks ===
      if (oldVersion < 3) {
        const chunkStore = db.createObjectStore('trainingChunks', { keyPath: 'id' });
        chunkStore.createIndex('by-source', 'sourceId');
      }

      // === v4 stores: Adaptive Learning Engine ===
      if (oldVersion < 4) {
        const goldStore = db.createObjectStore('goldOutputs', { keyPath: 'id' });
        goldStore.createIndex('by-gate', 'gateId');
        goldStore.createIndex('by-niche', 'niche');
        goldStore.createIndex('by-project', 'sourceProjectId');

        db.createObjectStore('learningProfile', { keyPath: 'id' });
      }

      // === v5 stores: Template Editor ===
      if (oldVersion < 5) {
        const templateStore = db.createObjectStore('templates', { keyPath: 'id' });
        templateStore.createIndex('by-project', 'projectId');
        templateStore.createIndex('by-category', 'category');
      }

      // === v6 stores: Animated Video Ads ===
      if (oldVersion < 6) {
        const videoStore = db.createObjectStore('videoAds', { keyPath: 'id' });
        videoStore.createIndex('by-project', 'project_id');
      }

      // === v7 store: Swipe Vault (global ads library) ===
      if (oldVersion < 7) {
        const vaultStore = db.createObjectStore('swipeVault', { keyPath: 'id' });
        vaultStore.createIndex('by-status', 'status');
        vaultStore.createIndex('by-niche', 'niche');
        vaultStore.createIndex('by-format', 'format');
        vaultStore.createIndex('by-awareness', 'awarenessLevel');
      }

      // === v8 stores: Phase U — Autonomous mode ===
      if (oldVersion < 8) {
        db.createObjectStore('personaDistillations', { keyPath: 'agentId' });
        db.createObjectStore('agentConstitutions', { keyPath: 'agentId' });
        const scoutStore = db.createObjectStore('scoutLedger', { keyPath: 'id' });
        scoutStore.createIndex('by-project', 'projectId');
        scoutStore.createIndex('by-day', 'day');
      }

      // === v9 stores: Phase V — Agent chat room ===
      if (oldVersion < 9) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('by-project', 'projectId');
        convStore.createIndex('by-status', 'status');

        const msgStore = db.createObjectStore('conversationMessages', { keyPath: 'id' });
        msgStore.createIndex('by-conversation', 'conversationId');
      }

      // === v10 alter: Phase U.4 — TrainingChunk similarity hash index ===
      // We add an index on the existing `trainingChunks` store. Existing
      // rows won't have `similarityHash` populated yet — the backfill job
      // sets it lazily on access (see scoreChunk + embeddings.ts).
      if (oldVersion < 10 && db.objectStoreNames.contains('trainingChunks')) {
        const store = tx.objectStore('trainingChunks');
        if (!store.indexNames.contains('by-similarity-hash')) {
          store.createIndex('by-similarity-hash', 'similarityHash', { unique: false });
        }
      }
    },
  });

  return dbInstance;
}

// === PROJECTS ===

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  const projects = await db.getAllFromIndex('projects', 'by-updated');
  return projects.reverse();
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  project.updatedAt = new Date().toISOString();
  await db.put('projects', project);
  // Fire-and-forget mirror to Neon so the god panel can see this project.
  // Never throws — serverMirror.ts swallows errors internally.
  mirrorProject(project);
}

// Used by bootstrap to restore server state into local IndexedDB
// WITHOUT re-mirroring back up (avoids loops + watermark stacking) and
// WITHOUT bumping updatedAt (preserves server's authoritative timestamp).
export async function restoreProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['projects', 'gateOutputs', 'images'], 'readwrite');
  await tx.objectStore('projects').delete(id);

  const gateOutputs = await tx.objectStore('gateOutputs').index('by-project').getAllKeys(id);
  for (const key of gateOutputs) {
    await tx.objectStore('gateOutputs').delete(key);
  }

  const images = await tx.objectStore('images').index('by-project').getAllKeys(id);
  for (const key of images) {
    await tx.objectStore('images').delete(key);
  }

  await tx.done;

  // Cascade-delete the server mirror too. Gate outputs are wiped
  // server-side by the same DELETE call (see api/sync/project).
  mirrorProjectDelete(id);
}

// === GATE OUTPUTS ===
//
// Key format:
//   Shared gates (gate1, brand-dna): `${projectId}:${gateId}`
//   Per-SA gates (gate2-9) in batch: `${projectId}:${gateId}:${subAvatarId}`
//   Legacy single-SA outputs: `${projectId}:${gateId}` (read-through fallback)
//
// Resolution order when reading a per-SA gate:
//   1. Try `${projectId}:${gateId}:${subAvatarId}`
//   2. Fall back to legacy `${projectId}:${gateId}` (pre-batch projects)

function buildGateKey(projectId: string, gateId: string, subAvatarId?: string): string {
  if (subAvatarId && isPerSubAvatarGate(gateId as import('../types').GateId)) {
    return `${projectId}:${gateId}:${subAvatarId}`;
  }
  return `${projectId}:${gateId}`;
}

export async function getGateOutput(
  projectId: string,
  gateId: string,
  subAvatarId?: string,
): Promise<GateOutput | undefined> {
  const db = await getDB();
  // Try per-SA key first if applicable
  if (subAvatarId && isPerSubAvatarGate(gateId as import('../types').GateId)) {
    const perSA = await db.get('gateOutputs', `${projectId}:${gateId}:${subAvatarId}`);
    if (perSA) return perSA;
  }
  // Legacy / shared key
  return db.get('gateOutputs', `${projectId}:${gateId}`);
}

export async function getAllGateOutputs(projectId: string): Promise<GateOutput[]> {
  const db = await getDB();
  return db.getAllFromIndex('gateOutputs', 'by-project', projectId);
}

// Returns gate outputs scoped to one sub-avatar view: for per-SA gates, returns
// the per-SA version (falling back to legacy if missing); for shared gates,
// returns the shared output. Used by runGate / autoPipeline to build previousOutputs
// context that stays coherent to the SA being processed.
export async function getGateOutputsForSubAvatar(
  projectId: string,
  subAvatarId: string,
): Promise<Record<string, GateOutput>> {
  const all = await getAllGateOutputs(projectId);
  const byGate: Record<string, GateOutput> = {};
  for (const o of all) {
    // Per-SA gates: prefer the per-SA record; fall back to legacy if no per-SA.
    if (isPerSubAvatarGate(o.gateId)) {
      if (o.subAvatarId === subAvatarId) {
        byGate[o.gateId] = o;
      } else if (!byGate[o.gateId] && !o.subAvatarId) {
        byGate[o.gateId] = o; // legacy fallback
      }
    } else {
      byGate[o.gateId] = o; // shared gate (gate1, brand-dna)
    }
  }
  return byGate;
}

export async function saveGateOutput(output: GateOutput): Promise<void> {
  const db = await getDB();
  output.updatedAt = new Date().toISOString();
  const key = buildGateKey(output.projectId, output.gateId, output.subAvatarId);
  const record = { ...output, _key: key };
  await db.put('gateOutputs', record);
  // Fire-and-forget mirror so admin can inspect every gate run.
  mirrorGateOutput(output);
}

// Used by bootstrap to restore server state into local IndexedDB
// WITHOUT re-mirroring back up and WITHOUT bumping updatedAt.
export async function restoreGateOutput(output: GateOutput): Promise<void> {
  const db = await getDB();
  const key = buildGateKey(output.projectId, output.gateId, output.subAvatarId);
  const record = { ...output, _key: key };
  await db.put('gateOutputs', record);
}

// === IMAGES ===

export async function saveImage(
  id: string,
  projectId: string,
  gateId: string,
  blob: Blob,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const db = await getDB();
  const url = URL.createObjectURL(blob);
  await db.put('images', {
    id, projectId, gateId, blob, url, metadata,
    createdAt: new Date().toISOString(),
  });
  return url;
}

export async function getProjectImages(projectId: string) {
  const db = await getDB();
  return db.getAllFromIndex('images', 'by-project', projectId);
}

// === KNOWLEDGE BASE ===

export async function saveKnowledgeEntry(entry: KnowledgeEntry): Promise<void> {
  const db = await getDB();
  await db.put('knowledge', entry);
}

export async function saveKnowledgeEntries(entries: KnowledgeEntry[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('knowledge', 'readwrite');
  for (const entry of entries) {
    await tx.store.put(entry);
  }
  await tx.done;
}

export async function getKnowledgeByCategory(category: string): Promise<KnowledgeEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('knowledge', 'by-category', category);
}

export async function getKnowledgeBySource(sourceId: string): Promise<KnowledgeEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('knowledge', 'by-source', sourceId);
}

export async function getAllKnowledge(): Promise<KnowledgeEntry[]> {
  const db = await getDB();
  return db.getAll('knowledge');
}

export async function getKnowledgeForGate(gateId: string): Promise<KnowledgeEntry[]> {
  const db = await getDB();
  const all = await db.getAll('knowledge');
  return all.filter(e => e.applicableGates.includes(gateId) || e.applicableGates.includes('all'));
}

export async function deleteKnowledgeBySource(sourceId: string): Promise<void> {
  const db = await getDB();
  const entries = await db.getAllFromIndex('knowledge', 'by-source', sourceId);
  const tx = db.transaction('knowledge', 'readwrite');
  for (const entry of entries) {
    await tx.store.delete(entry.id);
  }
  await tx.done;
}

// === TRAINING SOURCES ===

export async function saveTrainingSource(source: TrainingSource): Promise<void> {
  const db = await getDB();
  await db.put('trainingSources', source);
}

export async function getAllTrainingSources(): Promise<TrainingSource[]> {
  const db = await getDB();
  return db.getAll('trainingSources');
}

export async function getTrainingSource(id: string): Promise<TrainingSource | undefined> {
  const db = await getDB();
  return db.get('trainingSources', id);
}

export async function deleteTrainingSource(id: string): Promise<void> {
  const db = await getDB();
  await deleteKnowledgeBySource(id);
  await deleteTrainingChunksBySource(id);
  await db.delete('trainingSources', id);
}

// === TRAINING CHUNKS (full-text) ===

export async function saveTrainingChunks(chunks: TrainingChunk[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('trainingChunks', 'readwrite');
  for (const chunk of chunks) {
    await tx.store.put(chunk);
  }
  await tx.done;
}

export async function getTrainingChunksForGate(gateId: string): Promise<TrainingChunk[]> {
  const db = await getDB();
  const all = await db.getAll('trainingChunks');
  return all.filter(c => c.applicableGates.includes(gateId) || c.applicableGates.includes('all'));
}

export async function getTrainingChunksBySource(sourceId: string): Promise<TrainingChunk[]> {
  const db = await getDB();
  return db.getAllFromIndex('trainingChunks', 'by-source', sourceId);
}

export async function getAllTrainingChunks(): Promise<TrainingChunk[]> {
  const db = await getDB();
  return db.getAll('trainingChunks');
}

export async function deleteTrainingChunksBySource(sourceId: string): Promise<void> {
  const db = await getDB();
  const chunks = await db.getAllFromIndex('trainingChunks', 'by-source', sourceId);
  const tx = db.transaction('trainingChunks', 'readwrite');
  for (const chunk of chunks) {
    await tx.store.delete(chunk.id);
  }
  await tx.done;
}

// === AGENT MEMORY ===

export async function saveAgentMemory(entry: AgentMemoryEntry): Promise<void> {
  const db = await getDB();
  await db.put('agentMemory', entry);
}

export async function getAgentMemories(agentId: string): Promise<AgentMemoryEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('agentMemory', 'by-agent', agentId);
}

export async function getAgentMemoriesForProject(projectId: string): Promise<AgentMemoryEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('agentMemory', 'by-project', projectId);
}

export async function getAllAgentMemories(): Promise<AgentMemoryEntry[]> {
  const db = await getDB();
  return db.getAll('agentMemory');
}

export async function deleteAgentMemory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('agentMemory', id);
}

// === GOLD OUTPUTS (Adaptive Learning) ===

export async function saveGoldOutput(entry: GoldOutput): Promise<void> {
  const db = await getDB();
  await db.put('goldOutputs', entry);
}

export async function getGoldOutputsForGate(gateId: string): Promise<GoldOutput[]> {
  const db = await getDB();
  return db.getAllFromIndex('goldOutputs', 'by-gate', gateId);
}

export async function getGoldOutputsByNiche(niche: string): Promise<GoldOutput[]> {
  const db = await getDB();
  return db.getAllFromIndex('goldOutputs', 'by-niche', niche);
}

export async function getGoldOutputsForGateAndNiche(gateId: string, niche: string): Promise<GoldOutput[]> {
  const db = await getDB();
  const byGate = await db.getAllFromIndex('goldOutputs', 'by-gate', gateId);
  return byGate.filter(g => g.niche === niche || g.niche === '' || niche === '');
}

export async function deleteGoldOutput(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('goldOutputs', id);
}

export async function deleteGoldOutputsByProject(projectId: string): Promise<void> {
  const db = await getDB();
  const entries = await db.getAllFromIndex('goldOutputs', 'by-project', projectId);
  const tx = db.transaction('goldOutputs', 'readwrite');
  for (const entry of entries) {
    await tx.store.delete(entry.id);
  }
  await tx.done;
}

export async function getAllGoldOutputs(): Promise<GoldOutput[]> {
  const db = await getDB();
  return db.getAll('goldOutputs');
}

// === LEARNING PROFILE ===

export async function getLearningProfile(): Promise<LearningProfile | undefined> {
  const db = await getDB();
  return db.get('learningProfile', 'default');
}

export async function saveLearningProfile(profile: LearningProfile): Promise<void> {
  const db = await getDB();
  await db.put('learningProfile', profile);
}

// === EXPORT ===

// === TEMPLATES ===

export async function getTemplate(id: string): Promise<Template | undefined> {
  const db = await getDB();
  return db.get('templates', id);
}

export async function getProjectTemplates(projectId: string): Promise<Template[]> {
  const db = await getDB();
  return db.getAllFromIndex('templates', 'by-project', projectId);
}

export async function saveTemplate(template: Template): Promise<void> {
  const db = await getDB();
  template.updatedAt = new Date().toISOString();
  await db.put('templates', template);
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('templates', id);
}

// === VIDEO ADS ===

export async function getVideoAd(id: string): Promise<VideoAdScript | undefined> {
  const db = await getDB();
  return db.get('videoAds', id);
}

export async function getProjectVideoAds(projectId: string): Promise<VideoAdScript[]> {
  const db = await getDB();
  return db.getAllFromIndex('videoAds', 'by-project', projectId);
}

export async function saveVideoAd(ad: VideoAdScript): Promise<void> {
  const db = await getDB();
  ad.updated_at = new Date().toISOString();
  await db.put('videoAds', ad);
}

export async function deleteVideoAd(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('videoAds', id);
}

// === EXPORT ===

// === SWIPE VAULT (v7, global cross-project ads library) ===

export async function addSwipeEntry(entry: SwipeVaultEntry): Promise<void> {
  const db = await getDB();
  await db.put('swipeVault', entry);
}

export async function updateSwipeEntry(entry: SwipeVaultEntry): Promise<void> {
  const db = await getDB();
  entry.updatedAt = new Date().toISOString();
  await db.put('swipeVault', entry);
}

export async function deleteSwipeEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('swipeVault', id);
}

export async function getSwipeEntry(id: string): Promise<SwipeVaultEntry | undefined> {
  const db = await getDB();
  return db.get('swipeVault', id);
}

export async function getAllSwipeEntries(): Promise<SwipeVaultEntry[]> {
  const db = await getDB();
  return db.getAll('swipeVault');
}

export async function querySwipeEntries(filter: {
  status?: string;
  niche?: string;
  format?: string;
  awarenessLevel?: string;
}): Promise<SwipeVaultEntry[]> {
  const db = await getDB();
  let entries: SwipeVaultEntry[];
  if (filter.status) {
    entries = await db.getAllFromIndex('swipeVault', 'by-status', filter.status);
  } else if (filter.niche) {
    entries = await db.getAllFromIndex('swipeVault', 'by-niche', filter.niche);
  } else if (filter.format) {
    entries = await db.getAllFromIndex('swipeVault', 'by-format', filter.format);
  } else if (filter.awarenessLevel) {
    entries = await db.getAllFromIndex('swipeVault', 'by-awareness', filter.awarenessLevel);
  } else {
    entries = await db.getAll('swipeVault');
  }
  return entries.filter(e =>
    (!filter.status || e.status === filter.status) &&
    (!filter.niche || e.niche === filter.niche) &&
    (!filter.format || e.format === filter.format) &&
    (!filter.awarenessLevel || e.awarenessLevel === filter.awarenessLevel)
  );
}

export async function exportProject(projectId: string) {
  const project = await getProject(projectId);
  const gateOutputs = await getAllGateOutputs(projectId);
  const images = await getProjectImages(projectId);

  return {
    project,
    gateOutputs,
    images: images.map(img => ({
      ...img,
      blob: undefined,
    })),
  };
}

// ============================================================
// Phase U — Persona Distillations
// ============================================================

export async function savePersonaDistillation(rec: PersonaDistillation): Promise<void> {
  const db = await getDB();
  await db.put('personaDistillations', rec);
}

export async function getPersonaDistillation(agentId: AgentId): Promise<PersonaDistillation | undefined> {
  const db = await getDB();
  return db.get('personaDistillations', agentId);
}

export async function getAllPersonaDistillations(): Promise<PersonaDistillation[]> {
  const db = await getDB();
  return db.getAll('personaDistillations');
}

export async function deletePersonaDistillation(agentId: AgentId): Promise<void> {
  const db = await getDB();
  await db.delete('personaDistillations', agentId);
}

// ============================================================
// Phase U — Agent Constitutions
// ============================================================

export async function saveAgentConstitution(rec: AgentConstitution): Promise<void> {
  const db = await getDB();
  await db.put('agentConstitutions', rec);
}

export async function getAgentConstitution(agentId: AgentId): Promise<AgentConstitution | undefined> {
  const db = await getDB();
  return db.get('agentConstitutions', agentId);
}

export async function getAllAgentConstitutions(): Promise<AgentConstitution[]> {
  const db = await getDB();
  return db.getAll('agentConstitutions');
}

export async function deleteAgentConstitution(agentId: AgentId): Promise<void> {
  const db = await getDB();
  await db.delete('agentConstitutions', agentId);
}

// ============================================================
// Phase U — Scout Ledger
// ============================================================

export async function appendScoutLedger(entry: ScoutLedgerEntry): Promise<void> {
  const db = await getDB();
  await db.put('scoutLedger', entry);
}

export async function getScoutLedgerForProject(projectId: string): Promise<ScoutLedgerEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('scoutLedger', 'by-project', projectId);
}

export async function getScoutLedgerForDay(day: string): Promise<ScoutLedgerEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('scoutLedger', 'by-day', day);
}

export async function countScoutCallsForProjectToday(projectId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const entries = await getScoutLedgerForProject(projectId);
  return entries.filter(e => e.day === today).length;
}

// ============================================================
// Phase V — Conversations + Messages
// ============================================================

export async function saveConversation(rec: Conversation): Promise<void> {
  const db = await getDB();
  await db.put('conversations', rec);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = await getDB();
  return db.get('conversations', id);
}

export async function getConversationsForProject(projectId: string): Promise<Conversation[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex('conversations', 'by-project', projectId);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getActiveConversationsForProject(projectId: string): Promise<Conversation[]> {
  const rows = await getConversationsForProject(projectId);
  return rows.filter(r => r.status === 'active');
}

export async function getAllConversations(): Promise<Conversation[]> {
  const db = await getDB();
  return db.getAll('conversations');
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('conversations', id);
  // Also purge messages
  const msgs = await db.getAllFromIndex('conversationMessages', 'by-conversation', id);
  const tx = db.transaction('conversationMessages', 'readwrite');
  for (const m of msgs) await tx.store.delete(m.id);
  await tx.done;
}

export async function appendConversationMessage(msg: ConversationMessage): Promise<void> {
  const db = await getDB();
  await db.put('conversationMessages', msg);
}

export async function getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const db = await getDB();
  const msgs = await db.getAllFromIndex('conversationMessages', 'by-conversation', conversationId);
  return msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
