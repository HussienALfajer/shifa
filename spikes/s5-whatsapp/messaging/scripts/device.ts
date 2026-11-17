// Plays the patient app for reverse verification (criterion 9): requests a nonce for P, prints
// the wa.me link to open on P's phone, polls until verified, refused or expired.
// Usage: node scripts/device.ts [service URL] (defaults to http://<S5_LISTEN_HOST>:<S5_LISTEN_PORT>).
import { randomBytes } from 'node:crypto';
import { runDevice } from '../src/device.ts';
import { readEnvLocal } from '../src/env-local.ts';

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
    process.stdout.write(`open on P's phone and send the message as it is:\n${link}\n`);
  },
});
process.stdout.write(`${JSON.stringify(result)}\n`);
