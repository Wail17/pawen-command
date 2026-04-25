// ============================================================
// PAWEN — Adaptive Learning: Capture Engine
// Converts human actions (picks, scores, approvals, rejections)
// into gold outputs and learning profile updates.
// ============================================================

import { GoldOutput, LearningProfile, createDefaultProfile } from './types';
import {
  saveGoldOutput,
  getLearningProfile,
  saveLearningProfile,
  getGoldOutputsForGate,
} from '../store/db';
import type { Project, GateOutput } from '../types';
import { getPersonaForGate } from '../agents/personas';
import {
  isAutoConstitutionEnabled,
  isAutonomousModeEnabled,
  getConstitutionRefreshEvery,
} from './autonomousMode';
import { bumpConstitutionCounter, updateAgentConstitution } from './constitution';
import { triggerOnGateApproved, triggerOnGoldPick } from '../conversations/proactive';

let idCounter = 0;
function generateId(): string {
  return `gold_${Date.now()}_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Capture from a ★ pick ──────────────────────────────────
export async function captureFromPick(params: {
  project: Project;
  gateId: string;
  sectionPath: string;
  content: string;
}): Promise<GoldOutput> {
  const { project, gateId, sectionPath, content } = params;

  const entry: GoldOutput = {
    id: generateId(),
    gateId,
    niche: project.niche || '',
    funnel: project.selectedFunnel || 'any',
    language: project.targetLanguage || 'en-US',
    sectionPath,
    content: content.slice(0, 3000), // cap to avoid bloat
    contentPreview: content.slice(0, 200),
    sourceProjectId: project.id,
    sourceProjectName: project.name,
    captureType: 'pick',
    createdAt: new Date().toISOString(),
  };

  await saveGoldOutput(entry);

  // Update learning profile with pick signal
  await updateProfileFromPick(gateId, content);

  // Phase V proactive — fire a Léa-led debrief about why this hit.
  // Best-effort: never blocks the pick, never throws.
  void triggerOnGoldPick({
    project: { id: project.id, name: project.name, niche: project.niche, targetMarket: project.targetMarket },
    sectionPath,
    content,
  }).catch(() => { /* silent */ });

  return entry;
}

// ── Capture from high score (manager/director >= 85%) ──────
export async function captureFromScore(params: {
  project: Project;
  gateId: string;
  data: Record<string, unknown>;
  score: number;
}): Promise<GoldOutput[]> {
  const { project, gateId, data, score } = params;
  const captured: GoldOutput[] = [];

  // Iterate top-level keys of the output and save substantial sections
  for (const [key, value] of Object.entries(data)) {
    if (key === 'rawContent') continue; // skip raw fallback

    const content = typeof value === 'string' ? value : JSON.stringify(value);
    if (content.length < 100) continue; // skip trivial fields

    const entry: GoldOutput = {
      id: generateId(),
      gateId,
      niche: project.niche || '',
      funnel: project.selectedFunnel || 'any',
      language: project.targetLanguage || 'en-US',
      sectionPath: key,
      content: content.slice(0, 3000),
      contentPreview: content.slice(0, 200),
      sourceProjectId: project.id,
      sourceProjectName: project.name,
      captureType: 'auto_score',
      score,
      createdAt: new Date().toISOString(),
    };

    captured.push(entry);
    await saveGoldOutput(entry);
  }

  return captured;
}

// ── Capture from human approval ────────────────────────────
export async function captureFromApproval(params: {
  project: Project;
  gateId: string;
  gateOutput: GateOutput;
}): Promise<GoldOutput[]> {
  const { project, gateId, gateOutput } = params;
  const captured: GoldOutput[] = [];
  const picked = (gateOutput.humanDecisions?.picked ?? {}) as Record<string, string[]>;

  // Prioritize sections that the human explicitly picked
  const pickedSections = new Set(Object.keys(picked));

  // Get substantial sections from output data
  const sections = Object.entries(gateOutput.data)
    .filter(([key]) => key !== 'rawContent')
    .map(([key, value]) => {
      const content = typeof value === 'string' ? value : JSON.stringify(value);
      return { key, content, isPicked: pickedSections.has(key) };
    })
    .filter(s => s.content.length >= 100)
    .sort((a, b) => {
      // Picked sections first, then by length
      if (a.isPicked !== b.isPicked) return a.isPicked ? -1 : 1;
      return b.content.length - a.content.length;
    })
    .slice(0, 5); // cap at 5 sections per approval

  for (const section of sections) {
    const entry: GoldOutput = {
      id: generateId(),
      gateId,
      niche: project.niche || '',
      funnel: project.selectedFunnel || 'any',
      language: project.targetLanguage || 'en-US',
      sectionPath: section.key,
      content: section.content.slice(0, 3000),
      contentPreview: section.content.slice(0, 200),
      sourceProjectId: project.id,
      sourceProjectName: project.name,
      captureType: 'approval',
      score: gateOutput.reviewResult?.percentage,
      createdAt: new Date().toISOString(),
    };

    captured.push(entry);
    await saveGoldOutput(entry);
  }

  // Update profile
  await updateProfileFromApproval();

  // Phase U.2 — bump the constitution-refresh counter for the lead persona.
  // When the threshold crosses AND both autonomous flags are on, fire-and-
  // forget a constitution recompile. Fully non-blocking; silent on failure.
  try {
    if (isAutonomousModeEnabled() && isAutoConstitutionEnabled()) {
      const leadPersona = getPersonaForGate(gateId);
      const threshold = getConstitutionRefreshEvery();
      const shouldRefresh = bumpConstitutionCounter(leadPersona.id, threshold);
      if (shouldRefresh) {
        void updateAgentConstitution(leadPersona.id).catch(() => { /* best-effort */ });
      }
    }
  } catch {
    /* never break the approval flow */
  }

  // Phase V proactive — Léa kicks off a debrief on high-scoring approvals
  const score = gateOutput.reviewResult?.percentage ?? 0;
  if (score >= 85) {
    void triggerOnGateApproved({
      project: { id: project.id, name: project.name, niche: project.niche, targetMarket: project.targetMarket },
      gateId,
      score,
    }).catch(() => { /* silent */ });
  }

  return captured;
}

// ── Update learning profile from rejection ─────────────────
export async function captureRejection(params: {
  gateId: string;
  reason: string;
}): Promise<void> {
  const profile = (await getLearningProfile()) || createDefaultProfile();

  profile.totalRejections += 1;
  profile.rejectionReasons = [
    params.reason.slice(0, 300),
    ...profile.rejectionReasons,
  ].slice(0, 10); // FIFO, keep last 10

  profile.updatedAt = new Date().toISOString();
  await saveLearningProfile(profile);
}

// ── Internal: update profile from pick ─────────────────────
async function updateProfileFromPick(gateId: string, content: string): Promise<void> {
  const profile = (await getLearningProfile()) || createDefaultProfile();

  // Update average pick length for this gate
  const prevAvg = profile.styleSignals.avgPickLength[gateId] || 0;
  const existingGold = await getGoldOutputsForGate(gateId);
  const pickCount = existingGold.filter(g => g.captureType === 'pick').length;
  profile.styleSignals.avgPickLength[gateId] =
    pickCount > 1 ? Math.round((prevAvg * (pickCount - 1) + content.length) / pickCount) : content.length;

  // Extract tone keywords from content
  const toneWords = extractToneSignals(content);
  if (toneWords.length > 0) {
    const existing = profile.styleSignals.toneKeywords[gateId] || [];
    const merged = [...new Set([...existing, ...toneWords])].slice(0, 8);
    profile.styleSignals.toneKeywords[gateId] = merged;
  }

  profile.updatedAt = new Date().toISOString();
  await saveLearningProfile(profile);
}

// ── Internal: update profile from approval ─────────────────
async function updateProfileFromApproval(): Promise<void> {
  const profile = (await getLearningProfile()) || createDefaultProfile();
  profile.totalApprovals += 1;
  profile.updatedAt = new Date().toISOString();
  await saveLearningProfile(profile);
}

// ── Internal: simple tone signal extraction ────────────────
const TONE_MARKERS: Record<string, string[]> = {
  bold: ['bold', 'daring', 'audacious', 'fearless', 'disruptive'],
  direct: ['direct', 'straight', 'blunt', 'no-bs', 'actionable'],
  emotional: ['emotional', 'heart', 'feel', 'struggle', 'pain', 'dream'],
  conversational: ['hey', 'you', 'your', "you're", 'gonna', 'wanna', 'tbh'],
  data_driven: ['study', 'research', 'proven', 'clinical', 'statistic', '%'],
  urgent: ['now', 'today', 'limited', 'hurry', 'last chance', 'deadline'],
  story_driven: ['story', 'journey', 'imagine', 'picture this', 'one day'],
  humorous: ['lol', 'funny', 'joke', 'laugh', 'plot twist', 'spoiler'],
};

function extractToneSignals(content: string): string[] {
  const lower = content.toLowerCase();
  const detected: string[] = [];

  for (const [tone, markers] of Object.entries(TONE_MARKERS)) {
    const hits = markers.filter(m => lower.includes(m)).length;
    if (hits >= 2 || (markers.length <= 3 && hits >= 1)) {
      detected.push(tone);
    }
  }

  return detected;
}
