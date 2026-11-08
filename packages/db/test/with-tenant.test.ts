// FORCE RLS probe: proves withTenant() isolates tenants and never leaks context.
// `rls_probe` is created here, not in migrations; it exists only in test databases.
import { sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, TenantContextError } from '../src/index.ts';
import { ownerDb, rawAppDb, testDb } from '../test-harness/index.ts';

const A = '0b4c1c62-4c39-4d39-9a43-6f1b8d1a0a01';
const B = '7e2f5d10-93a4-4b8e-8f6c-2c4f1d9b0b02';
const USER = '5a6b7c8d-1e2f-4a3b-8c4d-5e6f7a8b9c03';

beforeAll(async () => {
  await ownerDb().execute(sql`
    create table if not exists rls_probe (tenant_id uuid not null, label text not null);
    alter table rls_probe enable row level security;
    alter table rls_probe force row level security;
    drop policy if exists tenant_isolation on rls_probe;
    create policy tenant_isolation on rls_probe
      using (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  `);
});

beforeEach(async () => {
  await ownerDb().execute(sql`truncate rls_probe`);
  const db = testDb();
  for (const [tenantId, label] of [
    [A, 'a1'],
    [B, 'b1'],
  ] as const) {
    await db.withTenant({ tenantId, userId: USER }, (tx) =>
      tx.execute(sql`insert into rls_probe (tenant_id, label) values (${tenantId}, ${label})`),
    );
  }
});

async function labelsFor(tenantId: string): Promise<string[]> {
  const { rows } = await testDb().withTenant({ tenantId, userId: USER }, (tx) =>
    tx.execute<{ label: string }>(sql`select label from rls_probe order by label`),
  );
  return rows.map((r) => r.label);
}

describe('withTenant', () => {
  it("hides tenant A's rows inside tenant B", async () => {
    expect(await labelsFor(B)).toEqual(['b1']);
    expect(await labelsFor(A)).toEqual(['a1']);
  });

  it('sets tenant, branch and user for the transaction only', async () => {
    const branchId = '9c8b7a6d-5e4f-4a3b-9c2d-1e0f9a8b7c04';
    const { rows } = await testDb().withTenant({ tenantId: A, branchId, userId: USER }, (tx) =>
      tx.execute<{ t: string; b: string; u: string }>(
        sql`select current_tenant_id()::text as t, current_setting('app.branch_id') as b,
                   current_setting('app.user_id') as u`,
      ),
    );
    expect(rows[0]).toEqual({ t: A, b: branchId, u: USER });
  });

  it('rejects an insert with a foreign tenant_id (WITH CHECK)', async () => {
    await expect(
      testDb().withTenant({ tenantId: A, userId: USER }, (tx) =>
        tx.execute(sql`insert into rls_probe (tenant_id, label) values (${B}, 'smuggled')`),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('returns zero rows outside withTenant', async () => {
    const { rows } = await rawAppDb().execute(sql`select * from rls_probe`);
    expect(rows).toHaveLength(0);
    const viaAdmin = await testDb().withPlatformAdmin('rls probe check', (tx) =>
      tx.execute(sql`select * from rls_probe`),
    );
    expect(viaAdmin.rows).toHaveLength(0);
  });

  it('does not leak context to the next transaction on the same connection', async () => {
    const db = testDb({ max: 1 });
    expect(
      (
        await db.withTenant({ tenantId: A, userId: USER }, (tx) =>
          tx.execute(sql`select 1 from rls_probe`),
        )
      ).rows,
    ).toHaveLength(1);
    const { rows } = await db.withPlatformAdmin('leak check', (tx) =>
      tx.execute<{ tenant: string | null; n: number }>(
        sql`select current_tenant_id()::text as tenant, (select count(*)::int from rls_probe) as n`,
      ),
    );
    expect(rows[0]).toEqual({ tenant: null, n: 0 });
  });

  it('rolls back when the callback throws', async () => {
    await expect(
      testDb().withTenant({ tenantId: A, userId: USER }, async (tx) => {
        await tx.execute(sql`insert into rls_probe (tenant_id, label) values (${A}, 'temp')`);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await labelsFor(A)).toEqual(['a1']);
  });

  it('rejects invalid IDs before any SQL is sent', async () => {
    // Port 1 is closed: reaching the database would fail with ECONNREFUSED, not TenantContextError.
    const offline = createDb('postgres://shifa_app@127.0.0.1:1/shifa_test_0');
    const fn = vi.fn();
    try {
      for (const ctx of [
        { tenantId: 'not-a-uuid', userId: USER },
        { tenantId: A, userId: "'; drop table x; --" },
        { tenantId: A, branchId: '', userId: USER },
      ]) {
        await expect(offline.withTenant(ctx, fn)).rejects.toThrow(TenantContextError);
      }
      await expect(offline.withPlatformAdmin('  ', fn)).rejects.toThrow(/reason/);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      await offline.close();
    }
  });
});
