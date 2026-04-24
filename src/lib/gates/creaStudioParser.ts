// ============================================================
// Creative Studio output parser
// Extracts structured image concepts from ZAK / EVOLVE markdown.
// Each prompt is instructed to append a ```json fenced block at
// the end with an array of concepts — we pull that block.
// ============================================================

export interface StudioConcept {
  id: string;
  style: 'zak' | 'evolve';
  headline: string;
  imagePrompt: string;        // the actual fal.ai prompt (built from description)
  variations: string[];       // alt headlines to test on the same image
  psychAngle?: string;
  reference?: string;         // EVOLVE: which ref ad inspired this
  mood?: string;
  palette?: string[];
}

interface ParsedConceptRaw {
  headline?: string;
  image_description?: string;
  image_prompt?: string;
  background?: string;
  subject?: string;
  secondary?: string;
  palette?: string[] | string;
  mood?: string;
  typography?: string;
  variations?: string[];
  psych_angle?: string;
  reference?: string;
}

function extractJsonBlock(md: string): unknown {
  // Prefer ```json fenced block
  const fenced = md.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }
  // Fallback: last fenced block of any language, try parse
  const any = md.match(/```[a-z]*\s*([\s\S]*?)```(?![\s\S]*```)/i);
  if (any) {
    try { return JSON.parse(any[1].trim()); } catch { /* ignore */ }
  }
  // Last resort: find a bare array starting with [ ending with ]
  const bare = md.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (bare) {
    try { return JSON.parse(bare[0]); } catch { /* ignore */ }
  }
  return null;
}

function buildImagePrompt(raw: ParsedConceptRaw): string {
  if (raw.image_prompt && raw.image_prompt.length > 20) return raw.image_prompt;
  if (raw.image_description && raw.image_description.length > 20) return raw.image_description;
  const parts: string[] = [];
  if (raw.subject) parts.push(raw.subject);
  if (raw.background) parts.push(`background: ${raw.background}`);
  if (raw.secondary) parts.push(raw.secondary);
  if (raw.mood) parts.push(`mood: ${raw.mood}`);
  if (raw.typography) parts.push(`typography: ${raw.typography}`);
  const pal = Array.isArray(raw.palette) ? raw.palette.join(', ') : raw.palette;
  if (pal) parts.push(`color palette: ${pal}`);
  parts.push('editorial photography, sharp focus, commercial quality, 8k');
  return parts.filter(Boolean).join('. ');
}

export function parseStudioConcepts(markdown: string, style: 'zak' | 'evolve'): StudioConcept[] {
  if (!markdown) return [];
  const parsed = extractJsonBlock(markdown);
  if (!Array.isArray(parsed)) return [];

  const concepts: StudioConcept[] = [];
  const prefix = style === 'zak' ? 'zak' : 'evolve';
  for (let i = 0; i < parsed.length; i++) {
    const raw = parsed[i] as ParsedConceptRaw;
    if (!raw || typeof raw !== 'object') continue;
    const headline = (raw.headline ?? '').trim();
    if (!headline) continue;
    const imagePrompt = buildImagePrompt(raw);
    if (!imagePrompt) continue;
    const variations = Array.isArray(raw.variations)
      ? raw.variations.filter((v): v is string => typeof v === 'string' && v.length > 2)
      : [];
    const palette = Array.isArray(raw.palette)
      ? raw.palette.filter((p): p is string => typeof p === 'string')
      : typeof raw.palette === 'string'
        ? raw.palette.split(',').map(s => s.trim()).filter(Boolean)
        : [];
    concepts.push({
      id: `${prefix}-${Date.now()}-${i}`,
      style,
      headline,
      imagePrompt,
      variations,
      psychAngle: raw.psych_angle?.trim(),
      reference: raw.reference?.trim(),
      mood: raw.mood?.trim(),
      palette,
    });
  }
  return concepts;
}

// JSON output instruction appended to each style's system prompt.
export const ZAK_JSON_APPEND = `

=== FINAL REQUIREMENT: MACHINE-READABLE JSON BLOCK ===
After the markdown output above, append a \`\`\`json fenced code block containing an array of the 5 image ad briefs from Phase 2 in this exact shape:

\`\`\`json
[
  {
    "headline": "exact headline text",
    "image_description": "full vivid scene description — subject, background, lighting, composition, mood, colors",
    "variations": ["alt headline 1", "alt headline 2"],
    "psych_angle": "the psychological angle in 3-5 words",
    "palette": ["#hex1","#hex2"],
    "mood": "one-word mood"
  }
]
\`\`\`

The JSON block is mandatory — it feeds the image factory. The image_description must be ONE long sentence ready to pass to a text-to-image model (no bullet points, no markdown inside).`;

export const EVOLVE_JSON_APPEND = `

=== FINAL REQUIREMENT: MACHINE-READABLE JSON BLOCK ===
After the markdown output above, append a \`\`\`json fenced code block containing an array of the 9 full image ad briefs from Step 2 in this exact shape:

\`\`\`json
[
  {
    "headline": "exact short headline (6-8 words)",
    "image_description": "full vivid scene description ready for text-to-image — subject, background, typography direction, mood, composition, colors",
    "variations": ["iteration 1", "iteration 2"],
    "reference": "which reference ad inspired this (Ryanair/Tesla/etc)",
    "palette": ["#hex1","#hex2"],
    "mood": "one-word mood"
  }
]
\`\`\`

The JSON block is mandatory — it feeds the image factory. The image_description must be ONE long sentence ready for a text-to-image model (no bullet points, no markdown).`;
