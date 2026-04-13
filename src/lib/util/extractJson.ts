// ============================================================
// extractJson — robust LLM-output JSON parser
//
// Cascading strategies (each one falls through to the next on failure):
//   1. Strict parse of closed   ```json ... ``` fence content
//   2. Strict parse of UNCLOSED ```json fence (handles mid-output truncation)
//   3. Strict parse of balanced { ... } slice
//   4. jsonrepair() the fence content (closed or unclosed)
//   5. jsonrepair() a "from-first-brace-to-end" slice (key for truncated output)
//   6. jsonrepair() the whole raw text (last resort)
//
// All return paths require the result to be a STRUCTURED OBJECT (non-null,
// non-array, ≥1 key). This protects against jsonrepair turning prose like
// "I cannot help" into ["I","cannot","help"].
// ============================================================

import { jsonrepair } from 'jsonrepair';

function isStructuredObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

function tryParse<T>(raw: string): T | null {
  try {
    const v = JSON.parse(raw);
    return isStructuredObject(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

function tryRepair<T>(raw: string): T | null {
  try {
    const v = JSON.parse(jsonrepair(raw));
    return isStructuredObject(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

export function extractJSON<T = Record<string, unknown>>(text: string): T | null {
  // Closed fence: ```json ... ```
  const closedFence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  // Unclosed fence (truncation case): ```json ... <end of text>
  const openFence = closedFence ? null : text.match(/```(?:json)?\s*\n?([\s\S]*)$/);
  const fenceContent = closedFence ? closedFence[1] : openFence ? openFence[1] : null;

  // === Strategy 1+2: strict parse of fence content ===
  if (fenceContent) {
    const parsed = tryParse<T>(fenceContent);
    if (parsed) return parsed;
  }

  // === Strategy 3: strict parse of balanced-braces slice ===
  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          const parsed = tryParse<T>(text.slice(start, i + 1));
          if (parsed) return parsed;
          break;
        }
      }
    }
  }

  // === Strategy 4: jsonrepair on fence content ===
  if (fenceContent) {
    const repaired = tryRepair<T>(fenceContent);
    if (repaired) return repaired;
  }

  // === Strategy 5: jsonrepair on everything from first brace to end ===
  // Key strategy for truncated output — jsonrepair closes unclosed strings,
  // arrays and objects.
  if (start !== -1) {
    const repaired = tryRepair<T>(text.slice(start));
    if (repaired) return repaired;
  }

  // === Strategy 6: jsonrepair on raw text (last resort) ===
  const repairedRaw = tryRepair<T>(text);
  if (repairedRaw) return repairedRaw;

  return null;
}
