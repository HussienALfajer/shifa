// Isolation cases of the A-02-02 tenant tables. All three are read-only for shifa_app
// (classification access 'read-only'): the runner seeds them as the owner inside each tenant's
// context and expects every shifa_app write refused by privileges.
import { eq, sql } from 'drizzle-orm';
import { tenantAddon, tenantOverride, tenantOverrideEvent } from '../../../src/index.ts';
import { fixtureId, superuserDb, workerDatabaseName } from '../../../test-harness/index.ts';
import { defineIsolationCase } from '../define.ts';

const ADMIN = fixtureId('isolation super admin');
const ADDON = fixtureId('isolation addon');

export const tenantOverrideCase = defineIsolationCase({
  table: 'tenant_override',
  seed: async (tx, tenantId) => {
    await tx.insert(tenantOverride).values({
      tenantId,
      key: 'limits.practitioners',
      value: 15,
      reason: 'سبب تجريبي للتجاوز',
      setBy: ADMIN,
    });
  },
  paths: {
    'all overrides': (tx) => tx.select().from(tenantOverride),
    'by key': (tx) =>
      tx.select().from(tenantOverride).where(eq(tenantOverride.key, 'limits.practitioners')),
  },
});

export const tenantOverrideEventCase = defineIsolationCase({
  table: 'tenant_override_event',
  seed: async (tx, tenantId) => {
    await tx.insert(tenantOverrideEvent).values({
      tenantId,
      key: 'limits.branches',
      kind: 'set',
      after: { value: 2, expiresAt: null },
      reason: 'سبب تجريبي للتجاوز',
      by: ADMIN,
    });
  },
  paths: {
    'history of a key': (tx) =>
      tx
        .select()
        .from(tenantOverrideEvent)
        .where(eq(tenantOverrideEvent.key, 'limits.branches'))
        .orderBy(tenantOverrideEvent.at),
  },
});

export const tenantAddonCase = defineIsolationCase({
  table: 'tenant_addon',
  // The add-on itself is a global row only migrations write (no policy lets a role insert it, so
  // the test writes it as the superuser).
  prepare: async () => {
    await superuserDb(workerDatabaseName()).execute(sql`insert into addon (id, key, mode, value)
      values (${ADDON}, 'limits.branches', 'increment', '1') on conflict do nothing`);
  },
  seed: async (tx, tenantId) => {
    await tx.insert(tenantAddon).values({ tenantId, addonId: ADDON });
  },
  paths: {
    'add-ons of the clinic': (tx) => tx.select().from(tenantAddon),
  },
});
