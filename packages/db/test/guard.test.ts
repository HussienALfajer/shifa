// Unit tests for the harness guard and the DB test lock. No Docker needed.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  acquireDbTestLock,
  assertTestTarget,
  DB_TEST_SLOTS,
  UnsafeDatabaseError,
} from '../test-harness/guard.ts';

const container = { host: 'localhost', port: 55432 };

describe('assertTestTarget', () => {
  it('refuses a host that is not the container', () => {
    expect(() => {
      assertTestTarget('postgres://prod-host/shifa', container);
    }).toThrow(UnsafeDatabaseError);
    expect(() => {
      assertTestTarget('postgres://u:p@localhost:5432/shifa_test_1', container);
    }).toThrow(UnsafeDatabaseError);
  });

  it('refuses a database name the harness did not create', () => {
    expect(() => {
      assertTestTarget('postgres://u:p@localhost:55432/shifa', container);
    }).toThrow(/shifa/);
    expect(() => {
      assertTestTarget('postgres://u:p@localhost:55432/shifa_test_1x', container);
    }).toThrow(UnsafeDatabaseError);
  });

  it("accepts the container's own databases", () => {
    for (const db of ['shifa_test_1', 'shifa_test_12', 'shifa_template', 'postgres']) {
      expect(() => {
        assertTestTarget(`postgres://shifa_app:pw@localhost:55432/${db}`, container);
      }).not.toThrow();
    }
  });
});

describe('assertTestTarget with the PgBouncer address (0.3-S2a)', () => {
  // Distinct hosts so that "pooler host + PostgreSQL port" is a pair the harness never created.
  const harness = { host: 'localhost', port: 55432, pooler: { host: '127.0.0.1', port: 56432 } };

  it('accepts the pooler address the harness created', () => {
    expect(() => {
      assertTestTarget('postgres://shifa_app:pw@127.0.0.1:56432/shifa_test_1', harness);
    }).not.toThrow();
    expect(() => {
      assertTestTarget('postgres://shifa_app:pw@localhost:55432/shifa_test_1', harness);
    }).not.toThrow();
  });

  it('refuses another port, a mixed host and port pair, and an unknown host', () => {
    for (const address of [
      '127.0.0.1:56433',
      '127.0.0.1:55432',
      'localhost:56432',
      'pooler.example:56432',
    ]) {
      expect(() => {
        assertTestTarget(`postgres://shifa_app:pw@${address}/shifa_test_1`, harness);
      }).toThrow(UnsafeDatabaseError);
    }
  });

  it('refuses the pooler address when the harness started no pooler', () => {
    expect(() => {
      assertTestTarget('postgres://shifa_app:pw@127.0.0.1:56432/shifa_test_1', container);
    }).toThrow(UnsafeDatabaseError);
  });

  it('accepts the PgBouncer admin database only on the pooler address', () => {
    expect(() => {
      assertTestTarget('postgres://admin:pw@127.0.0.1:56432/pgbouncer', harness);
    }).not.toThrow();
    expect(() => {
      assertTestTarget('postgres://admin:pw@localhost:55432/pgbouncer', harness);
    }).toThrow(UnsafeDatabaseError);
  });
});

function tempLockFile(): string {
  return join(mkdtempSync(join(tmpdir(), 'shifa-lock-')), 'db-test.lock');
}

describe('acquireDbTestLock', () => {
  it('has a small fixed number of slots by default', () => {
    expect(DB_TEST_SLOTS).toBeGreaterThanOrEqual(2);
    expect(DB_TEST_SLOTS).toBeLessThanOrEqual(4);
  });

  it('takes a free slot next to another live run without waiting', async () => {
    const file = tempLockFile();
    writeFileSync(`${file}.0`, String(process.pid)); // another run holds slot 0
    const started = Date.now();
    const release = await acquireDbTestLock({ file, slots: 2, waitMs: 0, pollMs: 50 });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(readFileSync(`${file}.1`, 'utf8')).toBe(String(process.pid));
    release();
    expect(existsSync(`${file}.1`)).toBe(false);
    expect(readFileSync(`${file}.0`, 'utf8')).toBe(String(process.pid));
  });

  it('waits while every slot is held by a live run, then fails with a clear message', async () => {
    const file = tempLockFile();
    writeFileSync(`${file}.0`, String(process.pid));
    writeFileSync(`${file}.1`, String(process.pid));
    const started = Date.now();
    await expect(acquireDbTestLock({ file, slots: 2, waitMs: 300, pollMs: 50 })).rejects.toThrow(
      /another database test run.*all 2 slots/i,
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it('reclaims a slot left by a dead process', async () => {
    const file = tempLockFile();
    const dead = spawnSync(process.execPath, ['-e', '0']).pid;
    writeFileSync(`${file}.0`, String(dead));
    const release = await acquireDbTestLock({ file, slots: 1, waitMs: 0, pollMs: 50 });
    expect(readFileSync(`${file}.0`, 'utf8')).toBe(String(process.pid));
    release();
  });
});
