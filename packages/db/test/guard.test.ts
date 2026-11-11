// Unit tests for the harness guard and the DB test lock. No Docker needed.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquireDbTestLock, assertTestTarget, UnsafeDatabaseError } from '../test-harness/guard.ts';

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
  it('waits for a live holder, then fails with a clear message', async () => {
    const file = tempLockFile();
    writeFileSync(file, String(process.pid));
    const started = Date.now();
    await expect(acquireDbTestLock({ file, waitMs: 300, pollMs: 50 })).rejects.toThrow(
      /another database test run/i,
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it('reclaims a lock left by a dead process', async () => {
    const file = tempLockFile();
    const dead = spawnSync(process.execPath, ['-e', '0']).pid;
    writeFileSync(file, String(dead));
    const release = await acquireDbTestLock({ file, waitMs: 0, pollMs: 50 });
    expect(readFileSync(file, 'utf8')).toBe(String(process.pid));
    release();
  });
});
