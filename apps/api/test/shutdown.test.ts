import { createDb } from '@shifa/db';
import { harnessUrl } from '@shifa/db/testing';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './support.ts';

describe('shutdown', () => {
  it('app.close() closes the database pool', async () => {
    const db = createDb(harnessUrl('app'));
    const { app } = await buildTestApp({ db });
    const ready = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(ready.statusCode).toBe(200);

    await app.close();

    await expect(
      db.withPlatformAdmin('after shutdown', (tx) => tx.execute(sql`select 1`)),
    ).rejects.toThrow();
    // A second close (e.g. a signal racing a test teardown) must not throw.
    await expect(db.close()).resolves.toBeUndefined();
  });
});
