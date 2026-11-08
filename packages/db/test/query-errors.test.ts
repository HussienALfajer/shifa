// Query parameters can be patient data; Drizzle's error message lists them, so the wrappers
// rethrow the driver's error instead. (PostgreSQL itself may still echo a value in some messages,
// e.g. cast or unique-violation errors: loggers must log `code`, never `message`/`detail`.)
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { testDb } from '../test-harness/index.ts';

const T = '0b4c1c62-4c39-4d39-9a43-6f1b8d1a0a01';
const U = '5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c03';
// A recognisable synthetic parameter value (stands in for patient data).
const MARKER = 'synthetic-param-0963';

describe('query errors', () => {
  it('carry the SQLSTATE but not the query parameters', async () => {
    const err: unknown = await testDb()
      .withTenant({ tenantId: T, userId: U }, (tx) =>
        tx.execute(sql`select ${MARKER}::text as v, 1 / 0 as boom`),
      )
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({ code: '22012' });
    expect((err as Error).message).not.toContain(MARKER);
    expect(JSON.stringify(err)).not.toContain(MARKER);
  });
});
