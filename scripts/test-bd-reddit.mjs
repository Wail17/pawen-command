// Quick smoke test: hit BrightData Reddit posts dataset with a sample keyword.
// Confirms the API key is valid, account is in good standing, and dataset returns rows.

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const i = l.indexOf('=');
      const k = l.slice(0, i);
      const v = l.slice(i + 1).replace(/^"|"$/g, '');
      return [k, v];
    }),
);

const KEY = env.BRIGHTDATA_API_KEY;
const DATASET = 'gd_lvz8ah06191smkebj4'; // reddit posts default
if (!KEY) { console.error('no key'); process.exit(1); }

const KEYWORD = process.argv[2] ?? 'senior dog probiotic';
const NUM_POSTS = 5;

console.log(`→ trigger BD reddit posts for "${KEYWORD}" (${NUM_POSTS} posts)`);
const triggerRes = await fetch(
  `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${DATASET}&include_errors=true&type=discover_new&discover_by=keyword`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify([{ keyword: KEYWORD, num_of_posts: NUM_POSTS, date: 'All time', sort_by: 'Hot' }]),
  },
);
const triggerText = await triggerRes.text();
console.log(`  status: ${triggerRes.status}`);
console.log(`  body: ${triggerText.slice(0, 500)}`);
if (!triggerRes.ok) process.exit(1);
const { snapshot_id } = JSON.parse(triggerText);
if (!snapshot_id) { console.error('no snapshot_id'); process.exit(1); }

console.log(`→ polling snapshot ${snapshot_id} (max 4 min)`);
const deadline = Date.now() + 240_000;
let polls = 0;
while (Date.now() < deadline) {
  polls++;
  await new Promise(r => setTimeout(r, 4000));
  const res = await fetch(
    `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}?format=json`,
    { headers: { Authorization: `Bearer ${KEY}` } },
  );
  if (res.status === 202) {
    process.stdout.write(`  [${polls}] still running...\r`);
    continue;
  }
  console.log(`\n  [${polls}] status: ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data)) {
    console.log(`  body: ${JSON.stringify(data).slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`✓ got ${data.length} rows (~$${((data.length/1000)*1.5).toFixed(3)})`);
  if (data.length > 0) {
    console.log(`\nfull keys of first row:\n  ${Object.keys(data[0]).join(', ')}`);
    console.log(`\nfirst row dump:\n${JSON.stringify(data[0], null, 2).slice(0, 2000)}`);
  }
  process.exit(0);
}
console.log('timeout');
process.exit(1);
