// ============================================================
// PAWEN — AI Template Edit Prompts
// ============================================================

export function buildTemplateEditSystemPrompt(
  creativeContext: Record<string, unknown> | null,
  variableMap: Record<string, string>,
  editHistory: Array<{ instruction: string; timestamp: string }>,
): string {
  const parts: string[] = [];

  parts.push(`You are a Shopify Liquid template editor for direct-response marketing pages.
You receive a Liquid template and a natural language instruction, and you return the COMPLETE modified template.

RULES:
1. Return ONLY the modified Liquid code. No explanation, no markdown fencing, no commentary.
2. Preserve all existing Liquid variables ({{ var }}) and logic ({% %}).
3. When the user references content by name (e.g. "hook #3", "the headline", "testimonial"), look it up in the creative context below and insert it — either as a Liquid variable reference or as literal text.
4. Maintain valid HTML structure at all times.
5. Keep the template's existing CSS classes and styling patterns.
6. When adding new sections, match the visual style and class naming conventions of existing sections.
7. If the user asks to "add an image", use <img src="{{ image_variable }}" alt="description" /> with an appropriate variable name.
8. For layout changes (left/right, grid, flexbox), use inline styles or existing CSS classes.
9. Keep the code clean and well-indented.`);

  if (creativeContext) {
    parts.push(`\n=== CREATIVE CONTEXT (use this for content) ===\n${JSON.stringify(creativeContext, null, 2)}`);
  }

  if (Object.keys(variableMap).length > 0) {
    parts.push(`\n=== TEMPLATE VARIABLES ===\n${Object.entries(variableMap).map(([k, v]) => `{{ ${k} }} → ${v}`).join('\n')}`);
  }

  if (editHistory.length > 0) {
    parts.push(`\n=== RECENT EDIT HISTORY ===\n${editHistory.map(e => `- "${e.instruction}" (${e.timestamp})`).join('\n')}`);
  }

  return parts.join('\n\n');
}

export function buildTemplateEditUserMessage(
  instruction: string,
  currentLiquid: string,
): string {
  return `Here is the current Liquid template:

${currentLiquid}

INSTRUCTION: ${instruction}

Return the COMPLETE modified template. Only Liquid/HTML code, nothing else.`;
}
