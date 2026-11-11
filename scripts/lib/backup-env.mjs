// Shared constants and helpers of `pnpm backup:*` (spec 0.2-09c): paths, the git-ignored .env
// with the stack's secrets, and the argument arrays for docker compose and pgBackRest.
//
// Secrets: generated once into infra/backup/.env (owner-only), never printed, never on a command
// line. Containers get them from compose (environment); a `docker run` child gets them through
// its own environment and `-e NAME` (name only, the value never appears in argv).
import { join } from 'node:path';
import { parseEnv } from './obs.mjs';

export { parseEnv };

export const STACK_DIR = join('infra', 'backup');
export const ENV_PATH = join(STACK_DIR, '.env');
export const STATE_DIR = join(STACK_DIR, '.state');
export const CA_PATH = join(STATE_DIR, 'ca.crt');
export const COMPOSE_PATH = join(STACK_DIR, 'compose.yml');
export const PGBACKREST_CONF = join(STACK_DIR, 'pgbackrest', 'pgbackrest.conf');
export const SCHEDULE_PATH = join(STACK_DIR, 'schedule.json');

export const PROJECT = 'shifa-backup';
export const NETWORK = `${PROJECT}_default`;
export const STANZA = 'shifa';
export const BUCKET = 'shifa-backup';
export const GARAGE_KEY_NAME = 'shifa-pgbackrest';
/** What pgBackRest connects to (pgbackrest.conf repo1-s3-endpoint), for error messages. */
export const REPO_ENDPOINT = 'garage-tls:443';
export const POSTGRES_PORT = 55432;
/** Built by compose from infra/backup/postgres/Dockerfile (<PostgreSQL>-<pgBackRest>). */
export const POSTGRES_IMAGE_TAG = 'shifa/backup-postgres:18.6-2.60.0';
/** Label on every restore container and volume, so `reset` finds them. */
export const RESTORE_LABEL = 'shifa.backup.restore';

/** Generated on the first `up` (32 random bytes each, hex); a value in the environment wins. */
export const SECRET_KEYS = [
  'BACKUP_POSTGRES_PASSWORD',
  'BACKUP_CIPHER_PASS',
  'BACKUP_GARAGE_RPC_SECRET',
  'BACKUP_GARAGE_ADMIN_TOKEN',
];
/** Written by the Garage bootstrap (Garage creates the key; the secret is 32 bytes hex). */
export const GARAGE_KEYS = ['BACKUP_S3_KEY_ID', 'BACKUP_S3_KEY_SECRET'];
const SECRET_BYTES = 32;

/** Container env names pgBackRest reads, and the .env key behind each. */
export const PGBACKREST_ENV = {
  PGBACKREST_REPO1_S3_KEY: 'BACKUP_S3_KEY_ID',
  PGBACKREST_REPO1_S3_KEY_SECRET: 'BACKUP_S3_KEY_SECRET',
  PGBACKREST_REPO1_CIPHER_PASS: 'BACKUP_CIPHER_PASS',
};

function formatEnv(env) {
  const header =
    '# Local backup stack (pnpm backup:up). Generated; never commit or share this file.\n' +
    '# Losing BACKUP_CIPHER_PASS makes the backups in this stack unreadable.\n';
  return (
    header +
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}\n`)
      .join('')
  );
}

export function readEnv(io) {
  const text = io.readFile(join(io.root, ENV_PATH));
  return text === undefined ? undefined : parseEnv(String(text));
}

export function writeEnv(io, env) {
  io.writeFile(join(io.root, ENV_PATH), formatEnv(env), 0o600);
}

/**
 * Reads the .env, or writes it with fresh secrets on first run. A value already in the process
 * environment (CI generates and masks them before the drill) is used instead of a random one;
 * an existing .env is never overwritten.
 */
export function ensureEnv(io) {
  const existing = readEnv(io);
  if (existing !== undefined) return { env: existing, created: false };
  const env = Object.fromEntries(
    SECRET_KEYS.map((key) => [key, io.env?.[key] || io.randomBytes(SECRET_BYTES).toString('hex')]),
  );
  writeEnv(io, env);
  return { env, created: true };
}

/** `docker compose` arguments for this stack. */
export const compose = (io, ...args) => [
  'compose',
  '-f',
  join(io.root, COMPOSE_PATH),
  '--env-file',
  join(io.root, ENV_PATH),
  ...args,
];

/**
 * Placeholders for keys the .env lacks (before the Garage bootstrap, or a lost .env), so compose
 * can interpolate the whole file for commands that do not use them. The shell value wins over
 * --env-file; real values are never replaced.
 */
export function placeholders(env) {
  const missing = [...SECRET_KEYS, ...GARAGE_KEYS].filter((key) => !env?.[key]);
  return Object.fromEntries(missing.map((key) => [key, 'unused']));
}

/** `docker compose exec` of pgBackRest as postgres in the source container. */
export const pgbackrest = (io, ...args) =>
  compose(
    io,
    'exec',
    '-T',
    '-u',
    'postgres',
    'postgres',
    'pgbackrest',
    `--stanza=${STANZA}`,
    ...args,
  );

/** `docker compose exec` of psql as postgres in the source container (local socket). */
export const psql = (io, query) =>
  compose(io, 'exec', '-T', '-u', 'postgres', 'postgres', 'psql', '-XAtq', '-F', '|', '-c', query);

/** The schedule (infra/backup/schedule.json). */
export function readSchedule(io) {
  return JSON.parse(String(io.readFile(join(io.root, SCHEDULE_PATH))));
}
