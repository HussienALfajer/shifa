// Regression test for the 0.3-S7a review: one failed write must not poison the store.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStore } from '../src/index.ts';
import { tempDir } from './helpers.ts';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

describe('store', () => {
  it('a failed append fails only its caller; later writes and reads still work', async () => {
    const t = tempDir();
    cleanup = t.cleanup;
    // `logs` is a file, so any write under logs/ fails; state/ still works.
    writeFileSync(join(t.dir, 'logs'), 'not a directory');
    mkdirSync(join(t.dir, 'state'));
    const store = createStore(t.dir);

    await expect(store.append('requests', { a: 1 })).rejects.toThrow();
    await store.append('devices', { installId: 'install-1' });
    expect(await store.readAll('devices')).toEqual([{ installId: 'install-1' }]);
  });
});
