// A-03-05 (spec A-03 criteria 15, 17): the custom field count. tenant_custom_field_count() gives
// shifa_platform one integer (active fields, and archived ones after the cutoff) in the same
// platform actions as tenant_usage_counts(), for one clinic only, and leaves the caller's tenant
// setting as it was; clinicCustomFieldCount() counts the same in the clinic's own context. The
// table refuses a sensitive searchable field and edit roles outside the view roles.
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { clinicCustomFieldCount, tenantCustomFieldCount } from '../src/index.ts';
import { patientField } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  superuserDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('patient-fields tenant A');
const B = fixtureId('patient-fields tenant B');
const ADMIN = fixtureId('patient-fields admin');
const ACTOR = fixtureId('patient-fields actor');
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-28T10:00:00.000Z');
const CUTOFF = new Date(NOW.getTime() - 30 * DAY);
const su = () => superuserDb(workerDatabaseName());
const code = (err: unknown) => (err as { code?: string; cause?: { code?: string } }).code;

const field = (
  tenantId: string,
  n: number,
  extra: Partial<typeof patientField.$inferInsert> = {},
) => ({
  tenantId,
  number: n,
  key: `cf_${String(n)}`,
  label: `حقل ${String(n)}`,
  type: 'text' as const,
  rules: {
    validation: { minLength: null, maxLength: null, min: null, max: null, pattern: null },
    default: null,
  },
  section: 'معلومات إدارية',
  position: n,
  viewRoles: ['owner'],
  editRoles: ['owner'],
  createdBy: ACTOR,
  updatedBy: ACTOR,
  createdAt: new Date(NOW.getTime() - 60 * DAY),
  updatedAt: new Date(NOW.getTime() - 60 * DAY),
  ...extra,
});

beforeEach(async () => {
  await createTestTenants(A, B);
  await su()
    .insert(patientField)
    .values([
      field(A, 1),
      field(A, 2, { state: 'archived', archivedAt: new Date(NOW.getTime() - 29 * DAY) }),
      field(A, 3, { state: 'archived', archivedAt: new Date(NOW.getTime() - 31 * DAY) }),
      field(A, 4, {
        state: 'purged',
        archivedAt: new Date(NOW.getTime() - 40 * DAY),
        purgedAt: new Date(NOW.getTime() - 10 * DAY),
      }),
      field(B, 1),
      field(B, 2),
    ]);
});

describe('tenant_custom_field_count()', () => {
  it('counts the clinic’s active fields and those archived after the cutoff', async () => {
    const count = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'entitlement.viewed' },
      (tx) => tenantCustomFieldCount(tx, A, CUTOFF),
    );
    expect(count).toBe(2);
  });

  it('refuses every action but a type preview or change and an entitlement view or change', async () => {
    for (const event of ['clinic.viewed', 'owner.phone_changed', 'flag.changed'] as const) {
      let refused: string | undefined;
      try {
        await testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) =>
          tenantCustomFieldCount(tx, A, CUTOFF),
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
        await tenantCustomFieldCount(tx, A, CUTOFF);
        const { rows } = await tx.execute<{ t: string }>(
          sql`select coalesce(current_setting('app.tenant_id', true), '') as t`,
        );
        return rows[0]?.t;
      },
    );
    expect(after).toBe('');
  });
});

describe('clinicCustomFieldCount()', () => {
  it('counts the same inside the clinic, and only its own fields', async () => {
    const own = await testDb().withTenant({ tenantId: A, userId: ACTOR }, (tx) =>
      clinicCustomFieldCount(tx, CUTOFF),
    );
    expect(own).toBe(2);
    const theirs = await testDb().withTenant({ tenantId: B, userId: ACTOR }, (tx) =>
      clinicCustomFieldCount(tx, CUTOFF),
    );
    expect(theirs).toBe(2);
  });
});

describe('the table’s checks', () => {
  it('refuses a sensitive searchable field and edit roles outside the view roles', async () => {
    const insert = (extra: Partial<typeof patientField.$inferInsert>) =>
      testDb().withTenant({ tenantId: A, userId: ACTOR }, (tx) =>
        tx.insert(patientField).values(field(A, 9, extra)),
      );
    for (const extra of [
      { sensitive: true, searchable: true },
      { viewRoles: ['owner'], editRoles: ['owner', 'doctor'] },
      { viewRoles: ['platform_admin'], editRoles: [] },
      { key: 'cf_10' },
    ]) {
      let failed: string | undefined;
      try {
        await insert(extra);
      } catch (err) {
        failed = code(err) ?? (err as { cause?: { code?: string } }).cause?.code;
      }
      expect(failed, JSON.stringify(extra)).toBe('23514');
    }
  });
});
