// Security-review hardening (0.2-05): each case was reproduced as an exploit before the fix.
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, ROLES_SQL, type Tx } from '../src/index.ts';
import {
  ensureWorkerDatabase,
  harnessUrl,
  ownerDb,
  rawAppDb,
  superuserDb,
  testDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = '0b4c1c62-4c39-4d39-9a43-6f1b8d1a0a01';
const USER = '5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c03';

describe('transaction handles', () => {
  it('refuse queries after withTenant() returns', async () => {
    let leaked: Tx | undefined;
    await testDb().withTenant({ tenantId: A, userId: USER }, async (tx) => {
      leaked = tx;
      await tx.execute(sql`select 1`);
    });
    // Drizzle wraps the refusal (the leaked call bypasses our unwrapping); the cause says why.
    await expect(leaked?.execute(sql`select 1`)).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/after its withTenant/) as unknown },
    });
  });

  it('withPlatformAdmin ignores a tenant someone set at session level', async () => {
    const db = testDb({ max: 1 });
    await db.withTenant({ tenantId: A, userId: USER }, (tx) =>
      tx.execute(sql`select set_config('app.tenant_id', ${A}, false)`),
    );
    const { rows } = await db.withPlatformAdmin('session leak check', (tx) =>
      tx.execute<{ t: string | null }>(sql`select current_tenant_id()::text as t`),
    );
    expect(rows[0]?.t).toBeNull();
  });
});

describe('privileges of shifa_app', () => {
  it('cannot create temporary tables (no RLS, outlive the transaction)', async () => {
    await expect(
      testDb().withTenant({ tenantId: A, userId: USER }, (tx) =>
        tx.execute(sql`create temp table scratch (x int)`),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("cannot execute the owner's new functions unless granted", async () => {
    await ownerDb().execute(
      sql`create or replace function hardening_probe() returns int language sql as 'select 1'`,
    );
    await expect(rawAppDb().execute(sql`select hardening_probe()`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it('roles.sql refuses a shifa_app that gained a role membership', async () => {
    // Inside one transaction that is rolled back, so other workers never see the membership.
    await expect(
      superuserDb().transaction(async (tx) => {
        await tx.execute(sql`create role hardening_mid nologin`);
        await tx.execute(sql`grant hardening_mid to shifa_app`);
        await tx.execute(sql.raw(readFileSync(ROLES_SQL, 'utf8')));
      }),
    ).rejects.toThrow();
    const { rows } = await superuserDb().execute<{ n: number }>(
      sql`select count(*)::int as n from pg_roles where rolname = 'hardening_mid'`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('createDb() refuses a role that bypasses RLS', async () => {
    const asOwner = createDb(harnessUrl('owner'), { max: 1 });
    try {
      await expect(
        asOwner.withTenant({ tenantId: A, userId: USER }, (tx) => tx.execute(sql`select 1`)),
      ).rejects.toThrow(/application role/);
    } finally {
      await asOwner.close();
    }
  });
});

describe('worker isolation', () => {
  it('rows in another worker database are not visible here', async () => {
    const other = await ensureWorkerDatabase('9998');
    expect(other).not.toBe(workerDatabaseName());
    await ownerDb(other).execute(sql`create table if not exists isolation_probe (v text)`);
    await ownerDb(other).execute(sql`insert into isolation_probe values ('other-worker')`);
    await ownerDb().execute(sql`create table if not exists isolation_probe (v text)`);
    const { rows } = await ownerDb().execute<{ db: string; n: number }>(
      sql`select current_database() as db, (select count(*)::int from isolation_probe) as n`,
    );
    expect(rows[0]).toEqual({ db: workerDatabaseName(), n: 0 });
  });
});
