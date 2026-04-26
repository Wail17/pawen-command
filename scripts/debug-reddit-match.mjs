// Probe: post search URL vs comments post_url — are they identical?

const PROD = process.env.TEST_PROD_URL || 'https://pawen-command-center.vercel.app';
const APP_PW = process.env.APP_PASSWORD;
const ADMIN_PW = process.env.ADMIN_PASSWORD;

const loginRes = await fetch(`${PROD}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW },
  body: JSON.stringify({ password: APP_PW, user: 'Sykss' }),
});
const cookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
console.log('✓ logged in\n');
const headers = { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_PW, Cookie: cookie };

const res = await fetch(`${PROD}/api/scraping/debug-comments`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    datasetId: 'gd_lvzdpsdlw09j6t702',
    url: 'https://www.reddit.com/r/dogs/comments/1svbvvu/cant_poop_on_pads/',
    type: 'url_collection',
  }),
});
const data = await res.json();
console.log(`rows: ${data.rowCount}`);
if (data.sample?.length) {
  for (let i = 0; i < Math.min(3, data.sample.length); i++) {
    const row = data.sample[i];
    console.log(`\n--- row ${i} ---`);
    console.log(`  url:          ${row.url}`);
    console.log(`  post_url:     ${row.post_url}`);
    console.log(`  post_id:      ${row.post_id}`);
    console.log(`  comment:      ${(row.comment ?? '').slice(0, 100)}`);
    console.log(`  user_posted:  ${row.user_posted}`);
    console.log(`  num_upvotes:  ${row.num_upvotes}`);
    console.log(`  input.url:    ${row.input?.url}`);
  }
}
