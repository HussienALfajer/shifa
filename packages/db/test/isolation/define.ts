// Isolation case registry type (0.2-06b). One file per tenant table in ./cases/, listed in
// ./cases/index.ts; isolation.test.ts runs them all and fails for a tenant table without one.
import type { Tx } from '../../src/index.ts';

/** A row a read path returns; it must carry the tenant column so the runner can check it. */
export type TenantRow = Readonly<Record<string, unknown>>;

export interface IsolationCase {
  /** Table name in `public`, as listed in src/schema/classification.ts. */
  readonly table: string;
  /**
   * Inserts at least one row for `tenantId` through `tx`, into `table` only and without
   * RETURNING (a parent row's or the SELECT policy's refusal would hide this table's WITH
   * CHECK). The runner calls it as shifa_app inside withTenant(), then with a foreign tenant
   * inside tenant A and without a tenant context; both must be refused for this table.
   */
  seed(tx: Tx, tenantId: string): Promise<void>;
  /**
   * Every read path the application uses on this table, by name. Each returns rows that
   * include `tenant_id` (raw SQL) or `tenantId` (Drizzle select), and must return some of
   * tenant A's seeded rows (an empty result proves nothing). The runner adds its own
   * unfiltered select, and runs every path without a tenant context too (zero rows expected).
   */
  readonly paths: Readonly<Record<string, (tx: Tx) => Promise<readonly TenantRow[]>>>;
}

export function defineIsolationCase(c: IsolationCase): IsolationCase {
  return c;
}
