import { jsonrepair } from 'jsonrepair';

// Realistic deep truncation: 2 sub_avatars done, 3rd cuts mid-verbatim
const truncated = `\`\`\`json
{
  "sub_avatars": [
    {
      "id": "sa-1",
      "name": "The Anxiety-Loop Insomniac",
      "nickname": "Bucle",
      "dominant_category": "experience",
      "verbatim_quotes": [
        { "quote": "my brain wont stop", "source_url": "https://reddit.com/r/insomnia/abc", "source_type": "reddit" },
        { "quote": "i lay there for hours", "source_url": "https://reddit.com/r/insomnia/def", "source_type": "reddit" }
      ],
      "urgency_score": 9
    },
    {
      "id": "sa-2",
      "name": "Shift Worker",
      "verbatim_quotes": [
        { "quote": "night shift kills me", "source_url": "https://reddit.com/r/nightshift/x", "source_type": "reddit" },
        { "quote": "cant sleep during day", "source_url": "https://forums.com/y", "source_type": "forums"`;

console.log('Input length:', truncated.length, 'chars');

const start = truncated.indexOf('{');
const slice = truncated.slice(start);
try {
  const repaired = jsonrepair(slice);
  const parsed = JSON.parse(repaired);
  console.log('SUCCESS: parsed', parsed.sub_avatars.length, 'sub_avatars');
  parsed.sub_avatars.forEach((sa, i) => {
    console.log(`  sa-${i + 1}: name="${sa.name}", verbatims=${(sa.verbatim_quotes || []).length}`);
  });
} catch (e) {
  console.log('FAILED:', e.message);
}

// === TEST 2: extreme case — only opening brace ===
console.log('\n=== TEST 2: only opening brace ===');
try {
  const r = jsonrepair('{');
  console.log('repaired to:', r, '→ parses to:', JSON.parse(r));
} catch (e) {
  console.log('FAILED:', e.message);
}

// === TEST 3: realistic mid-string with unclosed array ===
console.log('\n=== TEST 3: half-finished sub_avatar ===');
const half = `\`\`\`json
{ "sub_avatars": [ { "id": "sa-1", "name": "test", "verbatim_quotes": [ { "quote": "I have been struggling for years and noth`;
try {
  const start3 = half.indexOf('{');
  const r = jsonrepair(half.slice(start3));
  const p = JSON.parse(r);
  console.log('repaired OK. sub_avatars:', p.sub_avatars.length);
  console.log('first sa:', JSON.stringify(p.sub_avatars[0]));
} catch (e) {
  console.log('FAILED:', e.message);
}
