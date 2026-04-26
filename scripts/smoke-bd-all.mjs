// Probe every BrightData dataset the adapters use. Parallel triggers,
// parallel polls. Surfaces HTTP 400 (wrong fields) AND row schemas.

import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const KEY = env.BRIGHTDATA_API_KEY;
const KEYWORD = process.argv[2] ?? 'senior dog probiotic';

// Mirror what each adapter sends. KEEP IN SYNC with the adapter trigger code.
const PROBES = [
  {
    name: 'reddit-posts (keyword)',
    dataset: 'gd_lvz8ah06191smkebj4',
    discoverBy: 'keyword',
    inputs: [{ keyword: KEYWORD, num_of_posts: 3, date: 'All time', sort_by: 'Hot' }],
  },
  {
    name: 'quora (search_url)',
    dataset: 'gd_lvz1rbj81afv3m6n5y',
    discoverBy: 'search_url',
    inputs: [{ url: `https://www.quora.com/search?q=${encodeURIComponent(KEYWORD)}` }],
  },
  {
    name: 'tiktok-posts (keyword)',
    dataset: 'gd_lu702nij2f790tmv9h',
    discoverBy: 'keyword',
    inputs: [{ search_keyword: KEYWORD, num_of_posts: 3 }],
  },
  {
    name: 'youtube-videos (keyword)',
    dataset: 'gd_lk56epmy2i5g7lzu0k',
    discoverBy: 'keyword',
    inputs: [{ keyword: KEYWORD, num_of_posts: 3, country: '', start_date: '', end_date: '' }],
  },
  {
    name: 'instagram-reels (hashtag_url)',
    dataset: 'gd_lyclm20il4r5helnj',
    discoverBy: 'hashtag_url',
    inputs: [{ url: `https://www.instagram.com/explore/tags/${KEYWORD.toLowerCase().replace(/[^a-z0-9]/g, '')}/`, num_of_posts: 3 }],
  },
  {
    name: 'amazon-search (url_collection)',
    dataset: 'gd_lwdb4vjm1ehb499uxs',
    type: 'url_collection',
    inputs: [{ url: `https://amazon.com/s?k=${encodeURIComponent(KEYWORD)}`, keyword: KEYWORD }],
  },
];

async function trigger(p) {
  const params = new URLSearchParams({ dataset_id: p.dataset, include_errors: 'true', type: p.type ?? 'discover_new' });
  if (p.discoverBy) params.set('discover_by', p.discoverBy);
  const res = await fetch(`https://api.brightdata.com/datasets/v3/trigger?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(p.inputs),
  });
  const text = await res.text();
  return { name: p.name, status: res.status, body: text };
}

async function poll(snapshotId, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    const res = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    if (res.status === 202) continue;
    if (!res.ok) return { error: `${res.status}: ${(await res.text()).slice(0, 200)}` };
    const data = await res.json();
    return { rows: Array.isArray(data) ? data : [data] };
  }
  return { error: 'timeout' };
}

console.log('=== TRIGGER PHASE ===');
const triggered = await Promise.all(PROBES.map(trigger));
const ok = [];
for (const t of triggered) {
  if (t.status === 200) {
    const j = JSON.parse(t.body);
    console.log(`✓ ${t.name.padEnd(40)} snapshot=${j.snapshot_id}`);
    ok.push({ name: t.name, snapshotId: j.snapshot_id });
  } else {
    console.log(`✗ ${t.name.padEnd(40)} ${t.status} ${t.body.slice(0, 250)}`);
  }
}

if (ok.length === 0) process.exit(1);

console.log('\n=== POLL PHASE (parallel, max 4 min each) ===');
const polled = await Promise.all(ok.map(async o => ({ name: o.name, ...(await poll(o.snapshotId)) })));
for (const p of polled) {
  if (p.error) {
    console.log(`✗ ${p.name.padEnd(40)} ${p.error}`);
    continue;
  }
  const n = p.rows.length;
  const cost = ((n / 1000) * 1.5).toFixed(3);
  console.log(`✓ ${p.name.padEnd(40)} ${n} rows (~$${cost})`);
  if (n > 0) {
    console.log(`  fields: ${Object.keys(p.rows[0]).join(', ')}`);
  }
}
