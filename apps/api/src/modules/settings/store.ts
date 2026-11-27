// Shared steps of the setting writes (A-02 criteria 8, 9): one clinic's writes of one key run one
// at a time (a transaction advisory lock taken by the owner's change and by the super admin's lock
// and unlock alike, so each decides on the values the previous one left), and the views of a key.
import type { SettingView } from '@shifa/contracts';
import { type Tx, tenant } from '@shifa/db';
import { eq, sql } from 'drizzle-orm';
import type { SettingCatalogue, SettingDefinition } from './catalogue.ts';
import { type Resolution, resolveSetting, type ScopedValue } from './resolve.ts';

/** Serialises the writes of `key` in clinic `tenantId` until `tx` ends (safe behind PgBouncer). */
export async function lockSettingWrites(tx: Tx, tenantId: string, key: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`shifa.settings:${tenantId}:${key}`}, 0))`,
  );
}

const ABOVE_CLINIC: readonly ScopedValue['scope'][] = ['platform', 'plan', 'specialty_pack'];

/** A lock above the clinic (platform or plan): the super admin cannot lock it per clinic. */
export function lockedAboveClinic(
  definition: SettingDefinition,
  values: readonly ScopedValue[],
): boolean {
  return resolveSetting(
    definition,
    values.filter((v) => ABOVE_CLINIC.includes(v.scope)),
  ).locked;
}

/** The admin view of one key (contract row `set`). */
export function settingView(
  catalogue: SettingCatalogue,
  definition: SettingDefinition,
  values: readonly ScopedValue[],
): SettingView {
  const resolved: Resolution = resolveSetting(definition, values);
  return {
    key: definition.key,
    value: resolved.value,
    source: resolved.source,
    locked: resolved.locked,
    lockedBy: resolved.lockedBy,
    lockable: definition.lockable && !lockedAboveClinic(definition, values),
    choices: catalogue.choices(definition.key),
  };
}

const AUDIT_VALUE = /^[a-z0-9_.-]{0,36}$/;

/** A value as audit data: short text, or null (sensitive, or not a short word or number). */
export function auditValue(definition: SettingDefinition, value: unknown): string | null {
  if (definition.sensitivity === 'sensitive') return null;
  if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') {
    return null;
  }
  const text = String(value);
  return AUDIT_VALUE.test(text) ? text : null;
}

/** The clinic's type (its plan), read in the caller's transaction; undefined when none. */
export async function clinicPlan(tx: Tx, tenantId: string) {
  const [row] = await tx.select({ type: tenant.type }).from(tenant).where(eq(tenant.id, tenantId));
  return row?.type;
}
