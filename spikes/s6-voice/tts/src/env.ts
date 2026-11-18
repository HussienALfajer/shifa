// The owner's git-ignored spikes/s6-voice/.env.local (ADR-0026). Its values are also what the key
// check looks for literally, whatever their format.
import { existsSync, readFileSync } from 'node:fs';
import { ENV_FILE } from './paths.ts';

export function readEnvLocal(file = ENV_FILE): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/u.exec(line);
    const value = m?.[2]?.replace(/^(['"])(.*)\1$/u, '$2');
    if (m?.[1] && value) out[m[1]] = value;
  }
  return out;
}

/** Secret values from .env.local (names ending in _KEY), at least 12 characters long. */
export function localSecrets(file = ENV_FILE): string[] {
  return Object.entries(readEnvLocal(file))
    .filter(([name, value]) => name.endsWith('_KEY') && value.length >= 12)
    .map(([, value]) => value);
}
