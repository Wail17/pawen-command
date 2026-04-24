// ============================================================
// Pawen — Discord pipeline notifications
// Fire-and-forget pings at start / end / error of each gate.
// All calls go through /api/notify/discord (webhook URL stays server-side).
// Never throws — notification failures must never break the pipeline.
// ============================================================

const COLOR_START = 0x5865f2;   // blurple
const COLOR_SUCCESS = 0x57f287; // green
const COLOR_ERROR = 0xed4245;   // red
const COLOR_WARN = 0xfee75c;    // yellow

const PROD_BASE_URL = 'https://sykss-agency.vercel.app';

// Per-project emoji palette — each project gets a stable, unique-looking emoji
// derived from its id hash, so running 5 projects in parallel is readable at a glance.
const PROJECT_EMOJIS = [
  '🟣', '🟢', '🔵', '🟡', '🟠', '🔴', '⚪', '🟤',
  '🦊', '🐼', '🦄', '🐙', '🦀', '🐝', '🦋', '🐬',
  '🌸', '🍀', '⚡', '🔥', '💎', '🚀', '🎯', '🎨',
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function projectEmoji(projectId: string): string {
  return PROJECT_EMOJIS[hashId(projectId) % PROJECT_EMOJIS.length];
}

function baseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || PROD_BASE_URL;
}

function gateDisplayName(gateId: string): string {
  const map: Record<string, string> = {
    gate1: 'G1 — Avatar Excavation',
    gate2: 'G2 — Voice / Language DNA',
    gate3: 'G3 — Root Cause / Mechanism',
    gate4: 'G4 — Hooks',
    gate5: 'G5 — Objections',
    gate6: 'G6 — Copy Concepts',
    gate7: 'G7 — Static Ad Studio',
    gate8: 'G8 — Image Generation',
    gate9: 'G9 — Campaign Blueprint',
    'brand-dna': 'Brand DNA',
  };
  return map[gateId] ?? gateId;
}

function projectLink(projectId: string, gateId: string): string {
  if (gateId === 'brand-dna') return `${baseUrl()}/project/${projectId}/brand-dna`;
  return `${baseUrl()}/project/${projectId}/gate/${gateId}`;
}

async function post(payload: { embeds: unknown[] }): Promise<void> {
  try {
    await fetch(`${baseUrl()}/api/notify/discord`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Swallow — notifications must never break the pipeline
  }
}

export function notifyGateStart(gateId: string, projectId: string, projectName?: string): void {
  void post({
    embeds: [{
      author: { name: `${projectEmoji(projectId)} ${projectName ?? 'Projet'} · ${projectId.slice(0, 6)}` },
      title: `🚀 ${gateDisplayName(gateId)} — Démarrage`,
      color: COLOR_START,
      url: projectLink(projectId, gateId),
      timestamp: new Date().toISOString(),
      footer: { text: `Projet ${projectId}` },
    }],
  });
}

export function notifyGateEnd(params: {
  gateId: string;
  projectId: string;
  projectName?: string;
  durationMs: number;
  preview?: string;
  score?: number;
  status?: string;
}): void {
  const { gateId, projectId, projectName, durationMs, preview, score, status } = params;
  const seconds = Math.round(durationMs / 1000);
  const mins = Math.floor(seconds / 60);
  const durStr = mins > 0 ? `${mins}m ${seconds % 60}s` : `${seconds}s`;

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: '⏱ Durée', value: durStr, inline: true },
  ];
  if (typeof score === 'number') {
    fields.push({ name: '📊 Score', value: `${score}%`, inline: true });
  }
  if (status) {
    fields.push({ name: '📌 Statut', value: status, inline: true });
  }

  const isGood = status !== 'error' && status !== 'stuck';
  const color = status === 'stuck' ? COLOR_WARN : isGood ? COLOR_SUCCESS : COLOR_ERROR;
  const icon = status === 'stuck' ? '⚠️' : isGood ? '✅' : '❌';

  void post({
    embeds: [{
      author: { name: `${projectEmoji(projectId)} ${projectName ?? 'Projet'} · ${projectId.slice(0, 6)}` },
      title: `${icon} ${gateDisplayName(gateId)} — Terminé`,
      description: preview ? `\`\`\`\n${preview.slice(0, 900)}\n\`\`\`` : undefined,
      color,
      url: projectLink(projectId, gateId),
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: `Projet ${projectId} · Clique le titre pour ouvrir la gate` },
    }],
  });
}

export function notifyGateError(params: {
  gateId: string;
  projectId: string;
  projectName?: string;
  durationMs: number;
  error: string;
}): void {
  const { gateId, projectId, projectName, durationMs, error } = params;
  const seconds = Math.round(durationMs / 1000);

  void post({
    embeds: [{
      author: { name: `${projectEmoji(projectId)} ${projectName ?? 'Projet'} · ${projectId.slice(0, 6)}` },
      title: `❌ ${gateDisplayName(gateId)} — Erreur`,
      description: `\`\`\`\n${error.slice(0, 900)}\n\`\`\``,
      color: COLOR_ERROR,
      url: projectLink(projectId, gateId),
      fields: [{ name: '⏱ Durée avant échec', value: `${seconds}s`, inline: true }],
      timestamp: new Date().toISOString(),
      footer: { text: `Projet ${projectId}` },
    }],
  });
}

// ---------- Preview extraction per gate ----------

export function extractPreview(gateId: string, parsedOutput: Record<string, unknown> | null | undefined): string {
  if (!parsedOutput) return '';
  try {
    switch (gateId) {
      case 'gate1': {
        const subs = parsedOutput.sub_avatars as Array<{ name?: string; nickname?: string }> | undefined;
        if (subs?.length) {
          return `${subs.length} sub-avatars: ` + subs.slice(0, 4).map(s => s.nickname || s.name).filter(Boolean).join(', ');
        }
        return '';
      }
      case 'gate2': {
        const dossier = parsedOutput.dossier as Record<string, unknown> | undefined;
        const voice = (dossier?.voice ?? parsedOutput.language_profile ?? parsedOutput.voice) as unknown;
        return typeof voice === 'string' ? voice : JSON.stringify(voice ?? parsedOutput).slice(0, 300);
      }
      case 'gate3': {
        const rc = (parsedOutput.root_cause ?? (parsedOutput.mechanism as Record<string, unknown>)?.name) as unknown;
        return typeof rc === 'string' ? rc : JSON.stringify(rc ?? '').slice(0, 300);
      }
      case 'gate4': {
        const hooks = parsedOutput.top_hooks as Array<{ hook?: string; text?: string; score?: number }> | undefined;
        if (hooks?.length) {
          return hooks.slice(0, 3).map(h => `• ${(h.hook || h.text || '').slice(0, 80)}${h.score ? ` (${h.score})` : ''}`).join('\n');
        }
        return '';
      }
      case 'gate5': {
        const obj = parsedOutput.objections as Array<{ objection?: string; cluster?: string }> | undefined;
        if (obj?.length) return `${obj.length} clusters: ` + obj.slice(0, 4).map(o => o.cluster || o.objection).filter(Boolean).join(' / ');
        return '';
      }
      case 'gate6': {
        const concepts = parsedOutput.concepts as Array<{ headline?: string; name?: string }> | undefined;
        if (concepts?.length) return concepts.slice(0, 3).map(c => `• ${c.headline || c.name}`).join('\n');
        return '';
      }
      case 'gate7': {
        const briefs = parsedOutput.preset_briefs as unknown[] | undefined;
        return briefs ? `${briefs.length} briefs créatifs générés (8 presets × 3)` : '';
      }
      case 'gate8': {
        const imgs = parsedOutput.generated_images as unknown[] | undefined;
        return imgs ? `${imgs.length} configs d'images (3 formats)` : '';
      }
      case 'gate9': {
        const cs = parsedOutput.campaign_structure as Record<string, unknown> | undefined;
        return cs ? JSON.stringify(cs).slice(0, 300) : '';
      }
      case 'brand-dna': {
        const name = (parsedOutput.mechanism_name ?? (parsedOutput.locked_terms as Record<string, unknown>)?.mechanism_name) as unknown;
        return typeof name === 'string' ? `Mechanism: ${name}` : '';
      }
      default:
        return '';
    }
  } catch {
    return '';
  }
}
