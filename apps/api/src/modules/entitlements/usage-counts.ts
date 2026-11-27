// What a clinic uses of each limit (A-02 criterion 4): the one place the counts are read, on both
// paths: the platform's (integers only, tenant_usage_counts()) for the type preview and the
// entitlement view, and the clinic's own (clinicUsageCounts()) for limit enforcement and
// capabilities (A-02-03). Both count the same rule: non-deactivated members holding a doctor role
// (pending included) and non-archived branches.
import { clinicUsageCounts, type PlatformTx, type Tx, tenantUsageCounts } from '@shifa/db';

/** Use per counted limit key; a key missing here is not counted yet (custom fields, A-03). */
export type Usage = Readonly<Partial<Record<string, number>>>;

function byKey(counts: { practitioners: number; branches: number }): Usage {
  return { 'limits.practitioners': counts.practitioners, 'limits.branches': counts.branches };
}

/** On the platform path, for the clinic `tenantId`. */
export async function usageOf(tx: PlatformTx, tenantId: string): Promise<Usage> {
  return byKey(await tenantUsageCounts(tx, tenantId));
}

/** In the clinic's own context (a TenantDb transaction). */
export async function usageInClinic(tx: Tx): Promise<Usage> {
  return byKey(await clinicUsageCounts(tx));
}
