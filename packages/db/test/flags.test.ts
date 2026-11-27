// A-02-03 database rules. Flags (criterion 7, OD-114): feature_flag is global; feature_flag_tenant
// holds the clinics a flag is on for, FORCE RLS: shifa_app reads only its own clinic's rows and
// writes neither table; shifa_platform reads every clinic's selections in flag.listed and
// flag.changed only, and writes both tables in flag.changed only. Limits (criterion 4):
// clinicUsageCounts() counts in the clinic's own context what tenant_usage_counts() counts for
// the platform, which now also answers inside an entitlement view or override change.
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clinicUsageCounts,
  type PlatformEvent,
  type PlatformTx,
  tenantUsageCounts,
} from '../src/index.ts';
import {
  branch,
  featureFlag,
  featureFlagTenant,
  membership,
  roleAssignment,
} from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  superuserDb,
  syntheticPhones,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('flags tenant A');
const B = fixtureId('flags tenant B');
const ADMIN = fixtureId('flags admin');
const KEY = 'test.queue';
const su = () => superuserDb(workerDatabaseName());
const code = (err: unknown) => (err as { code?: string }).code;

async function refusal(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (err) {
    return code(err) ?? (err as { cause?: { code?: string } }).cause?.code;
  }
  return undefined;
}

beforeEach(async () => {
  await createTestTenants(A, B);
  await su()
    .insert(featureFlag)
    .values({ key: KEY, mode: 'selected', reason: 'سبب تجريبي للعلم', changedBy: ADMIN });
  await su()
    .insert(featureFlagTenant)
    .values([
      { tenantId: A, flagKey: KEY },
      { tenantId: B, flagKey: KEY },
    ]);
});

const asPlatform = <T>(event: PlatformEvent, fn: (tx: PlatformTx) => Promise<T>): Promise<T> =>
  testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) => fn(tx));
const [PHONE_1 = '', PHONE_2 = ''] = syntheticPhones(2026_12_25, 2);

describe('feature flags', () => {
  it('shifa_app reads every flag and only its own clinic’s selections', async () => {
    const rows = await testDb().withTenant({ tenantId: A, userId: ADMIN }, async (tx) => ({
      flags: (await tx.select().from(featureFlag)).map((f) => f.key),
      selected: (await tx.select().from(featureFlagTenant)).map((r) => r.tenantId),
    }));
    expect(rows).toEqual({ flags: [KEY], selected: [A] });
  });

  it('shifa_app writes neither table', async () => {
    const tx = (fn: Parameters<ReturnType<typeof testDb>['withTenant']>[1]) =>
      testDb().withTenant({ tenantId: A, userId: ADMIN }, fn);
    expect(await refusal(() => tx((t) => t.update(featureFlag).set({ mode: 'on' })))).toBe('42501');
    expect(await refusal(() => tx((t) => t.delete(featureFlagTenant)))).toBe('42501');
  });

  it('shifa_platform reads every clinic’s selections in flag actions only', async () => {
    const count = (event: PlatformEvent) =>
      asPlatform<number>(event, async (tx) => (await tx.select().from(featureFlagTenant)).length);
    expect(await count('flag.listed')).toBe(2);
    expect(await count('flag.changed')).toBe(2);
    expect(await count('clinic.viewed')).toBe(0);
  });

  it('shifa_platform writes flags and selections in flag.changed only', async () => {
    await asPlatform('flag.changed', async (tx) => {
      await tx.update(featureFlag).set({ mode: 'on' });
      await tx.delete(featureFlagTenant).where(sql`tenant_id = ${B}`);
    });
    const left = await su().select().from(featureFlagTenant);
    expect(left.map((r) => r.tenantId)).toEqual([A]);
    for (const event of ['flag.listed', 'clinic.viewed'] as const) {
      const refused = await refusal(() =>
        asPlatform(event, (tx) =>
          tx.insert(featureFlagTenant).values({ tenantId: B, flagKey: KEY }),
        ),
      );
      expect(refused, event).toBe('42501');
    }
    const changed = await asPlatform<number>(
      'clinic.viewed',
      async (tx) => (await tx.update(featureFlag).set({ mode: 'off' }).returning()).length,
    );
    expect(changed).toBe(0);
  });

  it('a selection must name a flag that exists', async () => {
    const refused = await refusal(() =>
      su().insert(featureFlagTenant).values({ tenantId: A, flagKey: 'test.missing' }),
    );
    expect(refused).toBe('23503');
  });
});

describe('use counts (criterion 4)', () => {
  beforeEach(async () => {
    const doctor = fixtureId('flags doctor');
    const gone = fixtureId('flags gone doctor');
    await su()
      .insert(membership)
      .values([
        { id: doctor, tenantId: A, phoneE164: PHONE_1, displayName: 'طبيب' },
        {
          id: gone,
          tenantId: A,
          phoneE164: PHONE_2,
          displayName: 'طبيب',
          status: 'deactivated',
        },
      ]);
    await su()
      .insert(roleAssignment)
      .values([
        { tenantId: A, membershipId: doctor, role: 'doctor' },
        { tenantId: A, membershipId: doctor, role: 'receptionist' },
        { tenantId: A, membershipId: gone, role: 'doctor' },
      ]);
    await su()
      .insert(branch)
      .values([
        { tenantId: A, name: 'فرع' },
        { tenantId: A, name: 'فرع مؤرشف', archivedAt: new Date() },
        { tenantId: B, name: 'فرع آخر' },
      ]);
  });

  it('clinicUsageCounts() counts in the clinic’s own context', async () => {
    const counts = await testDb().withTenant({ tenantId: A, userId: ADMIN }, (tx) =>
      clinicUsageCounts(tx),
    );
    expect(counts).toEqual({ practitioners: 1, branches: 1 });
  });

  it('tenant_usage_counts() answers in an entitlement view and override changes too', async () => {
    for (const event of [
      'entitlement.viewed',
      'entitlement.override_set',
      'entitlement.override_removed',
      'clinic.type_previewed',
    ] as const) {
      const counts = await asPlatform(event, (tx) => tenantUsageCounts(tx, A));
      expect(counts, event).toEqual({ practitioners: 1, branches: 1 });
    }
    expect(await refusal(() => asPlatform('flag.changed', (tx) => tenantUsageCounts(tx, A)))).toBe(
      '42501',
    );
  });
});
