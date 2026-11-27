// createClinic() (A-01a criterion 2): one tenant, one organization, one active main branch
// «الفرع الرئيسي» and a deployment route, in one transaction on the platform path. A failure at
// the last insert leaves nothing behind, and no tenant context outlives the call.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createClinic, MAIN_BRANCH_NAME, type NewClinic } from '../src/index.ts';
import { fixtureId, testDb, testPlatformDb } from '../test-harness/index.ts';

const ADMIN = fixtureId('clinic super admin');
const USER = fixtureId('clinic reader');

const input = (tenantId: string, extra: Partial<NewClinic> = {}): NewClinic => ({
  tenantId,
  name: 'عيادة اختبار تجريبية',
  type: 'multi_doctor',
  ...extra,
});

/** What the new tenant's own staff would see (shifa_app inside that tenant). */
async function tenantView(tenantId: string) {
  const { rows } = await testDb().withTenant({ tenantId, userId: USER }, (tx) =>
    tx.execute<{
      tenants: number;
      orgs: number;
      branches: string[];
      routes: string[];
    }>(sql`select (select count(*)::int from tenant) as tenants,
                  (select count(*)::int from organization) as orgs,
                  (select coalesce(array_agg(name order by name), '{}') from branch
                    where archived_at is null) as branches,
                  (select coalesce(array_agg(database_key), '{}') from deployment_route) as routes`),
  );
  return rows[0];
}

async function platformTenantStatus(tenantId: string) {
  const { rows } = await testPlatformDb().withPlatformAdmin(
    { actorId: ADMIN, event: 'clinic.status_changed' },
    (tx) =>
      tx.execute<{ status: string; type: string; idle: number }>(
        sql`select status, type, idle_minutes as idle from tenant where id = ${tenantId}`,
      ),
  );
  return rows;
}

describe('createClinic', () => {
  it('creates tenant, organization, main branch and deployment route together', async () => {
    const tenantId = fixtureId('clinic one');
    const created = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'clinic.created' },
      async (tx, audit) => {
        const clinic = await createClinic(tx, input(tenantId));
        audit.setTarget(clinic.tenantId);
        return clinic;
      },
    );
    expect(created.tenantId).toBe(tenantId);
    expect(MAIN_BRANCH_NAME).toBe('الفرع الرئيسي');
    expect(await tenantView(tenantId)).toEqual({
      tenants: 1,
      orgs: 1,
      branches: [MAIN_BRANCH_NAME],
      routes: ['primary'],
    });
    expect(await platformTenantStatus(tenantId)).toEqual([
      { status: 'trial', type: 'multi_doctor', idle: 30 },
    ]);
  });

  it('generates a tenant id when none is given', async () => {
    const { tenantId } = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'clinic.created' },
      (tx) => createClinic(tx, { name: 'عيادة ثانية', type: 'solo' }),
    );
    expect(tenantId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await tenantView(tenantId))?.orgs).toBe(1);
  });

  it('leaves nothing when the last insert fails (one transaction)', async () => {
    const tenantId = fixtureId('clinic failing');
    await expect(
      testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, (tx) =>
        // An invalid database key fails the deployment route insert, after the other three.
        createClinic(tx, input(tenantId, { databaseKey: 'NOT A KEY' })),
      ),
    ).rejects.toMatchObject({ code: '23514' });
    expect(await tenantView(tenantId)).toEqual({ tenants: 0, orgs: 0, branches: [], routes: [] });
    expect(await platformTenantStatus(tenantId)).toEqual([]);
  });

  it('clears the tenant context it set before returning', async () => {
    const { rows } = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'clinic.created' },
      async (tx) => {
        await createClinic(tx, input(fixtureId('clinic context')));
        return tx.execute<{ t: string | null }>(sql`select current_tenant_id()::text as t`);
      },
    );
    expect(rows[0]?.t).toBeNull();
  });

  it('cannot read the clinic data it just wrote (no SELECT on tenant tables)', async () => {
    await expect(
      testPlatformDb().withPlatformAdmin(
        { actorId: ADMIN, event: 'clinic.created' },
        async (tx) => {
          await createClinic(tx, input(fixtureId('clinic peek')));
          return tx.execute(sql`select name from branch`);
        },
      ),
    ).rejects.toThrow(/permission denied for table branch/);
  });

  it.each([
    ['an unknown type', { type: 'hospital' }],
    ['an empty name', { name: '   ' }],
  ])('refuses %s', async (_what, extra) => {
    await expect(
      testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, (tx) =>
        createClinic(tx, input(fixtureId('clinic bad'), extra as Partial<NewClinic>)),
      ),
    ).rejects.toThrow();
    expect(await platformTenantStatus(fixtureId('clinic bad'))).toEqual([]);
  });

  // createClinic() no longer takes idle minutes (A-02-04: the settings cascade holds them); the
  // column keeps its check until A-02-06 drops it.
  it('refuses an idle time outside 15/30/60 on the tenant row', async () => {
    await expect(
      testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, (tx) =>
        tx.execute(sql`insert into tenant (id, name, type, idle_minutes)
          values (${fixtureId('clinic bad idle')}, 'عيادة تجريبية', 'solo', 45)`),
      ),
    ).rejects.toThrow(/tenant_idle_minutes_check/);
  });
});
