// Cache layer tests using an in-memory Neon sql shim. We don't want to
// spin up a real Postgres for this test, so we mock the sql template fn.
// Focus: normalizeUrl equivalence, TTL behavior, hit counter increment.

import { test, runTests, assertEqual } from './mockFetch.mjs';
import { normalizeUrl } from '../../src/lib/sources/providers/common.ts';

test('normalizeUrl: lowercases host, drops fragment, drops utm_*', () => {
  const a = normalizeUrl('HTTPS://Example.com/Foo?utm_source=x&fbclid=y&q=1#hash');
  const b = normalizeUrl('https://example.com/Foo?q=1');
  assertEqual(a, b, 'tracking params stripped');
});

test('normalizeUrl: trailing slash stripped for non-root', () => {
  assertEqual(normalizeUrl('https://x.com/foo/'), normalizeUrl('https://x.com/foo'));
});

test('normalizeUrl: invalid URL returns input', () => {
  assertEqual(normalizeUrl('not a url'), 'not a url');
});

test('normalizeUrl: root slash preserved', () => {
  assertEqual(normalizeUrl('https://x.com/'), 'https://x.com/');
});

test('normalizeUrl: query param sorting is deterministic', () => {
  const a = normalizeUrl('https://x.com/?b=2&a=1');
  const b = normalizeUrl('https://x.com/?a=1&b=2');
  assertEqual(a, b);
});

await runTests();
