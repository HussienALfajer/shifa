// Reading what a clinic holds (plan values, add-ons, overrides) for resolution, on either path:
// as the clinic (shifa_app, inside the guard's scope) or as the platform inside the clinic's
// tenant context. RLS keeps both to the one clinic. Resolution reads an override's key, value and
// expiry only: its reason and author are for super admins (security review L2).
import {
  addon,
  planFeature,
  type TenantType,
  type Tx,
  tenantAddon,
  tenantOverride,
} from '@shifa/db';
import { eq } from 'drizzle-orm';
import type { EntitlementSources } from './resolve.ts';

export function planValues(tx: Tx, type: TenantType) {
  return tx
    .select({ key: planFeature.key, value: planFeature.value })
    .from(planFeature)
    .where(eq(planFeature.planType, type));
}

/** Every override of the clinic, all columns (the super admin's view). */
export function overrideRows(tx: Tx) {
  return tx.select().from(tenantOverride);
}

/** The plan of `type` and the clinic's add-ons and overrides (inside the clinic's context). */
export async function loadSources(tx: Tx, type: TenantType): Promise<EntitlementSources> {
  const plan = await planValues(tx, type);
  const addons = await tx
    .select({ key: addon.key, mode: addon.mode, value: addon.value })
    .from(tenantAddon)
    .innerJoin(addon, eq(addon.id, tenantAddon.addonId));
  const overrides = await tx
    .select({
      key: tenantOverride.key,
      value: tenantOverride.value,
      expiresAt: tenantOverride.expiresAt,
    })
    .from(tenantOverride);
  return {
    planValues: Object.fromEntries(plan.map((p) => [p.key, p.value])),
    addons,
    overrides,
  };
}
