// Helpers for the A-02-04 tests: a test-only setting the super admin cannot lock, values written
// straight into the cascade tables (superuser), and the audit rows of setting actions.
import { auditEvent, platformSettingValue, type StoredSettingValue, settingValue } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { and, eq, like } from 'drizzle-orm';
import { z } from 'zod';
import type { SettingDefinition } from '../../src/modules/settings/index.ts';

export const NOT_LOCKABLE = 'test.not_lockable';

/** Added to the production catalogue by these tests (never in src/). */
export const TEST_SETTINGS: readonly SettingDefinition[] = [
  {
    key: NOT_LOCKABLE,
    description: 'test-only setting the super admin cannot lock',
    schema: z.enum(['quiet', 'loud']),
    defaultValue: 'quiet',
    overridableBy: ['organization'],
    lockable: false,
    sensitivity: 'normal',
  },
];

const su = () => superuserDb(workerDatabaseName());

/** The clinic's organization value of `key`, as the owner or the backfill writes it. */
export async function setOrganizationValue(
  tenantId: string,
  key: string,
  value: StoredSettingValue,
  locked = false,
): Promise<void> {
  await su()
    .insert(settingValue)
    .values({ tenantId, scope: 'organization', key, value, locked })
    .onConflictDoUpdate({
      target: [settingValue.tenantId, settingValue.scope, settingValue.scopeId, settingValue.key],
      set: { value, locked },
    });
}

/** A value for every clinic (`platform`) or one plan (`plan`), as a migration would write it. */
export async function setPlatformValue(
  key: string,
  value: StoredSettingValue,
  {
    planType = null,
    locked = false,
  }: { planType?: 'solo' | 'multi_doctor' | 'multi_branch' | null; locked?: boolean } = {},
): Promise<void> {
  await su()
    .insert(platformSettingValue)
    .values({ scope: planType ? 'plan' : 'platform', planType, key, value, locked });
}

export async function clearPlatformValues(): Promise<void> {
  await su().delete(platformSettingValue);
}

/** The clinic's stored values (superuser). */
export function storedValues(tenantId: string) {
  return su().select().from(settingValue).where(eq(settingValue.tenantId, tenantId));
}

/** Audit rows of `event` (`setting.%` for all setting actions) about `targetId`, oldest first. */
export function settingAuditRows(event: string, targetId: string) {
  return su()
    .select()
    .from(auditEvent)
    .where(and(like(auditEvent.event, event), eq(auditEvent.targetId, targetId)))
    .orderBy(auditEvent.at);
}
