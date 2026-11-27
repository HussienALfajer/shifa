// Isolation case of feature_flag_tenant (A-02-03): the clinics a flag is on for. Read-only for
// shifa_app (classification access 'read-only'): the runner seeds it as the owner inside each
// tenant's context and expects every shifa_app write refused by privileges. The flag row itself
// is global and written by the superuser here (only shifa_platform writes it in the product).
import { eq, sql } from 'drizzle-orm';
import { featureFlagTenant } from '../../../src/index.ts';
import { superuserDb, workerDatabaseName } from '../../../test-harness/index.ts';
import { defineIsolationCase } from '../define.ts';

const KEY = 'test.isolation_flag';

export const featureFlagTenantCase = defineIsolationCase({
  table: 'feature_flag_tenant',
  prepare: async () => {
    await superuserDb(workerDatabaseName()).execute(sql`insert into feature_flag
      (key, mode, reason, changed_by) values (${KEY}, 'selected', 'سبب تجريبي للعلم',
      '00000000-0000-4000-8000-0000000000f1') on conflict do nothing`);
  },
  seed: async (tx, tenantId) => {
    await tx.insert(featureFlagTenant).values({ tenantId, flagKey: KEY });
  },
  paths: {
    'flags selected for the clinic': (tx) => tx.select().from(featureFlagTenant),
    'one flag': (tx) =>
      tx.select().from(featureFlagTenant).where(eq(featureFlagTenant.flagKey, KEY)),
  },
});
