// ============================================================
// PAWEN — Internal request context (server only)
//
// AsyncLocalStorage-backed context for server-side pipeline jobs.
// Each call to `withInternalContext({ baseUrl, sessionCookie }, fn)`
// pushes a context onto the ALS — every fetch / apiUrl call within
// `fn` (including deep async chains) sees the same ctx. Concurrent
// jobs each get their own isolated store, so they can NEVER trample
// each other's auth or base URL.
//
// On import this module ALSO installs a resolver on globalThis so
// the client-safe `apiUrl()` in apiBaseUrl.ts can resolve relative
// paths without having to import node:async_hooks itself.
// ============================================================

import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

interface InternalContext {
  baseUrl: string;
  sessionCookie?: string;
}

const als = new AsyncLocalStorage<InternalContext>();

// Install the URL resolver exactly once. apiUrl() reads from this.
declare global {
  // eslint-disable-next-line no-var
  var __pawenResolveInternalUrl: ((path: string) => string) | undefined;
}
if (!globalThis.__pawenResolveInternalUrl) {
  globalThis.__pawenResolveInternalUrl = (path: string) => {
    const ctx = als.getStore();
    if (!ctx) return path;
    return `${ctx.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  };
}

export function withInternalContext<T>(
  ctx: InternalContext,
  fn: () => Promise<T>,
): Promise<T> {
  const cleaned = ctx.baseUrl.replace(/\/+$/, '');
  return als.run({ baseUrl: cleaned, sessionCookie: ctx.sessionCookie }, fn);
}

export function getInternalContext(): InternalContext | undefined {
  return als.getStore();
}
