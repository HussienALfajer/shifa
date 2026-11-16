// Advisory lock files: `verify` holds one (.verify/lock); the DB test harness takes one of a few
// slots (.verify/db-test.lock.<n>, acquireSlot). A file holds the owner's pid and is created
// atomically ('wx').
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
  } catch {
    // Includes EPERM (a reused pid of another user's process): treated as dead, as verify
    // always did, so a stale lock never blocks every later run.
    return false;
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
  return releaser(file);
}

/**
 * A counting semaphore: `slots` lock files `<base>.0` … `<base>.<slots - 1>`, each taken like
 * acquireLock (pid, atomic create, stale locks reclaimed). Takes the first free slot, polling for
 * up to `waitMs` while every slot is held by a live process. When several processes reclaim the
 * same dead slot at once, two can end up running on it, so the limit is a load cap, never a
 * guarantee (the DB harness relies on it for nothing else).
 * @param {string} base
 * @param {{ slots: number, waitMs?: number, pollMs?: number }} options
 * @returns {Promise<() => void>} release; removes the slot file only if this process still owns it
 * @throws {LockBusyError} when every slot is still held after `waitMs` (pid of the first holder)
 */
export async function acquireSlot(base, { slots, waitMs = 0, pollMs = 500 }) {
  if (!Number.isInteger(slots) || slots < 1) {
    throw new RangeError(`slots must be a positive integer, got ${slots}`);
  }
  const deadline = Date.now() + waitMs;
  for (;;) {
    let busy = null;
    for (let i = 0; i < slots; i += 1) {
      const file = `${base}.${i}`;
      const err = tryOnce(file);
      if (!err) return releaser(file);
      busy ??= err;
    }
    if (Date.now() >= deadline) throw busy;
    await sleep(Math.min(pollMs, Math.max(1, deadline - Date.now())));
  }
}

function releaser(file) {
  return () => {
    try {
      if (readFileSync(file, 'utf8').trim() === String(process.pid)) rmSync(file, { force: true });
    } catch {
      // already gone
    }
  };
}
