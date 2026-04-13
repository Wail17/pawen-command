// ============================================================
// PAWEN — Per-User Invisible Watermarking
//
// Embeds an invisible, unique fingerprint into every gate output
// text so leaked content can be traced back to the exact user who
// generated it. Uses Unicode zero-width characters to encode the
// user's identity into text without changing its visible appearance.
//
// The watermark is a base-3 encoding of each character of a
// user-specific tag, using:
//   U+200B (zero-width space)     = 0
//   U+200C (zero-width non-joiner) = 1
//   U+200D (zero-width joiner)    = 2
//
// Downstream readers can extract the watermark with `extractWatermark`.
// ============================================================

import 'server-only';
import crypto from 'node:crypto';

// Zero-width characters used for encoding
const ZW = ['\u200B', '\u200C', '\u200D'] as const;
const WATERMARK_SEPARATOR = '\uFEFF'; // BOM as field separator

/**
 * Generate a short, deterministic tag for a user.
 * Uses HMAC so the tag can't be guessed without SESSION_SECRET.
 */
function userTag(userName: string): string {
  const secret = process.env.SESSION_SECRET ?? 'pawen-watermark-fallback';
  const hmac = crypto.createHmac('sha256', secret).update(userName).digest('hex');
  // 8 hex chars = 32 bits = enough to uniquely identify users
  return hmac.slice(0, 8);
}

/**
 * Encode a string into zero-width characters (base-3 per char code).
 */
function encodeZW(input: string): string {
  let result = '';
  for (const ch of input) {
    let code = ch.charCodeAt(0);
    const digits: number[] = [];
    // Base-3 encode, pad to 4 digits (covers 0–80 = all hex + ASCII)
    for (let i = 0; i < 4; i++) {
      digits.unshift(code % 3);
      code = Math.floor(code / 3);
    }
    result += digits.map((d) => ZW[d]).join('');
  }
  return result;
}

/**
 * Decode zero-width characters back to the original string.
 */
function decodeZW(encoded: string): string {
  // Extract only ZW chars
  const zwChars = [...encoded].filter((c) => c === ZW[0] || c === ZW[1] || c === ZW[2]);
  if (zwChars.length === 0) return '';

  const zwToDigit = new Map<string, number>([
    [ZW[0], 0],
    [ZW[1], 1],
    [ZW[2], 2],
  ]);

  let result = '';
  for (let i = 0; i + 3 < zwChars.length; i += 4) {
    const code =
      (zwToDigit.get(zwChars[i])! * 27) +
      (zwToDigit.get(zwChars[i + 1])! * 9) +
      (zwToDigit.get(zwChars[i + 2])! * 3) +
      zwToDigit.get(zwChars[i + 3])!;
    result += String.fromCharCode(code);
  }
  return result;
}

/**
 * Embed a per-user watermark into a text string.
 * The watermark is inserted after the first period or newline,
 * making it virtually invisible in rendered text.
 *
 * Format: SEPARATOR + encoded(tag + ":" + ISO timestamp)
 */
export function watermarkText(text: string, userName: string): string {
  if (!text || text.length < 10) return text;

  const tag = userTag(userName);
  const ts = Date.now().toString(36); // compact timestamp
  const payload = `${tag}:${ts}`;
  const encoded = WATERMARK_SEPARATOR + encodeZW(payload);

  // Insert after first sentence-ending punctuation or newline
  const insertIdx = text.search(/[.\n!?]/);
  if (insertIdx >= 0 && insertIdx < text.length - 1) {
    return text.slice(0, insertIdx + 1) + encoded + text.slice(insertIdx + 1);
  }
  // Fallback: append at the end
  return text + encoded;
}

/**
 * Recursively watermark all string values in an object.
 * Skips keys that look like IDs, URLs, dates, or technical fields.
 */
const SKIP_KEYS = new Set([
  'id', 'url', 'source_url', 'source_type', 'source', 'gateId', 'projectId',
  'createdAt', 'updatedAt', 'generated_at', 'timestamp', 'model', 'version',
  'status', 'lang', 'language', 'market', 'category', 'framework', 'type',
  'key', 'agent', 'role', 'input_summary',
]);

export function watermarkObject<T>(obj: T, userName: string): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => watermarkObject(item, userName)) as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SKIP_KEYS.has(key)) {
      result[key] = value;
    } else if (typeof value === 'string' && value.length > 30) {
      // Only watermark substantial strings (skip short labels, IDs, etc.)
      result[key] = watermarkText(value, userName);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = watermarkObject(value, userName);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Extract the user tag from watermarked text.
 * Returns the HMAC tag (not the username) + timestamp, or null if no watermark found.
 */
export function extractWatermark(text: string): { tag: string; timestamp: string } | null {
  const sepIdx = text.indexOf(WATERMARK_SEPARATOR);
  if (sepIdx < 0) return null;

  const afterSep = text.slice(sepIdx + 1);
  const decoded = decodeZW(afterSep);
  if (!decoded || !decoded.includes(':')) return null;

  const [tag, ts] = decoded.split(':');
  return { tag, timestamp: ts };
}

/**
 * Check if a specific user watermarked a piece of text.
 */
export function isWatermarkedBy(text: string, userName: string): boolean {
  const wm = extractWatermark(text);
  if (!wm) return false;
  return wm.tag === userTag(userName);
}
