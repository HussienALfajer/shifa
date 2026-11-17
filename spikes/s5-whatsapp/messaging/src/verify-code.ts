// Reverse-verification code (criterion 9): 6 characters from an alphabet without look-alikes
// (no 0/O, 1/I/L), after a fixed Arabic phrase that names Shifa and the action. Matching requires
// the phrase right before the code (after folding Arabic-Indic digits, case and tashkeel), so
// extra text around it passes but a bare code does not. Codes, numbers and device secrets reach
// the database only as keyed hashes.
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { foldText } from './keywords.ts';

export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 6;
/** The prefilled text is `${PHRASE} ${code}` (the forwarded-link risk is named in ADR-0036). */
export const PHRASE = 'رمز التحقق في شفاء:';

export function newCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++)
    code += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
  return code;
}

const isCode = (token: string) =>
  // Tokens come from splitting on anything but [0-9A-Z]: ASCII only, so per-character is safe.
  token.length === CODE_LENGTH && token.split('').every((ch) => CODE_ALPHABET.includes(ch));

/** The phrase without its colon, folded like the message. */
const PHRASE_CORE = foldText(PHRASE.replace(/:$/, ''));

/**
 * The code that directly follows the fixed phrase (after folding: case, Arabic-Indic digits,
 * tashkeel), upper-cased; null when the phrase or a code right after it is missing. Extra text
 * before and after passes; a bare code does not, so a disguised message ("confirm my booking
 * K7Q4MX") cannot verify a device (forwarded-link risk, ADR-0036).
 */
export function extractCode(text: string): string | null {
  const folded = foldText(text);
  const at = folded.indexOf(PHRASE_CORE);
  if (at < 0) return null;
  const rest = folded.slice(at + PHRASE_CORE.length).toUpperCase();
  const match = /^[\s:\u061B\u060C,.-]*([0-9A-Z]{6})(?![0-9A-Z])/.exec(rest);
  return match?.[1] && isCode(match[1]) ? match[1] : null;
}

const hmac = (key: string, value: string) => createHmac('sha256', key).update(value).digest('hex');

/** Lookup key of a code: the plain code is never stored. */
export const codeKey = (serverKey: string, code: string) => hmac(serverKey, `code:${code}`);

/** Stand-in for a number in nonces and attempts (per-number limits without the number). */
export const phoneKey = (serverKey: string, phone: string) => hmac(serverKey, `phone:${phone}`);

export const secretHash = (secret: string) => createHash('sha256').update(secret).digest('hex');

export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(secretHash(secret), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export const prefilledText = (code: string) => `${PHRASE} ${code}`;

export const waLink = (platformNumber: string, code: string) =>
  `https://wa.me/${platformNumber.replace(/^\+/, '')}?text=${encodeURIComponent(prefilledText(code))}`;

export const E164 = /^\+[1-9]\d{7,14}$/;
export const DEVICE_ID = /^[A-Za-z0-9_-]{8,128}$/;
