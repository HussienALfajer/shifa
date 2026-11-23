// Setup-link tokens and URLs (A-01a criterion 4): 256 random bits as base64url, only the SHA-256
// stored, valid 72 h. The URL carries the token in its fragment, so it reaches no server log;
// the page posts it in a body. The WhatsApp share carries the link text and nothing else.
import { createHash, randomBytes } from 'node:crypto';

export const LINK_TTL_MS = 72 * 60 * 60 * 1000;

/** Where setup links point when no CLINIC_WEB_URL is configured (local development). */
export const DEFAULT_CLINIC_WEB_URL = 'http://localhost:5173';

export function linkTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newLinkToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: linkTokenHash(token) };
}

export function linkUrls(
  clinicWebUrl: string,
  token: string,
): { url: string; whatsappUrl: string } {
  const url = `${clinicWebUrl.replace(/\/+$/, '')}/setup#${token}`;
  return { url, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(url)}` };
}

/** Identifier prefix of a super admin's setup link (verification table; no clinic, no row). */
export const ADMIN_SETUP_IDENTIFIER = 'shifa-admin-setup';
