import fs from 'node:fs';

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\\n/g, '').replace(/\\r/g, '').trim();
    env[m[1]] = v;
  }
}

const results = [];
const time = async (name, fn) => {
  const t0 = Date.now();
  try {
    const info = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, info });
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, err: String(e.message || e).slice(0, 200) });
  }
};

await Promise.all([
  time('Anthropic (Sonnet 4.6) + JSON mode', async () => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'Return ONLY this JSON (no fences, no prose): {"ping":"ok","n":42}' }],
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    const j = await r.json();
    const txt = j.content[0].text.trim();
    const parsed = JSON.parse(txt);
    if (parsed.ping !== 'ok' || parsed.n !== 42) throw new Error('unexpected JSON: ' + txt);
    return `model=${j.model} tokens_in=${j.usage.input_tokens} tokens_out=${j.usage.output_tokens} json_valid=true`;
  }),
  time('Anthropic (Opus 4.6) ping', async () => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-6', max_tokens: 20, messages: [{ role: 'user', content: 'say hi' }] }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    const j = await r.json();
    return `model=${j.model} tokens_out=${j.usage.output_tokens}`;
  }),
  time('Apify', async () => {
    const r = await fetch(`https://api.apify.com/v2/users/me?token=${env.APIFY_TOKEN}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return `user=${j.data.username} plan=${j.data.plan?.id || 'n/a'}`;
  }),
  time('fal.ai', async () => {
    const r = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: { 'Authorization': `Key ${env.FAL_AI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', image_size: 'square', num_inference_steps: 1 }),
    });
    const body = await r.text();
    if (r.status === 401 || r.status === 403) throw new Error(`auth fail ${r.status}: ${body.slice(0, 200)}`);
    return `queue accepted HTTP ${r.status}`;
  }),
  time('Tavily', async () => {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query: 'test', max_results: 1 }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
    const j = await r.json();
    return `results=${j.results?.length || 0}`;
  }),
  time('Firecrawl', async () => {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', formats: ['markdown'] }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 150)}`);
    return `scraped OK`;
  }),
  time('Neon Postgres', async () => {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(env.DATABASE_URL);
    const [row] = await sql`SELECT COUNT(*)::int AS n FROM projects_mirror`;
    return `projects_mirror.count=${row.n}`;
  }),
]);

console.log('\n=== API HEALTH CHECK ===\n');
for (const r of results) {
  const icon = r.ok ? 'OK ' : 'FAIL';
  console.log(`[${icon}] ${r.name.padEnd(38)} ${String(r.ms).padStart(5)}ms  ${r.ok ? r.info : r.err}`);
}
const fails = results.filter(r => !r.ok).length;
console.log(`\n${results.length - fails}/${results.length} OK\n`);
process.exit(fails > 0 ? 1 : 0);
