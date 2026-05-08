// ============================================================
// AutoEcom Lab — User identity (client-side only)
// Simple tag system: pick a name from a fixed list on first visit,
// stored in localStorage as "app-user".
// Used for attribution of contributions + logging.
//
// NOTE: this file intentionally has NO admin concept. Admin access
// is gated by a separate password checked server-side in
// src/lib/auth/adminServer.ts — picking a specific user tag gives
// you zero extra privileges.
// ============================================================

export const APP_USERS = [
  'AIO',
  'Mee6',
  'Serum',
  'Suley',
  'Zaza',
  'Knd',
  'Maghrabi',
  'Seven',
  'Soso',
  'Sykss',
  'Alex',
  'Road',
  'BradRiley',
] as const;

export type AppUser = (typeof APP_USERS)[number];

export function isAppUser(value: string | null | undefined): value is AppUser {
  if (!value) return false;
  return (APP_USERS as readonly string[]).includes(value);
}

export function getCurrentUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('app-user');
  return isAppUser(stored) ? stored : null;
}
