// Security review of A-02-02 (L3–L5): outside an entitlement action shifa_platform reads no
// add-on, override or history row even inside the clinic's context; tenant_usage_counts() runs
// only in a type preview or change, an entitlement view or an override change (A-02-03, `used`)
// and leaves the caller's tenant setting as it was. Which SECURITY DEFINER functions exist and who
// runs them: test/privileges.test.ts (ADR-0051).
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { inTenantContext, type PlatformEvent, tenantUsageCounts } from '../src/index.ts';
import { tenantAddon, tenantOverride, tenantOverrideEvent } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  superuserDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('entitlements-platform tenant A');
const ADMIN = fixtureId('entitlements-platform admin');
const ADDON = fixtureId('entitlements-platform addon');
const su = () => superuserDb(workerDatabaseName());
const code = (err: unknown) => (err as { code?: string }).code;

beforeEach(async () => {
  await createTestTenants(A);
  await su().execute(sql`insert into addon (id, key, mode, value)
    values (${ADDON}, 'limits.branches', 'increment', '1') on conflict do nothing`);
  await su().insert(tenantAddon).values({ tenantId: A, addonId: ADDON });
  await su().insert(tenantOverride).values({
    tenantId: A,
    key: 'limits.branches',
    value: 3,
    reason: 'سبب تجريبي للتجاوز',
    setBy: ADMIN,
  });
  await su()
    .insert(tenantOverrideEvent)
    .values({ tenantId: A, key: 'limits.branches', kind: 'set', by: ADMIN });
});

function readAll(event: PlatformEvent) {
  return testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) =>
    inTenantContext(tx, A, async (sp) => ({
      addons: (await sp.select().from(tenantAddon)).length,
      overrides: (await sp.select().from(tenantOverride)).length,
      events: (await sp.select().from(tenantOverrideEvent)).length,
    })),
  );
}

describe('shifa_platform reads entitlement rows only in entitlement actions', () => {
  it('sees them in entitlement.viewed and nothing in clinic.viewed', async () => {
    expect(await readAll('entitlement.viewed')).toEqual({ addons: 1, overrides: 1, events: 1 });
    expect(await readAll('clinic.viewed')).toEqual({ addons: 0, overrides: 0, events: 0 });
  });
});

describe('tenant_usage_counts()', () => {
  it('refuses every action but a type preview or change and an entitlement view or change', async () => {
    for (const event of ['clinic.viewed', 'owner.phone_changed', 'flag.changed'] as const) {
      let refused: string | undefined;
      try {
        await testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) =>
          tenantUsageCounts(tx, A),
        );
      } catch (err) {
        refused = code(err);
      }
      expect(refused, event).toBe('42501');
    }
  });

  it('restores the caller’s tenant setting', async () => {
    const after = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'clinic.type_previewed' },
      async (tx) => {
        await tenantUsageCounts(tx, A);
        const { rows } = await tx.execute<{ t: string }>(
          sql`select coalesce(current_setting('app.tenant_id', true), '') as t`,
        );
        return rows[0]?.t;
      },
    );
    expect(after).toBe('');
  });
  // Which SECURITY DEFINER functions exist and who runs them: test/privileges.test.ts (ADR-0051).
});
