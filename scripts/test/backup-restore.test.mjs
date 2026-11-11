// Spec 0.2-09c criterion 5: `backup:restore` restores into a new, empty volume and container,
// never the source, refuses targets outside the valid range and non-empty data directories,
// and starts the restored PostgreSQL with archive_mode=off.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backupCommand } from '../lib/backup.mjs';
import { parseTarget, restoreArgs } from '../lib/backup-restore.mjs';
import { FULL_ENV, fixture, has, world } from './helpers/backup-world.mjs';

// Fixture: backup stopped 2026-11-11T14:29:17Z; newest WAL archived 2026-11-11T14:29:35Z.
const ARCHIVER = '000000010000000000000005|2026-11-11T14:29:35Z|\n';
const RESTORE_OUT =
  'P00   INFO: restore command begin 2.60.0: --stanza=shifa\nP00   INFO: repo1: restore backup set 20261111-142914F, recovery will start at 2026-11-11 14:29:14\n';

function stack({
  listing = '',
  restore = { stdout: RESTORE_OUT },
  running = 'true',
  recovery = 'f',
} = {}) {
  return (cmd, args) => {
    if (args.includes('--output=json')) return { stdout: fixture('info-ok.json') };
    if (
      args.includes('psql') &&
      args.includes('postgres') &&
      args.includes('exec') &&
      args.includes('-T')
    ) {
      return { stdout: ARCHIVER };
    }
    if (args.includes('ls')) return { stdout: listing };
    if (args.includes('restore')) return restore;
    if (args.includes('{{.State.Running}}')) return { stdout: `${running}\n` };
    if (args.includes('logs')) return { stdout: fixture('recovery-missing-wal.txt') };
    if (args.includes('select pg_is_in_recovery()')) return { stdout: `${recovery}\n` };
    if (args[0] === 'port') return { stdout: '127.0.0.1:50492\n' };
    if (args.includes('select sum(pg_database_size(oid)) from pg_database'))
      return { stdout: '31666323\n' };
    return undefined;
  };
}

const restoreCalls = (w) =>
  w.calls.filter((c) => c.args.includes('pgbackrest') && c.args.includes('restore'));

describe('backup restore', () => {
  it('restores to a target time in a new volume and promotes', async () => {
    const w = world({ env: FULL_ENV, answer: stack() });
    const code = await backupCommand(
      ['restore', '--target-time', '2026-11-11T14:29:30Z', '--json'],
      w.io,
    );
    assert.equal(code, 0, w.output());
    const [call] = restoreCalls(w);
    assert.ok(
      has(
        call.args,
        'restore',
        '--type=time',
        '--target=2026-11-11 14:29:30+00',
        '--target-action=promote',
      ),
    );
    const result = JSON.parse(w.lines.at(-1));
    assert.equal(result.label, '20261111-142914F');
    assert.equal(result.port, 50492);
    assert.equal(result.pgbackrestVersion, '2.60.0');
    assert.match(result.container, /^shifa-backup-restore-\d{8}t\d{6}z$/);
  });

  it('restores the latest point by default', async () => {
    const w = world({ env: FULL_ENV, answer: stack() });
    assert.equal(await backupCommand(['restore'], w.io), 0);
    assert.ok(has(restoreCalls(w)[0].args, 'restore', '--type=default'));
    assert.match(w.output(), /target latest/);
  });

  it('never mounts the source volume and starts with archive_mode=off', async () => {
    const w = world({ env: FULL_ENV, answer: stack() });
    await backupCommand(['restore'], w.io);
    for (const call of w.calls) {
      assert.ok(
        !call.args.some((a) => /source=shifa-backup_pgdata/.test(a)),
        'source volume mounted',
      );
      assert.ok(!call.args.includes('down') && !call.args.includes('stop'), 'source touched');
    }
    const start = w.calls.find((c) => has(c.args, 'run', '-d'));
    assert.ok(has(start.args, 'postgres', '-c', 'archive_mode=off'));
    assert.ok(has(start.args, '-p', '127.0.0.1::5432'));
  });

  it('refuses a target before the oldest backup with the valid range (exit 2)', async () => {
    const w = world({ env: FULL_ENV, answer: stack() });
    assert.equal(
      await backupCommand(['restore', '--target-time', '2026-11-11T14:00:00Z'], w.io),
      2,
    );
    assert.match(
      w.output(),
      /outside the valid range 2026-11-11T14:29:17\.000Z … 2026-11-11T14:29:35\.000Z/,
    );
    assert.equal(restoreCalls(w).length, 0);
  });

  it('refuses a target after the newest archived WAL (exit 2)', async () => {
    const w = world({ env: FULL_ENV, answer: stack() });
    assert.equal(
      await backupCommand(['restore', '--target-time', '2026-11-11T14:45:00+00:00'], w.io),
      2,
    );
    assert.equal(restoreCalls(w).length, 0);
  });

  it('refuses a non-empty target data directory before any restore call (exit 2)', async () => {
    const w = world({ env: FULL_ENV, answer: stack({ listing: '18\n' }) });
    assert.equal(await backupCommand(['restore'], w.io), 2);
    assert.match(w.output(), /is not empty; refusing to restore/);
    assert.equal(restoreCalls(w).length, 0);
  });

  it('refuses a target without a time zone', async () => {
    const w = world({ env: FULL_ENV, answer: stack() });
    assert.equal(await backupCommand(['restore', '--target-time', '2026-11-11 14:29:30'], w.io), 2);
    assert.equal(w.calls.length, 0);
    assert.equal(parseTarget('2026-11-11T14:29:30.123456Z').text, '2026-11-11 14:29:30.123456+00');
  });

  it('reports a missing WAL segment when recovery stops short, and removes the restore', async () => {
    const w = world({ env: FULL_ENV, answer: stack({ running: 'false' }) });
    assert.equal(
      await backupCommand(['restore', '--target-time', '2026-11-11T14:29:30Z'], w.io),
      1,
    );
    assert.match(
      w.output(),
      /restore failed: WAL segment 000000010000000000000006 missing from the archive/,
    );
    assert.ok(w.calls.some((c) => has(c.args, 'volume', 'rm', '-f')));
  });

  it('passes secrets by name only (-e NAME), values in the child environment', async () => {
    const w = world({ env: FULL_ENV, answer: stack() });
    await backupCommand(['restore'], w.io);
    const [call] = restoreCalls(w);
    assert.ok(has(call.args, '-e', 'PGBACKREST_REPO1_CIPHER_PASS'));
    assert.equal(call.options.env.PGBACKREST_REPO1_CIPHER_PASS, FULL_ENV.BACKUP_CIPHER_PASS);
    for (const c of w.calls)
      for (const v of Object.values(FULL_ENV)) assert.ok(!c.args.includes(v));
  });

  it('builds time and default restore arguments', () => {
    assert.deepEqual(restoreArgs(undefined), ['restore', '--type=default']);
  });
});
