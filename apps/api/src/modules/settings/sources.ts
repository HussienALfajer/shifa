// Loading the stored values that apply to a clinic (A-02 criterion 8): the platform's and the
// clinic's plan's (platform_setting_value, global) and the clinic's own (setting_value, RLS). Each
// reader runs in the caller's transaction: shifa_app inside the clinic, shifa_platform inside its
// tenant context, or shifa_auth for the person's own clinics (the idle key only, by policy). Only
// the columns every one of those roles may read are selected.
import {
  platformSettingValue,
  type StoredSettingValue,
  settingValue,
  type TenantSettingScope,
  type TenantType,
  type Tx,
} from '@shifa/db';
import { eq } from 'drizzle-orm';
import type { ScopedValue } from './resolve.ts';

export interface PlatformRow {
  scope: 'platform' | 'plan';
  planType: TenantType | null;
  key: string;
  value: StoredSettingValue;
  locked: boolean;
}

export interface TenantRow {
  tenantId: string;
  scope: TenantSettingScope;
  scopeId: string | null;
  key: string;
  value: StoredSettingValue;
  locked: boolean;
}

/** Where in the clinic a value is resolved: the organization, or below it. */
export interface SettingContext {
  planType: TenantType;
  branchId?: string | null;
  membershipId?: string | null;
  userId?: string | null;
}

export function platformRows(tx: Tx, key?: string): Promise<PlatformRow[]> {
  const query = tx
    .select({
      scope: platformSettingValue.scope,
      planType: platformSettingValue.planType,
      key: platformSettingValue.key,
      value: platformSettingValue.value,
      locked: platformSettingValue.locked,
    })
    .from(platformSettingValue);
  return key === undefined ? query : query.where(eq(platformSettingValue.key, key));
}

/** The clinic's own values (the caller's context holds it to one clinic, or a filter does). */
export function tenantRows(tx: Tx, key?: string): Promise<TenantRow[]> {
  const query = tx
    .select({
      tenantId: settingValue.tenantId,
      scope: settingValue.scope,
      scopeId: settingValue.scopeId,
      key: settingValue.key,
      value: settingValue.value,
      locked: settingValue.locked,
    })
    .from(settingValue);
  return key === undefined ? query : query.where(eq(settingValue.key, key));
}

/** The values of `key` that apply in `context`, one per scope. */
export function scopedValues(
  key: string,
  platform: readonly PlatformRow[],
  own: readonly TenantRow[],
  context: SettingContext,
): ScopedValue[] {
  const values: ScopedValue[] = [];
  const add = (
    scope: ScopedValue['scope'],
    row: { value: unknown; locked: boolean } | undefined,
  ) => {
    if (row) values.push({ scope, value: row.value, locked: row.locked });
  };
  const ofKey = platform.filter((r) => r.key === key);
  add(
    'platform',
    ofKey.find((r) => r.scope === 'platform'),
  );
  add(
    'plan',
    ofKey.find((r) => r.scope === 'plan' && r.planType === context.planType),
  );
  // specialty_pack: no source until A-11.
  const mine = own.filter((r) => r.key === key);
  const at = (scope: TenantSettingScope, id: string | null | undefined) =>
    scope === 'organization'
      ? mine.find((r) => r.scope === scope)
      : id
        ? mine.find((r) => r.scope === scope && r.scopeId === id)
        : undefined;
  add('organization', at('organization', null));
  add('branch', at('branch', context.branchId));
  add('practitioner', at('practitioner', context.membershipId));
  add('user', at('user', context.userId));
  return values;
}
