// What a clinic uses of each limit (A-02 criterion 4): the one place the counts are read, on both
// paths: the platform's (integers only, tenant_usage_counts() and tenant_custom_field_count()) for
// the type preview and the entitlement view, and the clinic's own (clinicUsageCounts(),
// clinicCustomFieldCount()) for limit enforcement and capabilities (A-02-03). Both count the same
// rules: non-deactivated members holding a doctor role (pending included), non-archived branches,
// and (A-03-05, spec A-03 criterion 15) custom fields that are active or archived within 30 days
// of `now` (the API's clock).
import {
  clinicCustomFieldCount,
  clinicUsageCounts,
  type PlatformTx,
  type Tx,
  tenantCustomFieldCount,
  tenantUsageCounts,
} from '@shifa/db';

/** Use per counted limit key; a key missing here is not counted. */
export type Usage = Readonly<Partial<Record<string, number>>>;

/** Days an archived custom field still counts (and can be restored) before it is purged. */
export const CUSTOM_FIELD_PURGE_DAYS = 30;

/** The archive time after which a field still counts at `now`. */
export function customFieldCutoff(now: Date): Date {
  return new Date(now.getTime() - CUSTOM_FIELD_PURGE_DAYS * 24 * 60 * 60 * 1000);
}

function byKey(counts: { practitioners: number; branches: number }, customFields: number): Usage {
  return {
    'limits.practitioners': counts.practitioners,
    'limits.branches': counts.branches,
    'limits.custom_fields': customFields,
  };
}

/** On the platform path, for the clinic `tenantId`. */
export async function usageOf(tx: PlatformTx, tenantId: string, now: Date): Promise<Usage> {
  return byKey(
    await tenantUsageCounts(tx, tenantId),
    await tenantCustomFieldCount(tx, tenantId, customFieldCutoff(now)),
  );
}

/** In the clinic's own context (a TenantDb transaction). */
export async function usageInClinic(tx: Tx, now: Date): Promise<Usage> {
  return byKey(
    await clinicUsageCounts(tx),
    await clinicCustomFieldCount(tx, customFieldCutoff(now)),
  );
}
