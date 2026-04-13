// ============================================================
// PAWEN — IndexedDB Store v3 (via idb)
// All data persisted here. No backend DB needed.
// v2: Knowledge Base + Agent Memory
// v3: Training Chunks (full-text storage for deep learning)
// ============================================================

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, GateOutput } from '../types';
import { KnowledgeEntry, TrainingSource, AgentMemoryEntry, TrainingChunk } from '../kb/types';
import { GoldOutput, LearningProfile } from '../learning/types';
import { Template } from '../templates/types';
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
  // === v3: Training Chunks (full text) ===
  trainingChunks: {
    key: string;
    value: TrainingChunk;
    indexes: {
      'by-source': string;
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
}

const DB_NAME = 'pawen-command-center';
const DB_VERSION = 5;

let dbInstance: IDBPDatabase<PawenDB> | null = null;

async function getDB(): Promise<IDBPDatabase<PawenDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PawenDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
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

export async function getGateOutput(projectId: string, gateId: string): Promise<GateOutput | undefined> {
  const db = await getDB();
  return db.get('gateOutputs', `${projectId}:${gateId}`);
}

export async function getAllGateOutputs(projectId: string): Promise<GateOutput[]> {
  const db = await getDB();
  return db.getAllFromIndex('gateOutputs', 'by-project', projectId);
}

export async function saveGateOutput(output: GateOutput): Promise<void> {
  const db = await getDB();
  output.updatedAt = new Date().toISOString();
  const record = { ...output, _key: `${output.projectId}:${output.gateId}` };
  await db.put('gateOutputs', record);
  // Fire-and-forget mirror so admin can inspect every gate run.
  mirrorGateOutput(output);
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

// === EXPORT ===

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
