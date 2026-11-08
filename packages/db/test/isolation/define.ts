// Isolation case registry type (0.2-06b). One file per tenant table in ./cases/, listed in
// ./cases/index.ts; isolation.test.ts runs them all and fails for a tenant table without one.
import type { Tx } from '../../src/index.ts';

/** A row a read path returns; it must carry the tenant column so the runner can check it. */
export type TenantRow = Readonly<Record<string, unknown>>;

export interface IsolationCase {
  /** Table name in `public`, as listed in src/schema/classification.ts. */
  readonly table: string;
  /**
   * Inserts at least one row for `tenantId` through `tx`. The runner calls it inside
   * withTenant() as shifa_app (so WITH CHECK is exercised), and once with a foreign tenant to
   * prove the insert is refused.
   */
  seed(tx: Tx, tenantId: string): Promise<void>;
  /**
   * Every read path the application uses on this table, by name. Each returns rows that
   * include `tenant_id` (raw SQL) or `tenantId` (Drizzle select).
   */
  readonly paths: Readonly<Record<string, (tx: Tx) => Promise<readonly TenantRow[]>>>;
}

export function defineIsolationCase(c: IsolationCase): IsolationCase {
  return c;
}
