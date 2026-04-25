// Bulk set env vars on Vercel production. For each var:
//   1. attempt `vercel env rm VAR production -y` (silent if missing)
//   2. echo VALUE | vercel env add VAR production
// Reports per-var success/fail.

import { spawn } from 'node:child_process';

const VARS = {
  EXA_API_KEY: 'ba8bb7a8-fc43-46da-9cca-53fcfdd8c76d',
  BRIGHTDATA_API_KEY: '04c5ddd1-14b9-4743-befb-a99a3ae140c5',
  BRIGHTDATA_DATASET_ID_REDDIT_POSTS: 'gd_lvz8ah06191smkebj4',
  BRIGHTDATA_DATASET_ID_REDDIT_COMMENTS: 'gd_lvzdpsdlw09j6t702',
  BRIGHTDATA_DATASET_ID_QUORA: 'gd_lvz1rbj81afv3m6n5y',
  BRIGHTDATA_DATASET_ID_TIKTOK_POSTS: 'gd_lu702nij2f790tmv9h',
  BRIGHTDATA_DATASET_ID_TIKTOK_COMMENTS: 'gd_lkf2st302ap89utw5k',
  BRIGHTDATA_DATASET_ID_TIKTOK_PROFILES: 'gd_l1villgoiiidt09ci',
  BRIGHTDATA_DATASET_ID_INSTAGRAM_PROFILES: 'gd_l1vikfch901nx3by4',
  BRIGHTDATA_DATASET_ID_INSTAGRAM_POSTS: 'gd_lk5ns7kz21pck8jpis',
  BRIGHTDATA_DATASET_ID_INSTAGRAM_REELS: 'gd_lyclm20il4r5helnj',
  BRIGHTDATA_DATASET_ID_INSTAGRAM_COMMENTS: 'gd_ltppn085pokosxh13',
  BRIGHTDATA_DATASET_ID_YOUTUBE_VIDEOS: 'gd_lk56epmy2i5g7lzu0k',
  BRIGHTDATA_DATASET_ID_YOUTUBE_CHANNELS: 'gd_lk538t2k2p1k3oos71',
  BRIGHTDATA_DATASET_ID_YOUTUBE_COMMENTS: 'gd_lk9q0ew71spt1mxywf',
  BRIGHTDATA_DATASET_ID_AMAZON_PRODUCTS: 'gd_l7q7dkf244hwjntr0',
  BRIGHTDATA_DATASET_ID_AMAZON_REVIEWS: 'gd_le8e811kzy4ggddlq',
  BRIGHTDATA_DATASET_ID_AMAZON_SEARCH: 'gd_lwdb4vjm1ehb499uxs',
  VOYAGE_API_KEY: 'pa-GiMB0Cj8BateO1fUrPy_EwUquI0klydFr34s00MjRuh',
  USE_NEW_SCRAPING_STACK: '1',
};

function runVercel(args, stdinValue) {
  return new Promise(resolve => {
    const child = spawn('npx', ['-y', 'vercel@latest', ...args], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    if (stdinValue !== undefined) {
      child.stdin.write(stdinValue + '\n');
      child.stdin.end();
    }
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

const results = [];
for (const [name, value] of Object.entries(VARS)) {
  process.stdout.write(`→ ${name.padEnd(50)} `);
  // Step 1: rm (silent if missing)
  const rm = await runVercel(['env', 'rm', name, 'production', '-y']);
  // Step 2: add via stdin
  const add = await runVercel(['env', 'add', name, 'production'], value);
  const ok = add.code === 0;
  if (ok) {
    process.stdout.write(`✓ added\n`);
  } else {
    process.stdout.write(`✗ FAILED (code=${add.code})\n`);
    console.log(`  stderr: ${add.stderr.slice(-300)}`);
  }
  results.push({ name, ok, rmCode: rm.code, addCode: add.code, stderr: add.stderr.slice(-200) });
}

const okCount = results.filter(r => r.ok).length;
console.log(`\n${okCount}/${results.length} env vars set on Vercel production.`);

if (okCount < results.length) {
  console.log('\nFailures:');
  for (const r of results.filter(r => !r.ok)) {
    console.log(`  - ${r.name}: ${r.stderr}`);
  }
  process.exit(1);
}
