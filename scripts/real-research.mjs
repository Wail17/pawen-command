// Real research orchestrator: scrape 5 sources via Bright Data,
// extract verbatims/comments, score quality, embed via Voyage.
// Stop after Voyage with a stats report. No Anthropic analysis call.
//
// Usage: npx -y dotenv-cli -e .env.local -- node scripts/real-research.mjs
//
// Cost estimate: ~$5-12 BD + ~$0.10 Voyage. Wall time: 5-10 min.

const PROD = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';
const APP_PW = process.env.APP_PASSWORD;
const ADMIN_PW = process.env.ADMIN_PASSWORD;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY;

if (!APP_PW || !ADMIN_PW) { console.error('Need APP_PASSWORD + ADMIN_PASSWORD in .env.local'); process.exit(1); }
if (!VOYAGE_KEY) { console.warn('⚠ VOYAGE_API_KEY missing — will fall back to simhash stub'); }

// === Login ===
const loginRes = await fetch(`${PROD}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
  body: JSON.stringify({ password: APP_PW, user: 'Sykss' }),
});
const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
if (!cookie) { console.error('login failed'); process.exit(1); }
console.log(`✓ logged in\n`);

const headers = { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, Cookie: cookie };

// === Plan (hand-coded — no Marcus discovery to keep this focused on plumbing) ===
const NICHE = 'senior dog probiotic';
const PLAN = {
  reddit:  { source: 'reddit',  body: { subreddits: ['dogs', 'DogAdvice', 'puppy101'], queries: [NICHE] } },
  quora:   { source: 'quora',   body: { queries: [`${NICHE} supplement`, `digestive issues senior dogs`] } },
  youtube: { source: 'youtube', body: { video_queries: [NICHE, `senior dog gut health`] } },
  tiktok:  { source: 'tiktok',  body: { search_queries: [NICHE, `dog probiotic review`], hashtags: [] } },
  amazon:  { source: 'amazon',  body: { product_queries: [NICHE, 'senior dog supplement gut health'], marketplace: 'amazon.com' } },
};
const LANG = 'en-US';

// === Fetch each source ===
console.log('=== Fetching sources via /api/scraping/fetch ===\n');
const sourceResults = {};
for (const [name, cfg] of Object.entries(PLAN)) {
  process.stdout.write(`→ ${name.padEnd(10)} `);
  const t0 = Date.now();
  try {
    const res = await fetch(`${PROD}/api/scraping/fetch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ source: cfg.source, plan: cfg.body, language: LANG }),
    });
    const data = await res.json();
    const dur = Date.now() - t0;
    if (!data.ok) {
      console.log(`✗ ${dur}ms · ${data.message ?? 'fail'}`);
      sourceResults[name] = { items: [], err: data.message };
      continue;
    }
    const items = data.data?.items ?? [];
    const totalComments = items.reduce((s, it) => s + (it.comments?.length ?? 0), 0);
    console.log(`✓ ${dur}ms · ${items.length} items · ${totalComments} comments`);
    sourceResults[name] = { items, err: data.data?.error };
    if (data.data?.error) console.log(`  note: ${data.data.error}`);
  } catch (e) {
    console.log(`✗ ${e.message}`);
    sourceResults[name] = { items: [], err: e.message };
  }
}

// === Extract verbatims (chunks of text) from all source items ===
console.log('\n=== Extracting verbatims ===\n');
const chunks = []; // { id, text, source, kind: 'post' | 'comment' | 'review' | 'caption' }
for (const [name, r] of Object.entries(sourceResults)) {
  for (const it of r.items) {
    // Main item text
    const mainText = (it.content ?? it.title ?? '').trim();
    if (mainText.length >= 50) {
      chunks.push({
        id: `${name}-${it.url?.slice(-30)}-main`,
        text: mainText.slice(0, 4000),
        source: name,
        kind: name === 'amazon' ? 'product' : 'post',
      });
    }
    // Comments — these are the GOLD
    for (let i = 0; i < (it.comments?.length ?? 0); i++) {
      const c = it.comments[i];
      if (typeof c === 'string' && c.length >= 30) {
        chunks.push({ id: `${name}-${it.url?.slice(-20)}-c${i}`, text: c.slice(0, 2000), source: name, kind: 'comment' });
      }
    }
  }
}
const byKind = chunks.reduce((acc, c) => { acc[c.kind] = (acc[c.kind] ?? 0) + 1; return acc; }, {});
console.log(`Total chunks: ${chunks.length}`);
console.log(`By kind: ${JSON.stringify(byKind)}`);
console.log(`By source:`);
for (const [name, r] of Object.entries(sourceResults)) {
  const src = chunks.filter(c => c.source === name);
  console.log(`  ${name.padEnd(10)} ${src.length} chunks`);
}

if (chunks.length === 0) {
  console.log('\n⚠ ZERO chunks extracted. Check source errors above.\n');
  process.exit(1);
}

// === Voyage embed (the key test) ===
console.log('\n=== Voyage embedding ===\n');
const VOYAGE_BATCH = 50;
const sample = chunks.slice(0, Math.min(chunks.length, 100)); // cap to control cost
const batches = [];
for (let i = 0; i < sample.length; i += VOYAGE_BATCH) batches.push(sample.slice(i, i + VOYAGE_BATCH));
console.log(`Embedding ${sample.length} chunks in ${batches.length} batches…`);

const embeddings = [];
let totalVoyageTokens = 0;
const t0 = Date.now();
for (const [i, batch] of batches.entries()) {
  process.stdout.write(`  batch ${i + 1}/${batches.length} (${batch.length} texts) … `);
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
    body: JSON.stringify({
      input: batch.map(c => c.text.slice(0, 16_000)),
      model: 'voyage-3-lite',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.log(`✗ HTTP ${res.status}\n  ${err.slice(0, 300)}`);
    break;
  }
  const data = await res.json();
  totalVoyageTokens += data.usage?.total_tokens ?? 0;
  for (const item of (data.data ?? [])) embeddings.push(item.embedding);
  console.log(`✓ ${data.data?.length ?? 0} vectors`);
}
const voyageDur = Date.now() - t0;

if (embeddings.length === 0) {
  console.log('\n⚠ Voyage returned 0 embeddings — check VOYAGE_API_KEY validity.\n');
  process.exit(1);
}

console.log(`\nVoyage: ${embeddings.length} embeddings, ${embeddings[0]?.length} dims each, ${totalVoyageTokens} tokens total, ${(voyageDur/1000).toFixed(1)}s`);
console.log(`Voyage cost estimate: $${(totalVoyageTokens / 1_000_000 * 0.02).toFixed(4)}`);

// === Cosine dedup at threshold 0.92 ===
function cos(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return na && nb ? d/(Math.sqrt(na)*Math.sqrt(nb)) : 0;
}
let collapsed = 0;
const keep = new Set([0]);
for (let i = 1; i < embeddings.length; i++) {
  let dup = false;
  for (const j of keep) {
    if (cos(embeddings[i], embeddings[j]) > 0.92) { dup = true; break; }
  }
  if (!dup) keep.add(i); else collapsed++;
}
console.log(`Dedup at 0.92: ${embeddings.length} → ${keep.size} kept, ${collapsed} collapsed (${(collapsed/embeddings.length*100).toFixed(0)}% reduction)`);

// === Final report ===
console.log('\n=== FINAL ===\n');
const report = {
  niche: NICHE,
  sources: Object.fromEntries(Object.entries(sourceResults).map(([n, r]) => [n, {
    items: r.items.length,
    comments: r.items.reduce((s, i) => s + (i.comments?.length ?? 0), 0),
    err: r.err,
  }])),
  chunks: { total: chunks.length, byKind, byVerbatimRichness: chunks.filter(c => c.kind === 'comment' || c.kind === 'review').length },
  voyage: { dims: embeddings[0]?.length, embeddingsCount: embeddings.length, tokens: totalVoyageTokens, costUsd: (totalVoyageTokens / 1_000_000 * 0.02), durationMs: voyageDur },
  dedup: { before: embeddings.length, after: keep.size, collapsed, reductionPct: (collapsed/embeddings.length*100).toFixed(1) },
};
console.log(JSON.stringify(report, null, 2));
console.log('\n✓ Pipeline OK up to Voyage. Pausing as requested.');
