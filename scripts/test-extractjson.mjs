// Mirrors extractJSON() from runAvatarExcavation.ts to verify the cascade
// works in isolation against truncation cases.

import { jsonrepair } from 'jsonrepair';

function isStructuredObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function tryParse(raw) {
  try {
    const v = JSON.parse(raw);
    return isStructuredObject(v) ? v : null;
  } catch { return null; }
}
function tryRepair(raw) {
  try {
    const v = JSON.parse(jsonrepair(raw));
    return isStructuredObject(v) ? v : null;
  } catch { return null; }
}

function extractJSON(text) {
  const closedFence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const openFence = closedFence ? null : text.match(/```(?:json)?\s*\n?([\s\S]*)$/);
  const fenceContent = closedFence ? closedFence[1] : openFence ? openFence[1] : null;

  if (fenceContent) {
    const p = tryParse(fenceContent);
    if (p) return { value: p, strategy: 'fence-strict' };
  }

  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          const p = tryParse(text.slice(start, i + 1));
          if (p) return { value: p, strategy: 'balanced-strict' };
          break;
        }
      }
    }
  }

  if (fenceContent) {
    const p = tryRepair(fenceContent);
    if (p) return { value: p, strategy: 'fence-repair' };
  }
  if (start !== -1) {
    const p = tryRepair(text.slice(start));
    if (p) return { value: p, strategy: 'tail-repair' };
  }
  const p = tryRepair(text);
  if (p) return { value: p, strategy: 'raw-repair' };
  return null;
}

// === Test cases ===
const cases = [
  {
    name: 'Strict happy path',
    input: '```json\n{"sub_avatars":[{"id":"sa-1","name":"OK"}]}\n```',
    expectStrategies: ['fence-strict'],
    minSubAvatars: 1,
  },
  {
    name: 'Original bug truncation (unclosed fence)',
    input: '```json\n{ "sub_avatars": [ { "id": "sa-1", "name": "The Anxiety-Loop Insomniac", "nickname": "Bucle", "dominant_category": "experience", "surface_desire": "want sle',
    expectStrategies: ['fence-repair'],
    minSubAvatars: 1,
  },
  {
    name: 'Deep truncation 2 sub_avatars + half (unclosed fence)',
    input: '```json\n{"sub_avatars":[{"id":"sa-1","name":"A","verbatim_quotes":[{"quote":"x","source_url":"u","source_type":"reddit"}]},{"id":"sa-2","name":"B","verbatim_quotes":[{"quote":"y","source_url":"u2","source_type":"reddit"},{"quote":"unfinished',
    expectStrategies: ['fence-repair'],
    minSubAvatars: 2,
  },
  {
    name: 'No fence, raw object',
    input: 'Here is the JSON: {"sub_avatars":[{"id":"sa-1","name":"X"}]}',
    expectStrategies: ['balanced-strict'],
    minSubAvatars: 1,
  },
  {
    name: 'No fence, truncated raw',
    input: 'Here is JSON: {"sub_avatars":[{"id":"sa-1","name":"X","verbatim_quotes":[{"quote":"unc',
    expectStrategies: ['tail-repair'],
    minSubAvatars: 1,
  },
  {
    name: 'Garbage with no JSON (must be rejected)',
    input: 'I cannot help with this request, sorry.',
    expectStrategies: [null],
  },
  {
    name: 'Apology with truncated JSON attempt after',
    input: 'Sorry, but here is what I have:\n```json\n{"sub_avatars":[{"id":"sa-1","name":"recovered"',
    expectStrategies: ['fence-repair', 'tail-repair'],
    minSubAvatars: 1,
  },
  {
    name: 'Massive valid JSON (5 sub_avatars, full schema)',
    input: '```json\n' + JSON.stringify({
      sub_avatars: Array.from({ length: 5 }, (_, i) => ({
        id: `sa-${i+1}`,
        name: `Avatar ${i+1}`,
        verbatim_quotes: [{ quote: 'a quote', source_url: 'u', source_type: 'reddit' }],
        urgency_score: 7,
      })),
      comparative_table: [],
      final_recommendation: { first_to_test: 'sa-1', reason: 'r', strategy: 's' },
    }) + '\n```',
    expectStrategies: ['fence-strict'],
    minSubAvatars: 5,
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const result = extractJSON(c.input);
  const got = result?.strategy ?? null;
  const strategyOk = c.expectStrategies.includes(got);
  const countOk = c.minSubAvatars
    ? (result?.value?.sub_avatars?.length ?? 0) >= c.minSubAvatars
    : true;
  const ok = strategyOk && countOk;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`       strategy=${got} (expected ${c.expectStrategies.join('|')})`);
  if (result?.value?.sub_avatars) {
    console.log(`       recovered ${result.value.sub_avatars.length} sub_avatars`);
  }
  if (ok) pass++; else fail++;
}
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
