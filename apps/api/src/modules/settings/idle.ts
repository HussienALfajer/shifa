// The idle sign-out through the cascade (A-02 criterion 10): what identity reads for each session's
// idle limit, per request, with no cache (the owner's change applies on the next request). In the
// clinic's own context (shifa_app) and for the person's own clinics on the auth path (shifa_auth,
// which may read this one key only). Production's definition always: tests add keys, never change
// this one.
import { type TenantType, type Tx, tenant } from '@shifa/db';
import { IDLE_MINUTES_KEY, PRODUCTION_SETTINGS, type SettingDefinition } from './catalogue.ts';
import { type Resolution, resolveSetting } from './resolve.ts';
import { platformRows, type SettingContext, scopedValues, tenantRows } from './sources.ts';

const IDLE: SettingDefinition = (() => {
  const definition = PRODUCTION_SETTINGS.find((d) => d.key === IDLE_MINUTES_KEY);
  if (!definition) throw new Error('the idle sign-out is not declared');
  return definition;
})();

/** The idle setting of the clinic `tx` is inside (shifa_app, withTenant()). */
export async function idleSettingInClinic(tx: Tx, context: SettingContext): Promise<Resolution> {
  const [platform, own] = [
    await platformRows(tx, IDLE_MINUTES_KEY),
    await tenantRows(tx, IDLE_MINUTES_KEY),
  ];
  return resolveSetting(IDLE, scopedValues(IDLE_MINUTES_KEY, platform, own, context));
}

/** The idle minutes of the clinic `tx` is inside, for a session there. */
export async function idleMinutesInClinic(tx: Tx, planType: TenantType): Promise<number> {
  return Number((await idleSettingInClinic(tx, { planType })).value);
}

/**
 * The idle minutes of every clinic the signed-in person belongs to (shifa_auth, withUser()): the
 * tenants they are a member of and those tenants' organization values of the idle key.
 */
export async function idleMinutesOfOwnClinics(tx: Tx): Promise<Map<string, number>> {
  const clinics = await tx.select({ id: tenant.id, type: tenant.type }).from(tenant);
  const platform = await platformRows(tx, IDLE_MINUTES_KEY);
  const own = await tenantRows(tx, IDLE_MINUTES_KEY);
  return new Map(
    clinics.map((c) => {
      const values = scopedValues(
        IDLE_MINUTES_KEY,
        platform,
        own.filter((r) => r.tenantId === c.id),
        { planType: c.type },
      );
      return [c.id, Number(resolveSetting(IDLE, values).value)];
    }),
  );
}
