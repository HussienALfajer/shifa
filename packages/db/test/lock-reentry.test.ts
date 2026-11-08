// Unit test (no Docker): several DB projects in one Vitest process share one lock hold.
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquireDbTestLock } from '../test-harness/guard.ts';

describe('acquireDbTestLock in one process', () => {
  it('re-enters without waiting and frees the file after the last release', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'shifa-lock-')), 'db-test.lock');
    const first = await acquireDbTestLock({ file, waitMs: 0 });
    const second = await acquireDbTestLock({ file, waitMs: 0 });
    first();
    first(); // a double release must not free the second holder's lock
    expect(existsSync(file)).toBe(true);
    second();
    expect(existsSync(file)).toBe(false);
  });
});
