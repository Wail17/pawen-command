// Bundle the worker into a single ESM file at Docker build time.
// Eliminates runtime tsconfig-paths / cross-directory module resolution
// flakiness with tsx + Node ESM linker.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(__dirname, 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: resolve(__dirname, 'dist/index.mjs'),
  // npm packages stay external (loaded from node_modules at runtime); only
  // local TS files (index.ts + everything under ../src/lib/**) get bundled.
  packages: 'external',
  // applies tsconfig `paths` (`@/*` → `../src/*`) so imports inside src/
  // resolve correctly during bundling.
  tsconfig: resolve(__dirname, 'tsconfig.json'),
  // `server-only` is a Next.js-only marker that throws in plain Node;
  // alias it to a no-op stub.
  alias: {
    'server-only': resolve(__dirname, 'stubs/server-only/index.js'),
  },
  // Allow `require()` for any CJS interop esbuild generates inside the bundle.
  banner: {
    js: 'import { createRequire as __cr } from "module"; const require = __cr(import.meta.url);',
  },
  logLevel: 'info',
});
console.log('[build] worker bundle ready: dist/index.mjs');
