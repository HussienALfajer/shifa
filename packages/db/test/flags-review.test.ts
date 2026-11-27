// Review of A-02-03 (N3): with a clinic's tenant context set, shifa_platform still deletes that
// clinic's flag selections only in a flag.changed action; flag.listed and other actions delete
// nothing (a DELETE has no WITH CHECK, so a restrictive DELETE policy guards it).
import { beforeEach, describe, expect, it } from 'vitest';
import { inTenantContext, type PlatformEvent } from '../src/index.ts';
import { featureFlag, featureFlagTenant } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  superuserDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('flags-review tenant A');
const ADMIN = fixtureId('flags-review admin');
const KEY = 'test.review_flag';
const su = () => superuserDb(workerDatabaseName());

beforeEach(async () => {
  await createTestTenants(A);
  await su()
    .insert(featureFlag)
    .values({ key: KEY, mode: 'selected', reason: 'سبب تجريبي للعلم', changedBy: ADMIN });
  await su().insert(featureFlagTenant).values({ tenantId: A, flagKey: KEY });
});

function deleteInTenant(event: PlatformEvent): Promise<number> {
  return testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) =>
    inTenantContext(tx, A, async (sp) => (await sp.delete(featureFlagTenant).returning()).length),
  );
}

describe('feature_flag_tenant deletes by shifa_platform', () => {
  it('delete nothing outside flag.changed, even inside the clinic’s context', async () => {
    for (const event of ['flag.listed', 'clinic.viewed', 'entitlement.viewed'] as const) {
      expect(await deleteInTenant(event), event).toBe(0);
    }
    expect(await su().select().from(featureFlagTenant)).toHaveLength(1);
  });

  it('delete the selection in flag.changed', async () => {
    expect(await deleteInTenant('flag.changed')).toBe(1);
  });
});
