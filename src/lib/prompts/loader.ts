// ============================================================
// PAWEN — Prompt Loader
// Loads prompt templates from /src/prompts/ markdown files
// Server-side only (API routes) — for client-side, prompts are inline
// ============================================================

import fs from 'fs';
import path from 'path';

const PROMPTS_DIR = path.join(process.cwd(), 'src', 'prompts', 'gates');

export function loadPrompt(filename: string): string {
  const filePath = path.join(PROMPTS_DIR, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    console.error(`Failed to load prompt: ${filename}`);
    return '';
  }
}

// Pre-load all gate prompts
export const GATE_PROMPTS = {
  gate1: {
    generator: () => loadPrompt('gate1-generator.md'),
    reviewer: () => loadPrompt('gate1-reviewer.md'),
  },
  gate2: {
    generator: () => loadPrompt('gate2-generator.md'),
    reviewer: () => loadPrompt('gate2-reviewer.md'),
  },
  gate3: {
    generator: () => loadPrompt('gate3-generator.md'),
    reviewer: () => loadPrompt('gate3-reviewer.md'),
  },
  universal: {
    reviewer: () => loadPrompt('universal-reviewer.md'),
    example: () => loadPrompt('example-root-cause-output.md'),
  },
} as const;
