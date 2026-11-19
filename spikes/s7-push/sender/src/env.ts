// The sender's local settings: `spikes/s7-push/.env.local`, git-ignored (`.env.*`). It names the
// service-account key file (outside the repository or git-ignored) and optional URL overrides.
// Values are never logged; errors name the setting, not its content.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ServiceAccount } from './auth.ts';

export const SPIKE_DIR = join(import.meta.dirname, '..', '..');
export const ENV_FILE = join(SPIKE_DIR, '.env.local');
export const DEFAULT_OUT_DIR = join(SPIKE_DIR, '.out');

export interface SenderConfig {
  serviceAccount: ServiceAccount;
  tokenUrl: string;
  fcmBaseUrl: string;
  outDir: string;
}

export function readEnvLocal(file = ENV_FILE): Record<string, string> {
  if (!existsSync(file)) throw new Error(`missing ${file} (see spikes/s7-push/README.md)`);
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    const value = m?.[2]?.replace(/^(['"])(.*)\1$/, '$2');
    if (m?.[1] && value) out[m[1]] = value;
  }
  return out;
}

export function loadServiceAccount(file: string): ServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error('S7_SERVICE_ACCOUNT_FILE is unreadable or not JSON');
  }
  const sa = parsed as Partial<ServiceAccount>;
  for (const field of ['project_id', 'client_email', 'private_key'] as const) {
    if (typeof sa[field] !== 'string' || sa[field] === '')
      throw new Error(`service-account file has no ${field}`);
  }
  return sa as ServiceAccount;
}

export function loadConfig(env: Record<string, string> = readEnvLocal()): SenderConfig {
  const file = env['S7_SERVICE_ACCOUNT_FILE'];
  if (!file) throw new Error('S7_SERVICE_ACCOUNT_FILE is not set in .env.local');
  const serviceAccount = loadServiceAccount(file);
  return {
    serviceAccount,
    tokenUrl:
      env['S7_TOKEN_URL'] ?? serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token',
    fcmBaseUrl: env['S7_FCM_BASE_URL'] ?? 'https://fcm.googleapis.com',
    outDir: env['S7_OUT_DIR'] ?? DEFAULT_OUT_DIR,
  };
}
