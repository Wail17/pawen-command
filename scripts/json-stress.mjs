import fs from 'node:fs';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\\n/g, '').replace(/\\r/g, '').trim();
    env[m[1]] = v;
  }
}

async function test(model, maxTokens, prompt, validate) {
  const t0 = Date.now();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json();
  if (!r.ok) return { ok: false, err: JSON.stringify(j).slice(0, 200) };
  const txt = j.content[0].text.trim();
  const stopReason = j.stop_reason;
  try {
    const cleaned = txt.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    const valid = validate(parsed);
    return {
      ok: valid,
      stopReason,
      tokensOut: j.usage.output_tokens,
      maxTokens,
      truncated: j.usage.output_tokens >= maxTokens - 10,
      ms: Date.now() - t0,
      err: valid ? null : 'validation failed',
    };
  } catch (e) {
    return { ok: false, stopReason, tokensOut: j.usage.output_tokens, maxTokens, truncated: j.usage.output_tokens >= maxTokens - 10, ms: Date.now() - t0, err: 'JSON parse: ' + e.message };
  }
}

const results = [];

console.log('Testing JSON output stability at various token caps...\n');

results.push({ name: 'Opus small JSON (200 tok cap)', ...(await test(
  'claude-opus-4-6', 500,
  'Output ONLY raw JSON (no fences): an array of 3 fake customer quotes, each with {quote, emotion, source}.',
  p => Array.isArray(p) && p.length === 3 && p.every(x => x.quote && x.emotion)
))});

results.push({ name: 'Sonnet medium JSON (4k cap)', ...(await test(
  'claude-sonnet-4-6', 4000,
  'Output ONLY raw JSON (no fences, no prose): an array of 20 fake Meta Ad hook variations. Each: {hook_text, angle, awareness_level}. Make them varied.',
  p => Array.isArray(p) && p.length >= 15 && p.every(x => x.hook_text)
))});

results.push({ name: 'Opus large JSON (16k cap)', ...(await test(
  'claude-opus-4-6', 16000,
  'Output ONLY raw JSON (no fences, no prose): an array of 60 fake Meta Ad hooks. Each: {hook_text, angle, awareness_level, rationale}. Varied hooks, realistic rationales (2-3 sentences each).',
  p => Array.isArray(p) && p.length >= 40
))});

console.log('=== JSON STRESS TEST ===\n');
for (const r of results) {
  const icon = r.ok ? 'OK  ' : 'FAIL';
  const trunc = r.truncated ? ' TRUNCATED' : '';
  console.log(`[${icon}] ${r.name.padEnd(35)} ${r.tokensOut}/${r.maxTokens} tok  stop=${r.stopReason}${trunc}  ${r.ms}ms${r.err ? '  err=' + r.err : ''}`);
}
