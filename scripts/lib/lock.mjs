// Advisory lock file shared by `verify` (.verify/lock) and the DB test harness
// (.verify/db-test.lock). The file holds the owner's pid and is created atomically ('wx').
// A lock of a dead process, or an empty/garbage lock older than a few seconds (a run killed while
// writing it), is removed and the create retried.

import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

/** A young garbage lock is treated as a run that is still writing its pid. */
const STARTING_GRACE_MS = 5000;

export class LockBusyError extends Error {
  /** @param {number | null} pid live holder, or null while another run is starting */
  constructor(pid) {
    super(pid ? `lock held by pid ${pid}` : 'another run is starting');
    this.name = 'LockBusyError';
    this.pid = pid;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to another user.
    return err?.code === 'EPERM';
  }
}

/** One attempt. Returns null when acquired, otherwise the LockBusyError to report. */
function tryOnce(file) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(file, String(process.pid), { flag: 'wx' });
      return null;
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
    }
    let text;
    let ageMs;
    try {
      text = readFileSync(file, 'utf8').trim();
      ageMs = Date.now() - statSync(file).mtimeMs;
    } catch (err) {
      if (err?.code === 'ENOENT') continue; // released between our create and read
      throw err;
    }
    const pid = Number(text);
    const validPid = /^\d+$/.test(text) && pid > 0;
    if (validPid && isAlive(pid)) return new LockBusyError(pid);
    if (!validPid && ageMs < STARTING_GRACE_MS) return new LockBusyError(null);
    rmSync(file, { force: true });
  }
  return new LockBusyError(null);
}

/**
 * Acquires the lock, polling for up to `waitMs` while another live process holds it.
 * @param {string} file
 * @param {{ waitMs?: number, pollMs?: number }} [options]
 * @returns {Promise<() => void>} release; removes the file only if this process still owns it
 * @throws {LockBusyError} when still held after `waitMs`
 */
export async function acquireLock(file, { waitMs = 0, pollMs = 500 } = {}) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const busy = tryOnce(file);
    if (!busy) break;
    if (Date.now() >= deadline) throw busy;
    await sleep(Math.min(pollMs, Math.max(1, deadline - Date.now())));
  }
  return () => {
    try {
      if (readFileSync(file, 'utf8').trim() === String(process.pid)) rmSync(file, { force: true });
    } catch {
      // already gone
    }
  };
}
