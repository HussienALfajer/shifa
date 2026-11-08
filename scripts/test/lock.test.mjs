import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { acquireLock, LockBusyError } from '../lib/lock.mjs';

const lockPath = () => join(mkdtempSync(join(tmpdir(), 'shifa-lock-')), 'lock');
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;

describe('acquireLock (shared by verify and the DB test harness)', () => {
  it('writes the pid and removes the file on release', async () => {
    const file = lockPath();
    const release = await acquireLock(file);
    assert.equal(readFileSync(file, 'utf8'), String(process.pid));
    release();
    assert.equal(existsSync(file), false);
  });

  it('fails at once when a live process holds it (verify: no wait)', async () => {
    const file = lockPath();
    writeFileSync(file, String(process.pid));
    await assert.rejects(acquireLock(file), (err) => {
      assert.ok(err instanceof LockBusyError);
      assert.equal(err.pid, process.pid);
      return true;
    });
    assert.equal(readFileSync(file, 'utf8'), String(process.pid));
  });

  it('treats a young empty lock as a run that is starting', async () => {
    const file = lockPath();
    writeFileSync(file, '');
    await assert.rejects(acquireLock(file), (err) => err instanceof LockBusyError && !err.pid);
  });

  it('reclaims an old garbage lock and a lock of a dead process', async () => {
    const garbage = lockPath();
    writeFileSync(garbage, 'not-a-pid');
    const old = (Date.now() - 60_000) / 1000;
    utimesSync(garbage, old, old);
    (await acquireLock(garbage))();

    const dead = lockPath();
    writeFileSync(dead, String(deadPid()));
    (await acquireLock(dead))();
  });

  it('waits for the holder when asked to', async () => {
    const file = lockPath();
    writeFileSync(file, String(process.pid));
    setTimeout(() => writeFileSync(file, String(deadPid())), 100);
    const release = await acquireLock(file, { waitMs: 2000, pollMs: 25 });
    assert.equal(readFileSync(file, 'utf8'), String(process.pid));
    release();
  });

  it('does not remove a lock that another process took over', async () => {
    const file = lockPath();
    const release = await acquireLock(file);
    writeFileSync(file, '424242');
    release();
    assert.equal(readFileSync(file, 'utf8'), '424242');
  });
});
