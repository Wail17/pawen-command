// Calibration test: run scoreChunk over 20 representative texts spanning
// high-quality verbatims (Amazon reviews with specifics), mid-quality
// (vague forum posts), and low-quality (SEO blog filler). Assert the
// bucketing lands where we expect. If thresholds drift, this fails.
//
// Run: npx tsx tests/providers/qualityScore.test.mjs

import { test, runTests, assertTrue } from './mockFetch.mjs';
import { scoreChunk, bucketScores } from '../../src/lib/sources/qualityScore.ts';

const HIGH = [
  { text: 'Last Tuesday my 10-year-old golden retriever had the worst gut episode — diarrhea at 3am, couldn\'t hold it. Vet said estrobolome imbalance. Bought this probiotic, gave 1 capsule with breakfast, by day 4 stool was firm again.', source: 'amazon' },
  { text: '"I\'m not sleeping through the night anymore because of the hot flashes. I wake up at 3am drenched. My husband moved to the guest room."', source: 'reddit' },
  { text: 'Before: 62kg, couldn\'t climb 2 flights without gasping. After 90 days: 55kg, ran my first 5k. Lost 3 pant sizes. Cost: $89/month. Worth every euro.', source: 'amazon' },
  { text: 'My vet charged €120 for a consultation just to tell me "old dog syndrome". This €22 bottle from Amazon worked in 2 weeks. Furious I wasted the vet fee.', source: 'amazon' },
  { text: 'After my hysterectomy at 48 I gained 7kg in 4 months. I don\'t recognize myself in the mirror. I cry in the shower.', source: 'quora' },
];

const MID = [
  { text: 'Pretty good product, my dog seems happier. Would recommend.', source: 'amazon' },
  { text: 'The probiotic helped with some digestive issues my older dog was having.', source: 'reddit' },
  { text: 'I have been using this for a month and see some improvement.', source: 'amazon' },
  { text: 'Works as described. Dog eats it fine.', source: 'amazon' },
  { text: 'My senior chihuahua is doing better on this.', source: 'amazon' },
];

const LOW = [
  { text: 'Dogs benefit from probiotics. Learn more about senior dog health on our blog.', source: 'blog' },
  { text: 'Click here to read about the top 10 supplements for dogs.', source: 'blog' },
  { text: 'Senior dogs need special care. Check our resources.', source: 'blog' },
  { text: 'Subscribe to our newsletter for more tips.', source: 'blog' },
  { text: 'Discover amazing pet products at unbeatable prices.', source: 'blog' },
];

test('High-quality chunks score ≥ 40 on average (no embedding)', () => {
  const scores = HIGH.map(c => scoreChunk(c).total);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  assertTrue(avg >= 40, `HIGH avg=${avg} should be ≥40. scores=${scores.join(',')}`);
});

test('Low-quality chunks score ≤ 35 on average', () => {
  const scores = LOW.map(c => scoreChunk(c).total);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  assertTrue(avg <= 35, `LOW avg=${avg} should be ≤35. scores=${scores.join(',')}`);
});

test('HIGH always beats LOW pairwise (same index)', () => {
  for (let i = 0; i < Math.min(HIGH.length, LOW.length); i++) {
    const h = scoreChunk(HIGH[i]).total;
    const l = scoreChunk(LOW[i]).total;
    assertTrue(h > l, `HIGH[${i}]=${h} should beat LOW[${i}]=${l}`);
  }
});

test('Specificity dimension picks up numbers + body parts', () => {
  const b1 = scoreChunk({ text: 'generic content here', source: 'other' });
  // This text contains: my dog (relational), gut (body part), night (scenario),
  // quoted speech, "last week" (time ref), "25 kg" (number+unit).
  const b2 = scoreChunk({
    text: 'My dog has gut issues — "I feel terrible when he whimpers in the middle of the night" — last week he lost 25 kg. The vet said it\'s serious.',
    source: 'other',
  });
  assertTrue(b2.specificity > b1.specificity, `b2.spec=${b2.specificity} should beat b1.spec=${b1.specificity}`);
});

test('Authority: amazon > blog', () => {
  const a = scoreChunk({ text: 'ok', source: 'amazon' });
  const b = scoreChunk({ text: 'ok', source: 'blog' });
  assertTrue(a.authority > b.authority);
});

test('Bucket distribution from full corpus', () => {
  const all = [...HIGH, ...MID, ...LOW].map(c => scoreChunk(c).total);
  const buck = bucketScores(all);
  assertTrue(buck.totalChunks === 15);
  assertTrue(buck.low >= 3, `at least 3 low in LOW bucket, got ${buck.low}`);
  assertTrue(buck.avgScore > 0);
});

test('Empty text → 0 across the board', () => {
  const r = scoreChunk({ text: '', source: 'reddit' });
  assertTrue(r.specificity === 0);
  assertTrue(r.emotion === 0);
  // authority still counts (reddit = 15 default)
});

await runTests();
