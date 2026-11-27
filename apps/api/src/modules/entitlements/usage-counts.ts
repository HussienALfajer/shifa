// What a clinic uses of each limit (A-02 criterion 4): the one place the counts are read, for the
// type preview here and for limit enforcement in A-02-03. Integers only (tenant_usage_counts()).
import { type PlatformTx, tenantUsageCounts } from '@shifa/db';

/** Use per limit key; `limits.custom_fields` counts nothing until A-03 adds custom fields. */
export async function usageOf(tx: PlatformTx, tenantId: string): Promise<Record<string, number>> {
  const counts = await tenantUsageCounts(tx, tenantId);
  return {
    'limits.practitioners': counts.practitioners,
    'limits.branches': counts.branches,
    'limits.custom_fields': 0,
  };
}
