// Spec 0.2-09c criterion 4: `backup:check` exits 1 for broken archiving, no backup or a stale
// backup, and prints only the backup labels and the newest archived WAL.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backupCommand } from '../lib/backup.mjs';
import { evaluateCheck } from '../lib/backup-check.mjs';
import { FULL_ENV, fixture, has, world } from './helpers/backup-world.mjs';

// The fixture's backup stopped at 2026-11-11T14:29:17Z.
const FRESH = new Date('2026-11-11T15:00:00Z');
const STALE = new Date('2026-11-12T17:00:00Z'); // 26.5 h later
const ARCHIVER = '000000010000000000000005|2026-11-11T14:29:35Z|\n';

function stack({ check = { code: 0 }, info = fixture('info-ok.json'), archiver = ARCHIVER } = {}) {
  return (cmd, args) => {
    if (args.includes('check')) return check;
    if (args.includes('--output=json')) return { stdout: info };
    if (args.includes('psql')) return { stdout: archiver };
    return undefined;
  };
}

describe('backup check', () => {
  it('passes and lists the backup labels and the newest archived WAL, nothing else', async () => {
    const w = world({ env: FULL_ENV, answer: stack(), now: FRESH });
    assert.equal(await backupCommand(['check'], w.io), 0);
    assert.deepEqual(w.lines, [
      'backup full 20261111-142914F stopped 2026-11-11T14:29:17Z',
      'newest WAL 000000010000000000000005 archived 2026-11-11T14:29:35Z',
      'check: ok',
    ]);
  });

  it('fails when pgbackrest check fails (archiving broken), with the reason', async () => {
    const failed = {
      code: 82,
      stdout:
        'P00  ERROR: [082]: WAL segment 000000010000000000000006 was not archived before the 60000ms timeout\n',
    };
    const w = world({ env: FULL_ENV, answer: stack({ check: failed }), now: FRESH });
    assert.equal(await backupCommand(['check'], w.io), 1);
    assert.match(
      w.output(),
      /check failed: pgBackRest error \[082\]: WAL segment 000000010000000000000006 was not archived/,
    );
  });

  it('fails when Garage is unreachable', async () => {
    const failed = { code: 75, stdout: fixture('restore-garage-down.txt') };
    const w = world({ env: FULL_ENV, answer: stack({ check: failed }), now: FRESH });
    assert.equal(await backupCommand(['check'], w.io), 1);
    assert.match(w.output(), /check failed: repository unreachable at garage-tls:443/);
  });

  it('fails when there is no backup', async () => {
    const w = world({
      env: FULL_ENV,
      answer: stack({ info: fixture('info-empty.json') }),
      now: FRESH,
    });
    assert.equal(await backupCommand(['check'], w.io), 1);
    assert.match(w.output(), /no backup in the repository/);
  });

  it('fails when the newest backup is older than the schedule allows', async () => {
    const w = world({ env: FULL_ENV, answer: stack(), now: STALE });
    assert.equal(await backupCommand(['check'], w.io), 1);
    assert.match(w.output(), /newest backup is 26\.\d h old \(schedule allows 26 h\)/);
  });

  it('fails when archiving failed after the last success', () => {
    const verdict = evaluateCheck({
      check: { code: 0, output: '' },
      info: JSON.parse(fixture('info-ok.json')),
      archiver: {
        wal: '000000010000000000000005',
        archived: '2026-11-11T14:29:35Z',
        failed: '2026-11-11T14:40:00Z',
      },
      now: FRESH,
      maxBackupAgeHours: 26,
    });
    assert.equal(verdict.code, 1);
    assert.ok(
      verdict.lines.includes('check failed: WAL archiving has failed since 2026-11-11T14:40:00Z'),
    );
  });

  it('reports a rejected passphrase from the repository status', () => {
    const verdict = evaluateCheck({
      check: { code: 0, output: '' },
      info: JSON.parse(fixture('info-wrong-passphrase.json')),
      archiver: undefined,
      now: FRESH,
      maxBackupAgeHours: 26,
    });
    assert.equal(verdict.code, 1);
    assert.ok(verdict.lines.includes('check failed: repository passphrase rejected'));
  });

  it('prints no .env value and runs pgbackrest check and info in the source container', async () => {
    const w = world({ env: FULL_ENV, answer: stack(), now: FRESH });
    await backupCommand(['check'], w.io);
    for (const value of Object.values(FULL_ENV)) assert.ok(!w.output().includes(value));
    assert.ok(w.calls.some((c) => has(c.args, 'pgbackrest', '--stanza=shifa', 'check')));
    assert.ok(
      w.calls.some((c) => has(c.args, 'pgbackrest', '--stanza=shifa', 'info', '--output=json')),
    );
  });
});
