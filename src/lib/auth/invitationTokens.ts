/**
 * Browser-Safe Invitation Token Extraction & URL Normalization
 *
 * This module is purely runtime-agnostic and contains zero Node.js-only imports (no fs, path, or crypto).
 * It can safely be imported into client components ('use client') as well as server-side API routes.
 */

/**
 * Normalizes and extracts a raw invitation token from a raw string, full URL, or malformed concatenated URL.
 * Guarantees that neither double URLs, URL prefixes, nor ?token= query strings leak into the raw token or hash.
 */
export function extractInvitationToken(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let clean = input.trim();

  try {
    clean = decodeURIComponent(clean);
  } catch {}

  // Strip wrapping quotes
  clean = clean.replace(/^"+|"+$/g, '').trim();

  // 1. If it's already a clean hex token (32 to 128 hex chars)
  if (/^[a-f0-9]{32,128}$/i.test(clean)) {
    return clean;
  }

  // 2. Check if it contains URL markers or token parameter markers
  if (clean.includes('token') || clean.includes('://') || clean.includes('/')) {
    try {
      const urlObj =
        clean.startsWith('http://') || clean.startsWith('https://')
          ? new URL(clean)
          : new URL(`http://localhost${clean.startsWith('/') ? '' : '/'}${clean}`);
      const paramToken = urlObj.searchParams.get('token');
      if (paramToken) {
        if (paramToken.includes('://') || paramToken.includes('token')) {
          return extractInvitationToken(paramToken);
        }
        const trimmed = paramToken.trim();
        if (/^[a-f0-9]{32,128}$/i.test(trimmed)) {
          return trimmed;
        }
      }
    } catch {}

    // Match ?token=, &token=, or ?token followed by hex or nested URL
    const tokenParamMatch = clean.match(/token[=:]?([a-f0-9]{32,128})/i);
    if (tokenParamMatch && tokenParamMatch[1]) {
      return tokenParamMatch[1];
    }

    // Match standard 64-hex-char sequence (crypto.randomBytes(32))
    const hex64Matches = clean.match(/[a-f0-9]{64}/gi);
    if (hex64Matches && hex64Matches.length > 0) {
      return hex64Matches[hex64Matches.length - 1];
    }

    // Match broad 32-128 hex sequence
    const broadHexMatches = clean.match(/[a-f0-9]{32,128}/gi);
    if (broadHexMatches && broadHexMatches.length > 0) {
      return broadHexMatches[broadHexMatches.length - 1];
    }
  }

  return clean;
}

/**
 * Constructs a clean, normalized invitation acceptance URL from an origin and raw token or URL.
 * Guarantees that neither double origins, duplicate protocols, nor ?tokenhttp:// prefixes are created.
 */
export function buildInvitationUrl(
  origin: string,
  rawTokenOrUrl?: string,
  explicitInviteUrl?: string
): string {
  const cleanOrigin = (origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  if (explicitInviteUrl) {
    const trimmed = explicitInviteUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const extractedToken = extractInvitationToken(trimmed);
      return `${cleanOrigin}/invite/accept?token=${extractedToken}`;
    }
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (cleanPath.includes('token=')) {
      const extractedToken = extractInvitationToken(cleanPath);
      return `${cleanOrigin}/invite/accept?token=${extractedToken}`;
    }
    return `${cleanOrigin}${cleanPath}`;
  }

  if (rawTokenOrUrl) {
    const token = extractInvitationToken(rawTokenOrUrl);
    return `${cleanOrigin}/invite/accept?token=${token}`;
  }

  return `${cleanOrigin}/invite/accept`;
}

