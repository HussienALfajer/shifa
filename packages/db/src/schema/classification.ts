// Every table in the `public` schema, listed exactly once (0.2-06b, ADR-0004). The RLS
// presence test (test/architecture/rls-presence.test.ts) fails for a table missing here, for a
// tenant table without tenant_id / ENABLE + FORCE RLS / policies on current_tenant_id(), and the
// isolation suite (test/isolation/) fails for a tenant table without an isolation case.
//
// - tenant: holds one tenant's rows; RLS required (`/rls-policy`).
// - global: no tenant data at all (e.g. `tenant_deployment` later); give the reason.
// - system: infrastructure the application never queries for tenant data; give the reason.
//
// Drizzle's migration history lives in the `drizzle` schema, outside this list. Test-only probe
// tables are never listed here: tests pass their own classification to the checks.

export type TableClass =
  | { readonly kind: 'tenant' }
  | { readonly kind: 'global'; readonly reason: string }
  | { readonly kind: 'system'; readonly reason: string };

export type TableClassification = Readonly<Record<string, TableClass>>;

export const TABLE_CLASSIFICATION: TableClassification = {};
