// Isolation case registry type (0.2-06b). One file per tenant table in ./cases/, listed in
// ./cases/index.ts; isolation.test.ts runs them all and fails for a tenant table without one.
import type { Tx } from '../../src/index.ts';

/** A row a read path returns; it must carry the tenant column so the runner can check it. */
export type TenantRow = Readonly<Record<string, unknown>>;

/** What prepare() may use to write parent rows for tenants A and B. */
export interface PrepareContext {
  /** Tenants A and B; their `tenant` rows already exist. */
  readonly tenants: readonly [string, string];
  /** Runs `fn` as shifa_app inside withTenant() for `tenantId`. */
  inTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface IsolationCase {
  /** Table name in `public`, as listed in src/schema/classification.ts. */
  readonly table: string;
  /**
   * Writes the parent rows the seed needs (A-01b criterion 1), once per case before the first
   * seed. The runner has emptied the database and created the `tenant` rows of A and B.
   */
  readonly prepare?: ((ctx: PrepareContext) => Promise<void>) | undefined;
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
  /**
   * For a table shifa_app may UPDATE by column only (no UPDATE on `tenant_id`, A-01-04): a
   * column it may set and a constant for it. Moving rows to tenant B must then be refused by
   * privileges, and the update-without-WHERE check sets this column instead of `tenant_id`.
   */
  readonly updatable?: { readonly column: string; readonly value: string } | undefined;
  /**
   * For a read-write table where shifa_app holds no INSERT or no DELETE privilege at all (A-02-05:
   * support grants are opened by the platform; the clinic only ends one by column UPDATE): those
   * writes must be refused by privileges, and with `insert` listed the runner seeds as the owner
   * inside each tenant's context, as for a read-only table.
   */
  readonly withoutPrivilege?: readonly ('insert' | 'delete')[] | undefined;
  /**
   * The runner's update without WHERE (setting `updatable`) must be refused by a restrictive
   * policy of this table (A-02-05: an open grant changes only into a full owner's end), instead of
   * succeeding on tenant A's rows. Tenant B's rows must stay unchanged either way.
   */
  readonly updateRefused?: boolean | undefined;
  /**
   * Inserts with tenant A's own tenant_id that a restrictive policy of this table must refuse
   * (SQLSTATE 42501 naming the table), by name; each runs inside tenant A (A-01-05: a membership
   * already bound to an account).
   */
  readonly refusedInserts?:
    | Readonly<Record<string, (tx: Tx, tenantId: string) => Promise<void>>>
    | undefined;
}

export function defineIsolationCase(c: IsolationCase): IsolationCase {
  return c;
}
