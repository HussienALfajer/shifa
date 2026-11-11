// Spec 0.2-09c criterion 10: a wrong passphrase, a missing WAL segment and an unreachable Garage
// each fail with a clear message, and a self-test passes only when its fault made the drill fail.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backupCommand, parseDrillArgs } from '../lib/backup.mjs';
import { classifyFailure, FAULT_MESSAGES, selfTestVerdict } from '../lib/backup-faults.mjs';
import { FULL_ENV, fixture, has, world } from './helpers/backup-world.mjs';

describe('failure messages from pgBackRest output (2.60.0 fixtures)', () => {
  it('maps a rejected passphrase', () => {
    assert.equal(
      classifyFailure(fixture('restore-wrong-passphrase.txt')),
      FAULT_MESSAGES['wrong-passphrase'],
    );
  });

  it('maps a missing WAL segment, naming it', () => {
    assert.equal(
      classifyFailure(fixture('recovery-missing-wal.txt')),
      'restore failed: WAL segment 000000010000000000000006 missing from the archive',
    );
  });

  it('maps an unreachable repository', () => {
    assert.equal(
      classifyFailure(fixture('restore-garage-down.txt')),
      'repository unreachable at garage-tls:443',
    );
  });

  it('passes unknown errors through with code and message, option values cut', () => {
    const line = classifyFailure('P00  ERROR: [041]: unable to open file --repo1-path=/x for read');
    assert.equal(line, 'pgBackRest error [041]: unable to open file --repo1-path=… for read');
    assert.equal(classifyFailure('INFO: all fine'), undefined);
  });

  it('never repeats a secret from the output', () => {
    const secret = 'a'.repeat(64);
    for (const text of [
      `ERROR: [099]: bad --repo1-cipher-pass=${secret}`,
      `[FormatError] ${secret}`,
    ]) {
      assert.ok(!String(classifyFailure(text)).includes(secret));
    }
  });
});

describe('self-test verdict', () => {
  const failed = (fault, segment) => ({
    injected: true,
    code: 1,
    segment,
    output: FAULT_MESSAGES[fault].replace('<segment>', segment ?? ''),
  });

  it('passes when the fault was injected and the drill failed with its message', () => {
    assert.equal(selfTestVerdict('wrong-passphrase', failed('wrong-passphrase')).code, 0);
    assert.equal(selfTestVerdict('garage-down', failed('garage-down')).code, 0);
    assert.equal(
      selfTestVerdict('missing-wal', failed('missing-wal', '000000010000000000000004')).code,
      0,
    );
  });

  it('fails when the drill passed despite the fault', () => {
    const verdict = selfTestVerdict('garage-down', { injected: true, code: 0, output: '' });
    assert.equal(verdict.code, 1);
    assert.match(verdict.line, /passed despite the fault/);
  });

  it('fails when the fault was not injected, or the message differs', () => {
    assert.equal(selfTestVerdict('garage-down', { injected: false, code: 1, output: '' }).code, 1);
    assert.equal(
      selfTestVerdict('wrong-passphrase', { injected: true, code: 1, output: 'other' }).code,
      1,
    );
  });

  it('accepts only the three faults on the command line', () => {
    assert.ok(parseDrillArgs(['--self-test', 'disk-full']).error);
    assert.equal(parseDrillArgs(['--self-test', 'missing-wal', '--keep']).options.keep, true);
  });
});

describe('fault injection', () => {
  it('removes the named segment through pgBackRest inside the stack', async () => {
    const listing =
      '18-1/0000000100000000/000000010000000000000004-c6b912709e11a648474e3145fda8e13f0502745b.zst\n';
    const w = world({
      env: FULL_ENV,
      answer: (cmd, args) => (args.includes('repo-ls') ? { stdout: listing } : undefined),
    });
    assert.equal(
      await backupCommand(['fault', 'missing-wal', '000000010000000000000004'], w.io),
      0,
    );
    const rm = w.calls.find((c) => c.args.includes('repo-rm'));
    assert.ok(has(rm.args, 'exec', '-T', '-u', 'postgres', 'postgres', 'pgbackrest'));
    assert.equal(rm.args.at(-1), `archive/shifa/${listing.trim()}`);
  });

  it('refuses a malformed segment name', async () => {
    const w = world({ env: FULL_ENV });
    assert.equal(await backupCommand(['fault', 'missing-wal', '../backup'], w.io), 2);
    assert.equal(w.calls.length, 0);
  });

  it('stops and restarts only the TLS proxy for garage-down', async () => {
    const w = world({ env: FULL_ENV });
    assert.equal(await backupCommand(['fault', 'garage-down'], w.io), 0);
    assert.ok(has(w.calls[0].args, 'stop', 'garage-tls'));
    await backupCommand(['fault', 'clear'], w.io);
    assert.ok(has(w.calls[1].args, 'up', '-d', '--wait', 'garage-tls'));
  });
});
