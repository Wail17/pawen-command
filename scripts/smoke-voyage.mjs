// Verify Voyage embedding + rerank endpoints respond on this account.
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const KEY = env.VOYAGE_API_KEY;

async function call(label, url, body) {
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 200); }
  console.log(`${label.padEnd(28)} ${res.status} (${ms}ms) ${typeof parsed === 'object' ? JSON.stringify(parsed).slice(0, 350) : parsed}`);
  return res.ok ? parsed : null;
}

await call('embed voyage-3 (3 docs)', 'https://api.voyageai.com/v1/embeddings', {
  input: ['mon chien a la diarrhée', 'my dog has loose stools', 'random unrelated text about cars'],
  model: 'voyage-3',
});

const rerank = await call('rerank-2-lite (5 docs)', 'https://api.voyageai.com/v1/rerank', {
  query: 'probiotique pour chien senior souffrant de diarrhée',
  documents: [
    'mon chien senior a eu de la diarrhée pendant 2 semaines, le probiotique a aidé',
    'my puppy is so cute',
    'best dog food for older dogs with digestive issues',
    'how to train a horse',
    "j'ai changé les croquettes et les selles sont redevenues normales",
  ],
  model: 'rerank-2-lite',
});

if (rerank) {
  console.log('\nrerank scores (sorted desc):');
  for (const r of rerank.data.sort((a, b) => b.relevance_score - a.relevance_score)) {
    console.log(`  ${r.relevance_score.toFixed(4)}  [doc ${r.index}]`);
  }
}
