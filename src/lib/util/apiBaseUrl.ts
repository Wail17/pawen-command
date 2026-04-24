// ============================================================
// PAWEN — Internal API base URL helper (client+server safe)
//
// Source fetchers + runAvatarExcavation use `fetch('/api/X')` paths.
// In the browser they resolve naturally; under Node we need an
// absolute URL. This module exposes a thin `apiUrl(path)` shim that:
//   - in the browser → returns the path unchanged
//   - on the server → consults a resolver function installed by
//     `internalContext.ts` (server-only, ALS-scoped). If no resolver
//     is installed, returns the path unchanged.
//
// IMPORTANT: this file MUST NOT import any Node-only modules so it
// stays bundleable into client components. `node:async_hooks` lives
// behind a `'server-only'` import in `internalContext.ts`.
// ============================================================

declare global {
  // eslint-disable-next-line no-var
  var __pawenResolveInternalUrl: ((path: string) => string) | undefined;
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const resolver = globalThis.__pawenResolveInternalUrl;
  if (!resolver) return path;
  return resolver(path);
}

// Back-compat shim: nothing should call this anymore. Old code paths
// that imported `setInternalBaseUrl` get a no-op so the build stays
// green during the migration window.
export function setInternalBaseUrl(_url: string | null): void {
  // no-op — see src/lib/util/internalContext.ts
}
