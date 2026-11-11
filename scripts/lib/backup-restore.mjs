// `pnpm backup:restore [--target-time <ISO time>] [--keep] [--json]` (spec 0.2-09c criterion 5).
// Restores into a NEW volume and container (`shifa-backup-restore-<timestamp>`), never over the
// source: the source container and its volumes are not touched, and pgBackRest runs in a
// separate `docker run` of the same image, so a restore works while the source is down.
// The restored PostgreSQL starts with archive_mode=off: it must never push a new timeline into
// the source's repository.
import { join } from 'node:path';
import { ARCHIVER_QUERY, backupsOf, parseArchiver } from './backup-check.mjs';
import {
  CA_PATH,
  ENV_PATH,
  NETWORK,
  PGBACKREST_CONF,
  PGBACKREST_ENV,
  POSTGRES_IMAGE_TAG,
  psql,
  RESTORE_LABEL,
  readEnv,
  STANZA,
} from './backup-env.mjs';
import { classifyFailure } from './backup-faults.mjs';

const TARGET = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;
const DATA_ROOT = '/var/lib/postgresql';
const DEFAULT_TIMEOUT_MINUTES = 15;

/** A target with an explicit zone → { text for pgBackRest, Date }, or undefined. */
export function parseTarget(value) {
  if (!TARGET.test(value ?? '')) return undefined;
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return undefined;
  // pgBackRest passes the target to recovery_target_time: space separator, numeric zone.
  return { text: value.replace('T', ' ').replace(/Z$/, '+00'), date };
}

/** Valid range: oldest backup's stop … newest archived WAL (now when the source is down). */
export function restoreRange(backups, archiver, now) {
  const oldest = backups[0];
  if (!oldest) return undefined;
  const parsed = archiver?.archived ? new Date(archiver.archived) : undefined;
  const archived = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
  return {
    from: new Date(oldest.stop * 1000),
    to: archived ?? now,
    toKnown: archived !== undefined,
  };
}

/** The value after a flag; undefined when it is missing or another flag (an empty `$T`). */
export function flagValue(argv, i) {
  const value = argv[i + 1];
  return value === undefined || value === '' || value.startsWith('--') ? undefined : value;
}

export function parseRestoreArgs(argv) {
  const options = { keep: false, json: false, timeoutMinutes: DEFAULT_TIMEOUT_MINUTES };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--keep') options.keep = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--target-time' || arg === '--timeout-minutes') {
      // A missing value must never fall back to "latest": that could restore past the damage.
      const value = flagValue(argv, i++);
      if (value === undefined) return { error: `${arg} needs a value` };
      if (arg === '--target-time') options.targetTime = value;
      else options.timeoutMinutes = Number(value);
    } else return { error: `unknown option ${arg}` };
  }
  if (options.targetTime !== undefined && !parseTarget(options.targetTime)) {
    return { error: 'give --target-time as an ISO time with a zone, e.g. 2026-11-11T14:00:00Z' };
  }
  if (!(options.timeoutMinutes > 0)) return { error: '--timeout-minutes must be positive' };
  return { options };
}

const stamp = (date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'z')
    .toLowerCase();

/** Bind mounts of the configuration and the CA, read-only; the data volume read-write. */
function mounts(io, volume) {
  return [
    ...(volume ? ['--mount', `type=volume,source=${volume},target=${DATA_ROOT}`] : []),
    '--mount',
    `type=bind,source=${join(io.root, PGBACKREST_CONF)},target=/etc/pgbackrest/pgbackrest.conf,readonly`,
    '--mount',
    `type=bind,source=${join(io.root, CA_PATH, '..')},target=/etc/pgbackrest/ca,readonly`,
  ];
}

/** `-e NAME` only: the values travel in the docker CLI's environment, never in argv. */
const envNames = () => Object.keys(PGBACKREST_ENV).flatMap((name) => ['-e', name]);

/** The pgBackRest secrets for the child's environment. BACKUP_CIPHER_PASS from the caller wins. */
function secretsEnv(io, env) {
  const values = { ...env };
  if (io.env?.BACKUP_CIPHER_PASS) values.BACKUP_CIPHER_PASS = io.env.BACKUP_CIPHER_PASS;
  return Object.fromEntries(
    Object.entries(PGBACKREST_ENV).map(([name, key]) => [name, values[key]]),
  );
}

/** `docker run --rm` of pgBackRest (on a data volume when given), attached to the stack network. */
export function pgbackrestRun(io, volume, args) {
  return [
    'run',
    '--rm',
    '--network',
    NETWORK,
    '-u',
    'postgres',
    ...envNames(),
    ...mounts(io, volume),
    POSTGRES_IMAGE_TAG,
    'pgbackrest',
    `--stanza=${STANZA}`,
    ...args,
  ];
}

/** pgBackRest restore arguments for a target (or the latest point when none is given). */
export function restoreArgs(target) {
  return target
    ? [
        'restore',
        '--type=time',
        `--target=${target.text}`,
        '--target-action=promote',
        '--archive-mode=off',
      ]
    : ['restore', '--type=default', '--archive-mode=off'];
}

/** The `docker run -d` of the restored PostgreSQL. */
export function startArgs(io, name) {
  return [
    'run',
    '-d',
    '--name',
    name,
    '--label',
    `${RESTORE_LABEL}=1`,
    '--network',
    NETWORK,
    // restore_command (written by pgBackRest) fetches WAL with these during recovery.
    ...envNames(),
    ...mounts(io, name),
    '-p',
    '127.0.0.1::5432',
    POSTGRES_IMAGE_TAG,
    'postgres',
    '-c',
    'archive_mode=off',
  ];
}

async function cleanup(io, name, withContainer) {
  if (withContainer)
    await io.run('docker', ['rm', '-f', name], { capture: true, captureErr: true });
  await io.run('docker', ['volume', 'rm', '-f', name], { capture: true, captureErr: true });
}

/** Waits until the restored server has promoted; returns undefined or the failure line. */
async function waitForPromotion(io, name, timeoutMinutes) {
  const deadline = io.now().getTime() + timeoutMinutes * 60_000;
  const quiet = { capture: true, captureErr: true };
  while (io.now().getTime() < deadline) {
    const state = await io.run('docker', ['inspect', '-f', '{{.State.Running}}', name], quiet);
    if (state.stdout.trim() !== 'true') {
      const logs = await io.run('docker', ['logs', name], quiet);
      return (
        classifyFailure(`${logs.stdout}\n${logs.stderr}`) ??
        'restore failed: PostgreSQL stopped during recovery'
      );
    }
    const recovery = await io.run(
      'docker',
      ['exec', '-u', 'postgres', name, 'psql', '-XAtq', '-c', 'select pg_is_in_recovery()'],
      quiet,
    );
    if (recovery.code === 0 && recovery.stdout.trim() === 'f') return undefined;
    await io.sleep(1000);
  }
  return `restore failed: not promoted within ${timeoutMinutes} min`;
}

export async function restore(io, argv) {
  const parsed = parseRestoreArgs(argv);
  if (parsed.error) {
    io.out(`backup: ${parsed.error}`);
    return 2;
  }
  const { options } = parsed;
  const env = readEnv(io);
  if (env === undefined) {
    io.out(`backup: no ${ENV_PATH}; run pnpm backup:up first`);
    return 1;
  }
  const started = io.now();
  const name = `shifa-backup-restore-${stamp(started)}`;
  const quiet = { capture: true, captureErr: true, env: secretsEnv(io, env) };

  // The repository's view (works while the source is down); the source's archiver if it is up.
  const infoRun = await io.run(
    'docker',
    pgbackrestRun(io, undefined, ['info', '--output=json']),
    quiet,
  );
  let info;
  try {
    info = JSON.parse(infoRun.stdout);
  } catch {
    info = undefined;
  }
  const repoMessage = Array.isArray(info) ? (info[0]?.repo?.[0]?.status?.message ?? '') : '';
  const backups = backupsOf(info);
  if (infoRun.code !== 0 || backups.length === 0) {
    const reason = classifyFailure(`${repoMessage}\n${infoRun.stdout}\n${infoRun.stderr}`);
    io.out(reason ?? 'restore failed: no backup in the repository');
    await cleanup(io, name, false);
    return 1;
  }
  const archiverRun = await io.run('docker', psql(io, ARCHIVER_QUERY), {
    capture: true,
    captureErr: true,
  });
  const archiver = archiverRun.code === 0 ? parseArchiver(archiverRun.stdout) : undefined;
  const range = restoreRange(backups, archiver, io.now());
  const target = options.targetTime ? parseTarget(options.targetTime) : undefined;
  if (target && (target.date < range.from || target.date > range.to)) {
    const to = range.toKnown
      ? range.to.toISOString()
      : `${range.to.toISOString()} (source down: now)`;
    io.out(
      `backup: target ${options.targetTime} is outside the valid range ${range.from.toISOString()} … ${to}`,
    );
    await cleanup(io, name, false);
    return 2;
  }

  // A fresh volume; refuse before any restore call if it is not empty.
  await io.run('docker', ['volume', 'create', '--label', `${RESTORE_LABEL}=1`, name], quiet);
  const listing = await io.run(
    'docker',
    ['run', '--rm', ...mounts(io, name), POSTGRES_IMAGE_TAG, 'ls', '-A', DATA_ROOT],
    quiet,
  );
  if (listing.code !== 0 || listing.stdout.trim() !== '') {
    io.out(`backup: the target data directory (volume ${name}) is not empty; refusing to restore`);
    return 2;
  }

  const restored = await io.run('docker', pgbackrestRun(io, name, restoreArgs(target)), quiet);
  const output = `${restored.stdout}\n${restored.stderr}`;
  if (restored.code !== 0) {
    io.out(classifyFailure(output) ?? 'restore failed: pgBackRest restore failed');
    await cleanup(io, name, false);
    return 1;
  }
  const label =
    /restore backup set (\d{8}-\d{6}[FDI](?:_\d{8}-\d{6}[DI])?)/.exec(output)?.[1] ?? 'unknown';
  const pgbackrestVersion = /command begin (\d+\.\d+(?:\.\d+)?)/.exec(output)?.[1] ?? 'unknown';

  const run = await io.run('docker', startArgs(io, name), quiet);
  const failure =
    run.code !== 0
      ? 'restore failed: the restored PostgreSQL did not start'
      : await waitForPromotion(io, name, options.timeoutMinutes);
  if (failure) {
    io.out(failure);
    if (!options.keep) await cleanup(io, name, true);
    return 1;
  }
  const port = Number(
    /:(\d+)\s*$/m.exec((await io.run('docker', ['port', name, '5432/tcp'], quiet)).stdout)?.[1],
  );
  const size = await io.run(
    'docker',
    [
      'exec',
      '-u',
      'postgres',
      name,
      'psql',
      '-XAtq',
      '-c',
      'select sum(pg_database_size(oid)) from pg_database',
    ],
    quiet,
  );
  const result = {
    container: name,
    label,
    target: options.targetTime ?? 'latest',
    port,
    durationSeconds: Math.round((io.now().getTime() - started.getTime()) / 100) / 10,
    sizeBytes: Number(size.stdout.trim()) || 0,
    pgbackrestVersion,
  };
  if (options.json) io.out(JSON.stringify(result));
  else {
    io.out(`restore: backup set ${result.label}, target ${result.target}`);
    io.out(
      `restore: PostgreSQL on 127.0.0.1:${result.port} (container ${name}), ${result.durationSeconds} s`,
    );
  }
  return 0;
}
