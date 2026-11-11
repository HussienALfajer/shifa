// Turning pgBackRest and PostgreSQL output into one clear line (spec 0.2-09c criterion 10), and
// the drill's fault self-tests. Only fixed text and names read from the output (error types,
// codes, WAL segment names) reach a message: never a secret, a path with credentials or a value.
//
// Proven on pgBackRest 2.60.0 (2026-11-11): a wrong passphrase fails decrypting the info files
// ("[FormatError] unable to load info file", then "ERROR: [075]"); an unreachable repository
// gives "[HostConnectError]"; a missing archived segment lets the restore finish but makes the
// archive-get during recovery report "unable to find <segment> in the archive", and PostgreSQL
// then stops with "recovery ended before configured recovery target was reached".
import { compose, pgbackrest, REPO_ENDPOINT } from './backup-env.mjs';

export const FAULTS = ['wrong-passphrase', 'missing-wal', 'garage-down'];

/** The line each fault must produce; `<segment>` is the injected segment's name. */
export const FAULT_MESSAGES = {
  'wrong-passphrase': 'restore failed: repository passphrase rejected',
  'missing-wal': 'restore failed: WAL segment <segment> missing from the archive',
  'garage-down': `repository unreachable at ${REPO_ENDPOINT}`,
};

const PASSPHRASE_ERRORS = /\[(FormatError|CryptoError)\]/;
const UNREACHABLE_ERRORS = /\[(HostConnectError|HostInvalidError)\]/;
const MISSING_SEGMENT = /unable to find ([0-9A-F]{24}) in the archive/g;
const RECOVERY_SHORT = /recovery ended before configured recovery target was reached/;
const PGBACKREST_ERROR = /ERROR: \[(\d{3})\]: ([^\n]*)/;

/**
 * One line for a failed pgBackRest or recovery run, or undefined when the output shows no
 * failure. Unknown errors pass through as pgBackRest's code and first message line, with
 * anything that looks like an option value cut off.
 */
export function classifyFailure(output) {
  const text = String(output ?? '');
  if (UNREACHABLE_ERRORS.test(text)) return FAULT_MESSAGES['garage-down'];
  if (PASSPHRASE_ERRORS.test(text)) return FAULT_MESSAGES['wrong-passphrase'];
  if (RECOVERY_SHORT.test(text)) {
    const missing = [...text.matchAll(MISSING_SEGMENT)].map((m) => m[1]);
    const segment = missing.at(-1);
    return segment
      ? FAULT_MESSAGES['missing-wal'].replace('<segment>', segment)
      : 'restore failed: recovery ended before the target time (WAL missing or not yet archived)';
  }
  const error = PGBACKREST_ERROR.exec(text);
  if (error)
    return `pgBackRest error [${error[1]}]: ${error[2].replace(/=\S+/g, '=…').slice(0, 160)}`;
  return undefined;
}

/** Self-test verdict: 0 only when the fault was injected and the run failed with its message. */
export function selfTestVerdict(fault, { injected, code, output, segment }) {
  if (!FAULTS.includes(fault)) return { code: 2, line: `backup: unknown self-test ${fault}` };
  if (!injected) return { code: 1, line: `self-test ${fault}: the fault was not injected` };
  const expected = FAULT_MESSAGES[fault].replace('<segment>', segment ?? '<segment>');
  if (code === 0)
    return { code: 1, line: `self-test ${fault}: the drill passed despite the fault` };
  if (!String(output).includes(expected)) {
    return { code: 1, line: `self-test ${fault}: failed without the expected "${expected}"` };
  }
  return { code: 0, line: `self-test ${fault}: ok (failed with "${expected}")` };
}

/**
 * `backup.mjs fault <kind> [segment]`, called by the drill between writing and restoring:
 * - missing-wal: removes one archived segment through the stack's own key, inside the stack;
 * - garage-down: stops the TLS proxy, so the repository is unreachable;
 * - clear: starts it again.
 * The wrong passphrase needs no injection: the drill restores with another BACKUP_CIPHER_PASS.
 */
export async function injectFault(io, [kind, segment]) {
  if (kind === 'garage-down') {
    const result = await io.run('docker', compose(io, 'stop', 'garage-tls'), { capture: true });
    return result.code === 0 ? 0 : 1;
  }
  if (kind === 'clear') {
    const result = await io.run('docker', compose(io, 'up', '-d', '--wait', 'garage-tls'), {
      capture: true,
    });
    return result.code === 0 ? 0 : 1;
  }
  if (kind === 'missing-wal') {
    if (!/^[0-9A-F]{24}$/.test(segment ?? '')) {
      io.out('backup: fault missing-wal needs a WAL segment name');
      return 2;
    }
    const list = await io.run('docker', pgbackrest(io, 'repo-ls', '--recurse', 'archive/shifa'), {
      capture: true,
    });
    const file = list.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.split('/').at(-1)?.startsWith(`${segment}-`));
    if (list.code !== 0 || !file) {
      io.out(`backup: segment ${segment} not found in the archive`);
      return 1;
    }
    const removed = await io.run('docker', pgbackrest(io, 'repo-rm', `archive/shifa/${file}`), {
      capture: true,
    });
    return removed.code === 0 ? 0 : 1;
  }
  io.out('usage: backup.mjs fault missing-wal <segment> | garage-down | clear');
  return 2;
}
