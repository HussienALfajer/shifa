// Entitlement helpers (A-02-02): a clinic's use counts on the platform path and in the clinic's
// own context (A-02-03), and the keys plans
// and add-ons hold, for the API's start-up check against its catalogue.
import { sql } from 'drizzle-orm';
import { type ShifaDb, withoutContext } from './client.ts';
import { assertUuid } from './context.ts';
import type { PlatformTx } from './platform.ts';
import type { Tx } from './transaction.ts';

export interface UsageCounts {
  /** Non-deactivated members holding a doctor role (pending included). */
  practitioners: number;
  /** Non-archived branches. */
  branches: number;
}

/**
 * The clinic's use counts, as integers only (tenant_usage_counts(), SECURITY DEFINER): the platform
 * role reads no member or branch row.
 */
export async function tenantUsageCounts(tx: PlatformTx, tenantId: string): Promise<UsageCounts> {
  assertUuid('tenantId', tenantId);
  const { rows } = await tx.execute<{ practitioners: number; branches: number }>(
    sql`select practitioners, branches from tenant_usage_counts(${tenantId}::uuid)`,
  );
  const row = rows[0];
  return { practitioners: row?.practitioners ?? 0, branches: row?.branches ?? 0 };
}

/**
 * The same counts in the clinic's own context (shifa_app inside withTenant(), A-02-03): what the
 * limits are checked against in a write and what capabilities show. RLS keeps it to the clinic;
 * the rule is tenant_usage_counts()'s, kept beside it here.
 */
export async function clinicUsageCounts(tx: Tx): Promise<UsageCounts> {
  const { rows } = await tx.execute<{ practitioners: number; branches: number }>(sql`
    select
      (select count(distinct m.id)::integer
         from membership m
         join role_assignment ra on ra.tenant_id = m.tenant_id and ra.membership_id = m.id
        where m.tenant_id = current_tenant_id() and ra.role = 'doctor'
          and m.status <> 'deactivated') as practitioners,
      (select count(*)::integer from branch b
        where b.tenant_id = current_tenant_id() and b.archived_at is null) as branches`);
  const row = rows[0];
  return { practitioners: row?.practitioners ?? 0, branches: row?.branches ?? 0 };
}

/** Every key the plans and add-ons hold (global tables, read with no context set). */
export async function entitlementKeysInUse(db: ShifaDb): Promise<string[]> {
  const { rows } = await withoutContext(db, (tx) =>
    tx.execute<{ key: string }>(
      sql`select key from plan_feature union select key from addon order by 1`,
    ),
  );
  return rows.map((r) => r.key);
}
