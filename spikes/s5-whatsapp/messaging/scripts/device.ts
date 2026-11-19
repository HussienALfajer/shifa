// Plays the patient app for reverse verification (criterion 9): requests a nonce for P, prints
// the wa.me link to open on P's phone, polls until verified, refused or expired.
// Usage: node scripts/device.ts [service URL] (defaults to http://<S5_LISTEN_HOST>:<S5_LISTEN_PORT>).
import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runDevice } from '../src/device.ts';
import { RAW_DIR, readEnvLocal } from '../src/env-local.ts';

const CODES_FILE = join(RAW_DIR, '..', 'run-codes.txt');

const env = readEnvLocal();
const host = env['S5_LISTEN_HOST'] ?? '127.0.0.1';
const baseUrl = process.argv[2] ?? `http://${host}:${env['S5_LISTEN_PORT'] ?? '3105'}`;
const result = await runDevice({
  baseUrl,
  deviceId: `device-${randomBytes(6).toString('hex')}`,
  phone: env['S5_NUMBER_P'] ?? '',
  pollMs: 2_000,
  timeoutMs: 11 * 60_000,
  onLink: (link) => {
    // The code goes to a git-ignored file for the WAHA log check (`stack/scripts/run-stack.ts
    // grep-logs`, checklist step 15), which deletes it once the check finds nothing.
    const text = new URL(link).searchParams.get('text') ?? '';
    const code = text.trim().split(/\s+/).at(-1) ?? '';
    mkdirSync(dirname(CODES_FILE), { recursive: true });
    appendFileSync(CODES_FILE, `${code}\n`, { mode: 0o600 });
    process.stdout.write(`open on P's phone and send the message as it is:\n${link}\n`);
  },
});
process.stdout.write(`${JSON.stringify(result)}\n`);
