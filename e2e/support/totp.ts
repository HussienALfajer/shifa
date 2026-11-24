// The journeys' own authenticator (slice A-01-07 checkpoint 5): RFC 6238 codes from the manual
// key the enrolment screen shows, written apart from the API's implementation so the journey
// checks it rather than repeats it. A code is never used twice: the server refuses a replayed
// step, so `nextCode()` waits for a step this key has not used yet.
import { createHmac } from 'node:crypto';

const STEP_MS = 30_000;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(key: string): Buffer {
  const clean = key.replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('the manual key is not base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function codeAt(secret: Buffer, step: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const lastStep = new Map<string, number>();

/** The current code of `key`, waiting for the next step when this one was already used. */
export async function nextCode(key: string): Promise<string> {
  const secret = base32Decode(key);
  for (;;) {
    const step = Math.floor(Date.now() / STEP_MS);
    if (step > (lastStep.get(key) ?? -1)) {
      lastStep.set(key, step);
      return codeAt(secret, step);
    }
    await new Promise((resolve) => setTimeout(resolve, STEP_MS - (Date.now() % STEP_MS) + 50));
  }
}

/** A code of `key` far from now (an hour ahead): always refused, never a clock-skew hint. */
export function wrongCode(key: string): string {
  const step = Math.floor(Date.now() / STEP_MS) + 120;
  return codeAt(base32Decode(key), step);
}
