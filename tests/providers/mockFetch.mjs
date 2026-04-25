// Tiny fetch mocking harness. Replaces globalThis.fetch with a router that
// returns canned responses for each URL substring. Each adapter test file
// installs its own routes via installMockRoutes().
//
// Usage:
//   import { installMockRoutes, restoreFetch } from './mockFetch.mjs';
//   installMockRoutes([{ match: 'api.exa.ai', status: 200, json: {...} }]);
//   ...run assertions...
//   restoreFetch();

const _realFetch = globalThis.fetch;

/** @type {Array<{ match: string | RegExp, status?: number, json?: unknown, text?: string, delay?: number, throws?: string, headers?: Record<string,string> }>} */
let routes = [];

export function installMockRoutes(r) {
  // Routes can carry `times` (default Infinity). When `times` drops to 0 the
  // route is skipped, so later routes with the same `match` can fire. This
  // is how we model polling sequences: first hit 202, subsequent 200.
  routes = r.map(x => ({ ...x, _remaining: x.times ?? Infinity }));
  globalThis.fetch = async (url, init) => {
    const target = typeof url === 'string' ? url : url.url;
    const body = init?.body ? String(init.body) : '';

    for (const route of routes) {
      if (route._remaining <= 0) continue;
      const matches = typeof route.match === 'string'
        ? target.includes(route.match)
        : route.match.test(target);
      if (!matches) continue;

      route._remaining -= 1;
      if (route.delay) await new Promise(res => setTimeout(res, route.delay));
      if (route.throws) throw new Error(route.throws);

      const status = route.status ?? 200;
      const headers = new Headers(route.headers ?? { 'content-type': 'application/json' });
      const payload = route.json !== undefined ? JSON.stringify(route.json) : (route.text ?? '');

      return new Response(payload, { status, headers });
    }

    throw new Error(`No mock route matched: ${target}. body=${body.slice(0,100)}`);
  };
}

export function restoreFetch() {
  globalThis.fetch = _realFetch;
  routes = [];
}

// Mini assertion helpers — avoid bringing in vitest/jest.
export function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

export function assertDeep(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

export function assertTrue(cond, msg = '') {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

export async function assertThrows(fn, expectedSubstring = '', msg = '') {
  let threw = null;
  try { await fn(); } catch (e) { threw = e; }
  if (!threw) throw new Error(`${msg}: expected throw, got none`);
  if (expectedSubstring && !String(threw.message).includes(expectedSubstring)) {
    throw new Error(`${msg}: threw but message didn't include "${expectedSubstring}": ${threw.message}`);
  }
  return threw;
}

export function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k];
    if (vars[k] === null) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return Promise.resolve(fn()).finally(() => {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
}

// Mini test runner
const cases = [];
export function test(name, fn) { cases.push({ name, fn }); }
export async function runTests() {
  let pass = 0, fail = 0;
  for (const c of cases) {
    try {
      await c.fn();
      console.log(`  ✓ ${c.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${c.name}`);
      console.log(`    ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  }
  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
}
