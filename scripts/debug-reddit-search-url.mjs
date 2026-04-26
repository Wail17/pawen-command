// Probe: what URLs does the Reddit POSTS dataset return for a search?
// Compares to what the comments dataset expects.

const PROD = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';
const APP_PW = process.env.APP_PASSWORD;
const ADMIN_PW = process.env.ADMIN_PASSWORD;

const loginRes = await fetch(`${PROD}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
  body: JSON.stringify({ password: APP_PW, user: 'Sykss' }),
});
const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
console.log('✓ logged in');

// Hit the prod scraping fetch with reddit only, just 3 posts, NO comments hydration
const res = await fetch(`${PROD}/api/scraping/fetch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, Cookie: cookie },
  body: JSON.stringify({
    source: 'reddit',
    plan: { queries: ['senior dog probiotic'], subreddits: ['dogs', 'DogAdvice'] },
    language: 'en-US',
  }),
});
const data = await res.json();
if (!data.ok) { console.log(JSON.stringify(data, null, 2).slice(0, 1500)); process.exit(1); }
const items = data.data?.items ?? [];
console.log(`\n=== ${items.length} reddit items returned ===`);
for (const r of items.slice(0, 8)) {
  const commentLine = (r.content ?? '').match(/--- COMMENTS \(\d+\)/);
  console.log(`url: ${r.url}`);
  console.log(`   commentBlock: ${commentLine ? commentLine[0] : 'NONE'}`);
  console.log(`   content head: ${(r.content ?? '').slice(0, 140).replace(/\n/g, ' ')}`);
}
