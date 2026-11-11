// Pure core of `pnpm backup:*` (scripts/backup.mjs): the local backup stack in infra/backup
// (spec 0.2-09c). Every effect goes through `io` (lib/stack-io.mjs).

import { check } from './backup-check.mjs';
import { isDisposableStack, POSTGRES_PORT, readEnv } from './backup-env.mjs';
import { FAULTS, injectFault, selfTestVerdict } from './backup-faults.mjs';
import { flagValue, restore } from './backup-restore.mjs';
import { down, reset, backup as runBackup, up } from './backup-stack.mjs';

const USAGE =
  'usage: pnpm backup:up | backup:down | backup:reset --yes | backup:full | backup:diff | ' +
  'backup:check | backup:restore [--target-time <ISO time>] [--keep] | ' +
  'backup:drill [--keep] [--self-test wrong-passphrase|missing-wal|garage-down]';

/** Printed by packages/db/scripts/backup-drill.ts when a self-test fault is in place. */
export const FAULT_MARKER = 'DRILL_FAULT_INJECTED';

export function parseDrillArgs(argv) {
  const options = { keep: false, selfTest: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--keep') options.keep = true;
    else if (argv[i] === '--self-test') {
      // Never fall back to the normal drill when the value is missing.
      options.selfTest = flagValue(argv, i++) ?? '';
    } else return { error: `unknown option ${argv[i]}` };
  }
  if (options.selfTest !== undefined && !FAULTS.includes(options.selfTest)) {
    return { error: `--self-test takes one of ${FAULTS.join(', ')}` };
  }
  return { options };
}

/**
 * `backup:drill`: a fresh stack (reset + up), then packages/db/scripts/backup-drill.ts with the
 * connection details in its environment only. A self-test passes only when its fault was
 * injected and the drill failed with the fault's message.
 */
async function drill(io, argv) {
  const parsed = parseDrillArgs(argv);
  if (parsed.error) {
    io.out(`backup: ${parsed.error}`);
    return 2;
  }
  const { keep, selfTest } = parsed.options;
  if ((await reset(io, ['--yes'])) !== 0 || (await up(io)) !== 0) return 1;
  const env = readEnv(io);
  const child = await io.run('pnpm', ['--filter', '@shifa/db', 'backup-drill'], {
    capture: selfTest !== undefined,
    env: {
      BACKUP_DRILL_PORT: String(POSTGRES_PORT),
      BACKUP_DRILL_PASSWORD: env.BACKUP_POSTGRES_PASSWORD,
      BACKUP_DRILL_SELF_TEST: selfTest ?? '',
      BACKUP_DRILL_KEEP: keep ? '1' : '',
    },
  });
  if (selfTest === undefined) return child.code === 0 ? 0 : 1;
  io.out(child.stdout.trimEnd());
  const marker = child.stdout
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${FAULT_MARKER} ${selfTest}`));
  if (selfTest === 'garage-down') await injectFault(io, ['clear']);
  const verdict = selfTestVerdict(selfTest, {
    injected: marker !== undefined,
    code: child.code,
    output: child.stdout,
    segment: marker?.split(' ')[2],
  });
  io.out(verdict.line);
  return verdict.code;
}

/** Runs one `backup` command; resolves to the process exit code. */
export async function backupCommand(argv, io) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'up':
      return up(io);
    case 'down':
      return down(io);
    case 'reset':
      return reset(io, rest);
    case 'full':
    case 'diff':
      return runBackup(io, command);
    case 'check':
      return check(io);
    case 'restore':
      return restore(io, rest);
    case 'drill':
    case 'fault': {
      // Both destroy data (reset; an archived WAL segment): only on a disposable stack whose
      // .env `up` marked as local, never on a stack set up some other way.
      if (!isDisposableStack(readEnv(io))) {
        io.out(`backup: ${command} runs only on the local stack (BACKUP_STACK=local in .env)`);
        return 1;
      }
      // `fault` is internal: called by the drill's self-tests.
      return command === 'drill' ? drill(io, rest) : injectFault(io, rest);
    }
    default:
      io.out(USAGE);
      return 2;
  }
}
