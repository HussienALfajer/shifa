// The session cookie (A-01a criterion 9). Better Auth writes it at sign-in (`<token>.<signature>`,
// HMAC-SHA-256 of the token with BETTER_AUTH_SECRET, base64); the adapter checks the signature
// before any database lookup, so a forged cookie costs nothing.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** `__Host-`: Secure, Path=/, no Domain; the browser refuses it otherwise. */
export const SESSION_COOKIE = '__Host-shifa.sid';

/** Absolute session limit (OD-77): 12 hours; also the cookie's Max-Age. */
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;

/** Clears the cookie (sign-out); same attributes, or the browser keeps the old one. */
export const CLEAR_SESSION_COOKIE = `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

/** Better Auth's signature: 44 characters of base64 (32 bytes) ending in `=`. */
const SIGNATURE = /^[A-Za-z0-9+/]{43}=$/;

/** The token of a signed cookie value, or null when the value is malformed or forged. */
export function verifySessionCookie(value: string | undefined, secret: string): string | null {
  if (value === undefined) return null;
  const dot = value.lastIndexOf('.');
  if (dot < 1) return null;
  const token = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!SIGNATURE.test(signature) || token.length > 256) return null;
  const expected = createHmac('sha256', secret).update(token).digest();
  const given = Buffer.from(signature, 'base64');
  return given.length === expected.length && timingSafeEqual(given, expected) ? token : null;
}

/** The session cookie's line among Better Auth's Set-Cookie headers. */
export function sessionCookieLine(headers: Headers): string | undefined {
  return headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`));
}
