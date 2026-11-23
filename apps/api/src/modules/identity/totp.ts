// TOTP (RFC 6238: HMAC-SHA-1, 6 digits, 30 s steps) and recovery codes (A-01a criteria 11, 12).
// No library: the algorithm is a few lines, and owning it lets us store the last accepted step
// (no replay) and tell a clock-skewed phone apart at enrolment. Secrets are 160 bits (RFC 4226),
// shown as 32 base32 characters; recovery codes are 50 bits each, stored as HMACs with AUTH_HMAC_KEY.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOTP_STEP_MS = 30_000;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
/** Codes from these many steps either side are accepted (A-01a criterion 12). */
export const TOTP_WINDOW = 1;
/** At enrolment, a code this far off is a phone clock to fix, not a wrong code. */
export const TOTP_SKEW_HINT_WINDOW = 10;

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET.charAt((value << (5 - bits)) & 31);
  return out;
}

/** A new secret: 20 random bytes. */
export function newTotpSecret(): Buffer {
  return randomBytes(20);
}

export function stepAt(at: Date): number {
  return Math.floor(at.getTime() / TOTP_STEP_MS);
}

function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

function sameCode(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * The step within `window` steps of `now` whose code is `code` (nearest first), or null. Every
 * candidate is computed, so the time taken does not tell which step matched.
 */
export function matchStep(secret: Buffer, code: string, now: Date, window: number): number | null {
  const current = stepAt(now);
  let found: number | null = null;
  for (let distance = 0; distance <= window; distance += 1) {
    for (const step of distance === 0 ? [current] : [current - distance, current + distance]) {
      if (sameCode(hotp(secret, step), code) && found === null) found = step;
    }
  }
  return found;
}

/** The otpauth URI for authenticator apps; the label names the product, never the person. */
export function otpauthUri(manualKey: string): string {
  const params = new URLSearchParams({
    secret: manualKey,
    issuer: 'Shifa',
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/Shifa?${params.toString()}`;
}

export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Ten codes like `k7m2q-9xw4r` (50 bits each). */
export function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const bytes = randomBytes(10);
    const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length] ?? 'a');
    return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
  });
}

/**
 * HMAC-SHA-256 of a recovery code with the server key (AUTH_HMAC_KEY): a database dump alone
 * cannot be searched offline for the codes. Case, spaces and dashes do not matter when typed.
 */
export function recoveryCodeHash(code: string, key: string): string {
  const normalised = code.toLowerCase().replace(/[\s-]/g, '');
  return createHmac('sha256', key).update(`shifa-recovery:${normalised}`).digest('hex');
}
