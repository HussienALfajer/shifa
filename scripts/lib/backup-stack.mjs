// `pnpm backup:up | down | reset | full | diff` (spec 0.2-09c, criteria 1–3). Every effect goes
// through `io` (lib/stack-io.mjs), so the tests run it with a fake runner and file system.
import { join } from 'node:path';
import {
  BUCKET,
  CA_PATH,
  COMPOSE_PATH,
  compose,
  ENV_PATH,
  ensureEnv,
  GARAGE_KEY_NAME,
  GARAGE_KEYS,
  POSTGRES_PORT,
  pgbackrest,
  placeholders,
  RESTORE_LABEL,
  readEnv,
  STATE_DIR,
  writeEnv,
} from './backup-env.mjs';

const CADDY_ROOT_CERT = '/data/caddy/pki/authorities/local/root.crt';
/** Capacity Garage may use on this node (a layout needs one; the volume grows as needed). */
const GARAGE_CAPACITY = '10G';

const garage = (io, ...args) => compose(io, 'exec', '-T', 'garage', '/garage', ...args);

/** Key id and secret from `garage key create` / `garage key info --show-secret` output. */
export function parseGarageKey(text) {
  const id = /^Key ID:\s+(GK[0-9a-f]+)\s*$/m.exec(text)?.[1];
  const secret = /^Secret key:\s+([0-9a-f]{64})\s*$/m.exec(text)?.[1];
  return id && secret ? { id, secret } : undefined;
}

/**
 * Single-node layout, the bucket and a key allowed to read and write that bucket only (no
 * --owner, no bucket creation). Each step checks first, so a half-finished run can be repeated.
 * Returns the key, or undefined after printing what failed.
 */
async function bootstrapGarage(io, env) {
  // Output is captured, never shown: `key info --show-secret` prints the secret.
  const quiet = { capture: true, captureErr: true, env: placeholders(env) };
  const probe = (...args) => io.run('docker', garage(io, ...args), quiet);
  const step = async (what, args) => {
    const result = await probe(...args);
    if (result.code !== 0) io.out(`backup: Garage bootstrap failed at ${what}`);
    return result;
  };
  const status = await step('status', ['status']);
  if (status.code !== 0) return undefined;
  if (status.stdout.includes('NO ROLE ASSIGNED')) {
    const id = await step('node id', ['node', 'id', '-q']);
    const node = /^([0-9a-f]{16,})@/m.exec(id.stdout)?.[1];
    if (!node) {
      io.out('backup: Garage bootstrap failed at node id');
      return undefined;
    }
    const assign = ['layout', 'assign', '-z', 'local', '-c', GARAGE_CAPACITY, node.slice(0, 16)];
    if ((await step('layout assign', assign)).code !== 0) return undefined;
    if ((await step('layout apply', ['layout', 'apply', '--version', '1'])).code !== 0) {
      return undefined;
    }
  }
  const bucket = await probe('bucket', 'info', BUCKET);
  if (bucket.code !== 0 && (await step('bucket create', ['bucket', 'create', BUCKET])).code !== 0) {
    return undefined;
  }
  let key = await probe('key', 'info', '--show-secret', GARAGE_KEY_NAME);
  if (key.code !== 0) key = await step('key create', ['key', 'create', GARAGE_KEY_NAME]);
  const parsed = key.code === 0 ? parseGarageKey(key.stdout) : undefined;
  if (!parsed) {
    io.out('backup: Garage bootstrap failed at reading the key');
    return undefined;
  }
  const allow = ['bucket', 'allow', '--read', '--write', BUCKET, '--key', parsed.id];
  if ((await step('bucket allow', allow)).code !== 0) return undefined;
  return parsed;
}

/** Copies Caddy's root certificate to .state/ca.crt for pgBackRest (repo1-storage-ca-file). */
async function copyCa(io) {
  const cert = await io.run(
    'docker',
    compose(io, 'exec', '-T', 'garage-tls', 'cat', CADDY_ROOT_CERT),
    {
      capture: true,
    },
  );
  if (cert.code !== 0 || !cert.stdout.includes('BEGIN CERTIFICATE')) {
    io.out('backup: could not read the TLS root certificate from garage-tls');
    return false;
  }
  io.writeFile(join(io.root, CA_PATH), cert.stdout, 0o644);
  return true;
}

export async function up(io) {
  const { env: initial, created, error } = ensureEnv(io);
  if (error) {
    io.out(`backup: ${error}`);
    return 1;
  }
  let env = initial;
  if (created) io.out(`backup: generated ${ENV_PATH} (secrets stay in that file)`);
  io.makeDir(join(io.root, STATE_DIR));
  io.out('backup: starting Garage (first run pulls images; this can take minutes)');
  // Garage first: the pgBackRest key does not exist before its bootstrap.
  const storage = await io.run(
    'docker',
    compose(io, 'up', '-d', '--wait', 'garage', 'garage-tls'),
    {
      env: placeholders(env),
    },
  );
  if (storage.code !== 0) {
    io.out('backup: docker compose up (garage) failed');
    return 1;
  }
  if (GARAGE_KEYS.some((key) => !env[key])) {
    const key = await bootstrapGarage(io, env);
    if (!key) return 1;
    // CI: hide the Garage-created secret from the job log too (the others are masked earlier).
    if (io.env?.GITHUB_ACTIONS === 'true') io.out(`::add-mask::${key.secret}`);
    env = { ...env, BACKUP_S3_KEY_ID: key.id, BACKUP_S3_KEY_SECRET: key.secret };
    writeEnv(io, env);
    io.out(`backup: Garage bucket ${BUCKET} and key ${GARAGE_KEY_NAME} ready`);
  }
  if (!(await copyCa(io))) return 1;
  io.out('backup: starting PostgreSQL with pgBackRest (first run builds the image)');
  const started = await io.run('docker', compose(io, 'up', '-d', '--wait', '--build'));
  if (started.code !== 0) {
    io.out('backup: docker compose up failed');
    return 1;
  }
  // Idempotent: succeeds when the stanza already exists and matches this cluster.
  const stanza = await io.run('docker', pgbackrest(io, 'stanza-create'), {
    capture: true,
    captureErr: true,
  });
  if (stanza.code !== 0) {
    io.out('backup: pgbackrest stanza-create failed (run pnpm backup:check for the reason)');
    return 1;
  }
  io.out(
    `backup: PostgreSQL on 127.0.0.1:${POSTGRES_PORT} (user postgres, password in ${ENV_PATH})`,
  );
  return 0;
}

/** Restore containers and volumes (labelled), removed by `reset` and the drill. */
export async function removeRestores(io) {
  for (const kind of ['container', 'volume']) {
    const list = await io.run(
      'docker',
      [
        kind,
        'ls',
        '-q',
        ...(kind === 'container' ? ['-a'] : []),
        '--filter',
        `label=${RESTORE_LABEL}`,
      ],
      {
        capture: true,
      },
    );
    const ids = list.stdout.split(/\s+/).filter(Boolean);
    if (ids.length > 0) await io.run('docker', [kind, 'rm', '-f', ...ids], { capture: true });
  }
}

/**
 * `down` and `reset` without a .env (lost, or a fresh checkout): compose refuses a missing
 * --env-file, so run without it and with placeholders; neither command uses the values.
 */
function stopArgs(io, env, ...args) {
  const argv =
    env === undefined
      ? ['compose', '-f', join(io.root, COMPOSE_PATH), ...args]
      : compose(io, ...args);
  return [argv, { env: placeholders(env) }];
}

export async function down(io) {
  const result = await io.run('docker', ...stopArgs(io, readEnv(io), 'down'));
  return result.code === 0 ? 0 : 1;
}

export async function reset(io, rest) {
  if (!rest.includes('--yes')) {
    io.out('backup: reset deletes the database, every backup in Garage and the passphrase.');
    io.out('backup: run pnpm backup:reset --yes to confirm');
    return 1;
  }
  const result = await io.run('docker', ...stopArgs(io, readEnv(io), 'down', '-v'));
  if (result.code !== 0) return 1;
  await removeRestores(io);
  io.removeFile(join(io.root, ENV_PATH));
  io.removeDir(join(io.root, STATE_DIR));
  io.out(`backup: stack, volumes, restores, ${ENV_PATH} and ${STATE_DIR} removed`);
  return 0;
}

/** `backup:full` / `backup:diff`: what the scheduler calls (infra/backup/schedule.json). */
export async function backup(io, type) {
  if (readEnv(io) === undefined) {
    io.out(`backup: no ${ENV_PATH}; run pnpm backup:up first`);
    return 1;
  }
  const result = await io.run('docker', pgbackrest(io, `--type=${type}`, 'backup'));
  if (result.code !== 0) {
    io.out(`backup: ${type} backup failed (run pnpm backup:check for the reason)`);
    return 1;
  }
  return 0;
}
