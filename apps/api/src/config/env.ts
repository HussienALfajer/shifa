// Process configuration, read once at startup from the environment and validated with Zod.
// Errors name the key only: values (database passwords above all) never reach a message.
import { z } from 'zod';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface ApiConfig {
  port: number;
  host: string;
  /** PostgreSQL URL of the application role (shifa_app); createDb() refuses anything stronger. */
  databaseUrl: string;
  logLevel: LogLevel;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Keys this app reads. */
const KNOWN_KEYS = new Set(['API_PORT', 'API_HOST', 'DATABASE_URL', 'LOG_LEVEL']);

/** Edit distance with adjacent transpositions (optimal string alignment). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number) => d[i]?.[j] ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      const row = d[i];
      if (row) row[j] = best;
    }
  }
  return at(a.length, b.length);
}

/**
 * A key that is not ours but nearly is (API_PROT, DATABSE_URL) is a typo that would otherwise
 * silently fall back to a default. Unrelated variables of the host (API_TIMEOUT_MS) are ignored.
 */
function isNearMiss(key: string): boolean {
  return !KNOWN_KEYS.has(key) && [...KNOWN_KEYS].some((known) => distance(key, known) <= 2);
}

const schema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  API_HOST: z
    .string()
    .regex(/^[A-Za-z0-9.:-]+$/)
    .default('127.0.0.1'),
  DATABASE_URL: z.string().refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'postgres:' || url.protocol === 'postgresql:';
    } catch {
      return false;
    }
  }),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export function loadConfig(env: Readonly<Record<string, string | undefined>>): ApiConfig {
  const unknown = Object.keys(env).filter(isNearMiss).sort();
  if (unknown.length > 0) {
    throw new ConfigError(`unknown configuration key(s): ${unknown.join(', ')}`);
  }
  const picked = Object.fromEntries(
    [...KNOWN_KEYS].filter((key) => env[key] !== undefined).map((key) => [key, env[key]]),
  );
  const parsed = schema.safeParse(picked);
  if (!parsed.success) {
    // Issue paths only: Zod messages can quote the received value.
    const keys = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))].sort();
    throw new ConfigError(`missing or invalid configuration: ${keys.join(', ')}`);
  }
  return {
    port: parsed.data.API_PORT,
    host: parsed.data.API_HOST,
    databaseUrl: parsed.data.DATABASE_URL,
    logLevel: parsed.data.LOG_LEVEL,
  };
}
