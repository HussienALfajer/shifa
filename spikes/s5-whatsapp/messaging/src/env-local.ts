// The manual run's local settings (criterion 11): `spikes/s5-whatsapp/.env.local`, git-ignored
// (`.env.*`), holds the owner's two numbers, WAHA URLs and keys. Never committed, never logged.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type MessagingConfig, type SessionConfig } from './config.ts';
import { DEFAULT_PACING } from './scheduler.ts';

export const SPIKE_DIR = join(import.meta.dirname, '..', '..');
export const REPO_DIR = join(SPIKE_DIR, '..', '..');
export const ENV_FILE = join(SPIKE_DIR, '.env.local');
/** Raw webhook captures during the run: git-ignored (`.cache/`), deleted by the scrubber. */
export const RAW_DIR = join(REPO_DIR, '.cache', 's5', 'raw');
export const FIXTURES_DIR = join(SPIKE_DIR, 'fixtures');

export function readEnvLocal(file = ENV_FILE): Record<string, string> {
  if (!existsSync(file))
    throw new Error(`missing ${file} (see docs/spikes/s5-manual-checklist.md)`);
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m?.[1] && m[2] !== undefined) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const need = (env: Record<string, string>, name: string) => {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set in .env.local`);
  return value;
};

/** G plays the platform role, then the clinic role (one linked session at a time). */
export const RUN_SESSIONS: SessionConfig[] = [
  {
    name: 'platform',
    container: 'platform',
    clinicId: null,
    role: 'platform',
    timeZone: 'Asia/Damascus',
  },
  {
    name: 'clinic-g',
    container: 'clinics',
    clinicId: 'c-run',
    role: 'clinic',
    timeZone: 'Asia/Damascus',
  },
];

export function runConfig(env: Record<string, string>): MessagingConfig {
  const container = (prefix: string) => ({
    wahaUrl: need(env, `${prefix}_URL`),
    apiKey: need(env, `${prefix}_API_KEY`),
    hmacKey: need(env, `${prefix}_HMAC_KEY`),
  });
  return {
    databaseUrl: need(env, 'S5_DATABASE_URL'),
    containers: {
      platform: container('S5_WAHA_PLATFORM'),
      clinics: container('S5_WAHA_CLINICS'),
    },
    sessions: RUN_SESSIONS,
    // MSG-32: only the owner's two dedicated numbers receive anything.
    allowlist: new Set([need(env, 'S5_NUMBER_G'), need(env, 'S5_NUMBER_P')]),
    pacing: { ...DEFAULT_PACING, capPerWindow: Number(env['S5_CAP_PER_HOUR'] ?? 30) },
    sendTimeoutMs: 15_000,
    adminToken: need(env, 'S5_ADMIN_TOKEN'),
    queue: 'worker',
    verify: { platformNumber: need(env, 'S5_NUMBER_G'), serverKey: need(env, 'S5_VERIFY_KEY') },
    rawCaptureDir: RAW_DIR,
  };
}
