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
