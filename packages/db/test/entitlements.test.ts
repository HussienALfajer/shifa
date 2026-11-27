// A-02 criteria 1–3 (slice A-02-02): the plan tables are seeded (one plan per clinic type with the
// limit defaults) and survive a test reset; shifa_app reads them and its own overrides but writes
// none of them; shifa_platform writes overrides and their history only in their own platform
// events, and reads use counts only through tenant_usage_counts() (integers, never rows);
// entitlementKeysInUse() lists the keys plans and add-ons hold, for the start-up check.
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  entitlementKeysInUse,
  inTenantContext,
  type PlatformEvent,
  type PlatformTx,
  type Tx,
  tenantUsageCounts,
} from '../src/index.ts';
import {
  addon,
  branch,
  membership,
  plan,
  planFeature,
  type Role,
  roleAssignment,
  tenantAddon,
  tenantOverride,
  tenantOverrideEvent,
} from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  ownerDb,
  resetTestDb,
  superuserDb,
  syntheticPhones,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('entitlements tenant A');
const B = fixtureId('entitlements tenant B');
const ADMIN = fixtureId('entitlements admin');
const USER = fixtureId('entitlements user');
const code = (err: unknown) => (err as { code?: string }).code;
const su = () => superuserDb(workerDatabaseName());
const phones = syntheticPhones(7812, 6);

function asPlatform<T>(event: PlatformEvent, fn: (tx: PlatformTx) => Promise<T>): Promise<T> {
  return testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, fn);
}

const overrideRow = (tenantId: string, value = 15) => ({
  tenantId,
  key: 'limits.practitioners',
  value,
  reason: 'سبب تجريبي للتجاوز',
  setBy: ADMIN,
});

async function refused(work: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await work();
  } catch (err) {
    return code(err);
  }
  return 'not refused';
}

beforeEach(async () => {
  await createTestTenants(A, B);
});

describe('plan seeds (criterion 1)', () => {
  it('holds one plan per clinic type with the limit defaults, kept through a reset', async () => {
    await resetTestDb();
    expect((await su().select().from(plan)).map((p) => p.type).sort()).toEqual([
      'multi_branch',
      'multi_doctor',
      'solo',
    ]);
    const rows = await su().select().from(planFeature);
    const value = (type: string, key: string) =>
      rows.find((r) => r.planType === type && r.key === key)?.value;
    expect(
      ['solo', 'multi_doctor', 'multi_branch'].map((t) => [
        value(t, 'limits.practitioners'),
        value(t, 'limits.branches'),
        value(t, 'limits.custom_fields'),
      ]),
    ).toEqual([
      [1, 1, 20],
      [10, 1, 20],
      [30, 5, 20],
    ]);
    expect(await su().select().from(addon)).toEqual([]);
  });

  it('entitlementKeysInUse() lists the keys of plans and add-ons', async () => {
    expect((await entitlementKeysInUse(testDb())).sort()).toEqual([
      'limits.branches',
      'limits.custom_fields',
      'limits.practitioners',
    ]);
  });
});

describe('shifa_app (read only)', () => {
  it('reads the plan tables and its own overrides, never another clinic’s', async () => {
    await asPlatform('entitlement.override_set', (tx) =>
      inTenantContext(tx, A, (t) => t.insert(tenantOverride).values(overrideRow(A))),
    );
    await asPlatform('entitlement.override_set', (tx) =>
      inTenantContext(tx, B, (t) => t.insert(tenantOverride).values(overrideRow(B, 3))),
    );
    const seen = await testDb().withTenant({ tenantId: A, userId: USER }, async (tx) => ({
      plans: (await tx.select().from(planFeature)).length,
      overrides: await tx.select().from(tenantOverride),
    }));
    expect(seen.plans).toBe(9);
    expect(seen.overrides).toMatchObject([{ tenantId: A, value: 15 }]);
  });

  it('writes none of the plan tables, overrides, add-ons or override history', async () => {
    const inA = (fn: (tx: Tx) => Promise<unknown>) => () =>
      testDb().withTenant({ tenantId: A, userId: USER }, fn);
    const attempts = {
      plan: inA((tx) => tx.insert(plan).values({ type: 'solo' })),
      planFeature: inA((tx) =>
        tx.update(planFeature).set({ value: 99 }).where(eq(planFeature.key, 'limits.branches')),
      ),
      addon: inA((tx) =>
        tx.insert(addon).values({ key: 'limits.branches', mode: 'increment', value: 1 }),
      ),
      tenantAddon: inA((tx) =>
        tx.insert(tenantAddon).values({ tenantId: A, addonId: randomUUID() }),
      ),
      tenantOverride: inA((tx) => tx.insert(tenantOverride).values(overrideRow(A))),
      tenantOverrideEvent: inA((tx) =>
        tx.insert(tenantOverrideEvent).values({
          tenantId: A,
          key: 'limits.branches',
          kind: 'set',
          by: ADMIN,
        }),
      ),
    };
    for (const [name, attempt] of Object.entries(attempts)) {
      expect(await refused(attempt), name).toBe('42501');
    }
  });
});

describe('shifa_platform', () => {
  it('writes overrides only in an override event, inside the clinic’s tenant', async () => {
    // Outside the override events (here: a clinic view), the restrictive policies refuse it.
    expect(
      await refused(() =>
        asPlatform('clinic.viewed', (tx) =>
          inTenantContext(tx, A, (t) => t.insert(tenantOverride).values(overrideRow(A))),
        ),
      ),
    ).toBe('42501');
    // Without the tenant context, the isolation policy refuses it.
    expect(
      await refused(() =>
        asPlatform('entitlement.override_set', (tx) =>
          tx.insert(tenantOverride).values(overrideRow(A)),
        ),
      ),
    ).toBe('42501');
    // A history row only in the events that change a key.
    expect(
      await refused(() =>
        asPlatform('entitlement.viewed', (tx) =>
          inTenantContext(tx, A, (t) =>
            t
              .insert(tenantOverrideEvent)
              .values({ tenantId: A, key: 'limits.branches', kind: 'set', by: ADMIN }),
          ),
        ),
      ),
    ).toBe('42501');
  });

  it('never updates or deletes override history (append-only)', async () => {
    await asPlatform('entitlement.override_set', (tx) =>
      inTenantContext(tx, A, (t) =>
        t
          .insert(tenantOverrideEvent)
          .values({ tenantId: A, key: 'limits.branches', kind: 'set', by: ADMIN }),
      ),
    );
    for (const event of ['entitlement.override_set', 'entitlement.override_removed'] as const) {
      expect(
        await refused(() =>
          asPlatform(event, (tx) => inTenantContext(tx, A, (t) => t.delete(tenantOverrideEvent))),
        ),
      ).toBe('42501');
    }
  });

  it('reads use counts as integers: non-deactivated doctors and non-archived branches', async () => {
    await testDb().withTenant({ tenantId: A, userId: USER }, async (tx) => {
      // tenant A has no main branch here: one open branch, one archived.
      await tx.insert(branch).values({ tenantId: A, name: 'فرع مفتوح' });
      await tx.insert(branch).values({ tenantId: A, name: 'فرع مؤرشف', archivedAt: new Date() });
      const members: [Role, 'pending' | 'deactivated'][] = [
        ['doctor', 'pending'],
        ['doctor', 'pending'],
        ['doctor', 'deactivated'],
        // A receptionist is no doctor.
        ['receptionist', 'pending'],
      ];
      for (const [i, [role, status]] of members.entries()) {
        const id = randomUUID();
        // A new member starts pending (A-01 policy); deactivation is a later update.
        await tx.insert(membership).values({
          id,
          tenantId: A,
          phoneE164: phones[i] ?? '',
          displayName: 'موظف تجريبي',
        });
        if (status === 'deactivated') {
          await tx.update(membership).set({ status }).where(eq(membership.id, id));
        }
        await tx.insert(roleAssignment).values({ tenantId: A, membershipId: id, role });
      }
    });
    expect(await asPlatform('clinic.type_previewed', (tx) => tenantUsageCounts(tx, A))).toEqual({
      practitioners: 2,
      branches: 1,
    });
    expect(await asPlatform('clinic.type_previewed', (tx) => tenantUsageCounts(tx, B))).toEqual({
      practitioners: 0,
      branches: 0,
    });
  });

  it('tenant_usage_counts() is for shifa_platform alone, inside a platform action', async () => {
    const execute = (role: string) =>
      ownerDb().execute<{ ok: boolean }>(
        sql`select has_function_privilege(${role}, 'public.tenant_usage_counts(uuid)', 'EXECUTE') as ok`,
      );
    expect((await execute('shifa_app')).rows[0]?.ok).toBe(false);
    expect((await execute('shifa_auth')).rows[0]?.ok).toBe(false);
    expect((await execute('shifa_platform')).rows[0]?.ok).toBe(true);
  });
});
