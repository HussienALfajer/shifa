// Unit test (no Docker): several DB projects in one Vitest process share one slot.
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquireDbTestLock } from '../test-harness/guard.ts';

describe('acquireDbTestLock in one process', () => {
  it('re-enters the same slot without waiting and frees it after the last release', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'shifa-lock-')), 'db-test.lock');
    // One slot: a second acquisition that did not re-enter would fail at once.
    const first = await acquireDbTestLock({ file, slots: 1, waitMs: 0 });
    const second = await acquireDbTestLock({ file, slots: 1, waitMs: 0 });
    first();
    first(); // a double release must not free the second holder's slot
    expect(existsSync(`${file}.0`)).toBe(true);
    second();
    expect(existsSync(`${file}.0`)).toBe(false);
  });
});
