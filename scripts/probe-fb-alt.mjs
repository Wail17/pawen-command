const token = (process.env.APIFY_TOKEN ?? '').trim();

// Try sovereigntaylor/facebook-scraper (listed FREE) with 1GB memory
async function tryActor(actor, input, memMb = 1024) {
  console.log(`\n=== ${actor} (mem=${memMb}MB) ===`);
  console.log('input:', JSON.stringify(input).slice(0, 200));
  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor.replace('/', '~')}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180&memory=${memMb}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(220_000) },
    );
    const ms = Date.now() - t0;
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.log(`  FAIL ${res.status} (${ms}ms):`, t.slice(0, 400));
      return;
    }
    const items = await res.json();
    console.log(`  count=${Array.isArray(items) ? items.length : 'not array'} (${ms}ms)`);
    if (Array.isArray(items) && items.length > 0) {
      console.log('  first keys:', Object.keys(items[0]).slice(0, 20).join(', '));
      for (let i = 0; i < Math.min(5, items.length); i++) {
        const p = items[i];
        const text = (p.text ?? p.caption ?? p.message ?? p.postText ?? '').slice(0, 100).replace(/\s+/g, ' ');
        console.log(`  [${i + 1}] ${text}`);
      }
    }
  } catch (e) {
    console.log('  THREW:', e.message);
  }
}

// Test with known public sleep/insomnia pages
const pages = [
  'https://www.facebook.com/SleepFoundation/',
  'https://www.facebook.com/betterhealthchannel/',
];

// Sovereigntaylor schema may differ; try common input shapes
await tryActor('sovereigntaylor/facebook-scraper', {
  startUrls: pages.map((url) => ({ url })),
  resultsLimit: 25,
});
