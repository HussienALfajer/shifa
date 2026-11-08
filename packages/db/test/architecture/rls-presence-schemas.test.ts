// Security re-review of 0.2-06b: a schema whose name merely starts with "pg" (pg-boss's
// default `pgboss`, ADR-0003) slipped past the outside-public check (LIKE 'pg_%' matched it).
import { sql } from 'drizzle-orm';
import { beforeAll, expect, it } from 'vitest';
import { TABLE_CLASSIFICATION } from '../../src/schema/classification.ts';
import { ensureWorkerDatabase, ownerDb } from '../../test-harness/index.ts';
import { type Catalog, checkRlsPresence } from './rls-presence.ts';

let pristine: string;

beforeAll(async () => {
  pristine = await ensureWorkerDatabase('9997');
});

class RolledBack extends Error {}

it('fails a table in a schema named like a system schema (pgboss)', async () => {
  let found: string[] = [];
  try {
    await ownerDb(pristine).transaction(async (tx) => {
      await tx.execute(sql`create schema pgboss`);
      await tx.execute(sql`create table pgboss.job (tenant_id uuid not null, data jsonb)`);
      found = await checkRlsPresence(tx as unknown as Catalog, TABLE_CLASSIFICATION);
      throw new RolledBack();
    });
  } catch (err) {
    if (!(err instanceof RolledBack)) throw err;
  }
  expect(found).toEqual([expect.stringMatching(/pgboss\.job: .*schema/)]);
});
