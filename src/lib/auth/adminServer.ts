// ============================================================
// AutoEcom Lab — Admin auth (server only)
// The admin role is SEPARATE from the user tag system. A user
// picks one of the 13 contributor tags on the dashboard (for
// attribution), but to access admin features they need to log
// in with the admin password stored in ADMIN_PASSWORD env var.
//
// The "token" returned to the client is literally the password —
// this is safe enough because:
//   1. The app is already behind the main app password.
//   2. The KB is not sensitive (internal team knowledge).
//   3. Tokens only live in the admin's own localStorage.
// If stronger auth is needed later, swap this for a signed JWT.
// ============================================================

import 'server-only';

/**
 * Constant-time-ish string comparison to avoid timing side channels.
 * Short-circuits only on length mismatch; otherwise XORs the full length.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function getAdminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  return p && p.length > 0 ? p : null;
}

/**
 * True if the request carries a valid x-admin-token header.
 * Returns false if ADMIN_PASSWORD is not set — admin is effectively
 * disabled in that case (fail-closed).
 */
export function isAdminRequest(req: Request): boolean {
  const expected = getAdminPassword();
  if (!expected) return false;
  const token = req.headers.get('x-admin-token') ?? '';
  if (!token) return false;
  return safeEqual(token, expected);
}

/**
 * Validate a password submitted via the login form.
 */
export function validateAdminPassword(password: string): boolean {
  const expected = getAdminPassword();
  if (!expected) return false;
  return safeEqual(password, expected);
}
