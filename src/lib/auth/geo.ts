// ============================================================
// PAWEN — Request geolocation (Vercel-only)
//
// Reads the geo headers Vercel injects on every incoming request
// (free, no external lookup needed). Available on Edge AND Node
// runtimes. Falls back to undefined when missing (e.g. local dev,
// non-Vercel host).
//
// Reference: https://vercel.com/docs/edge-network/headers/request-headers#geolocation-headers
// ============================================================

import 'server-only';

export interface RequestGeo {
  country?: string;        // ISO-3166 alpha-2 (e.g. "BE", "FR")
  countryRegion?: string;  // sub-region code (e.g. "BRU", "75")
  city?: string;           // human-readable city
  latitude?: string;       // string-encoded float
  longitude?: string;      // string-encoded float
  timezone?: string;       // IANA TZ (e.g. "Europe/Brussels")
}

function decode(v: string | null): string | undefined {
  if (!v) return undefined;
  // Vercel URI-encodes city values that contain spaces / non-ascii
  try { return decodeURIComponent(v); } catch { return v; }
}

export function getRequestGeo(req: Request): RequestGeo {
  const h = req.headers;
  return {
    country:       h.get('x-vercel-ip-country') || undefined,
    countryRegion: h.get('x-vercel-ip-country-region') || undefined,
    city:          decode(h.get('x-vercel-ip-city')),
    latitude:      h.get('x-vercel-ip-latitude') || undefined,
    longitude:     h.get('x-vercel-ip-longitude') || undefined,
    timezone:      h.get('x-vercel-ip-timezone') || undefined,
  };
}

/**
 * Compact, human-readable label for an audit/log row, e.g.
 *   "Brussels, BE"  ·  "FR"  ·  ""
 */
export function geoLabel(geo: RequestGeo | null | undefined): string {
  if (!geo) return '';
  const city = geo.city?.trim();
  const country = geo.country?.trim();
  if (city && country) return `${city}, ${country}`;
  return country ?? '';
}
