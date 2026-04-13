// ============================================================
// AutoEcom Lab — Admin token helpers (client-side)
// The token is stored in localStorage under "app-admin-token".
// It's the actual admin password — see adminServer.ts for why.
// ============================================================

const TOKEN_KEY = 'app-admin-token';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function hasAdminToken(): boolean {
  return getAdminToken() !== null;
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Headers to attach to any admin-only API request.
 */
export function adminHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAdminToken();
  return {
    ...(token ? { 'x-admin-token': token } : {}),
    ...(extra ?? {}),
  };
}
