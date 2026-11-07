# ADR-0004: PostgreSQL 18 with pooled multi-tenancy, FORCE RLS, transaction-scoped tenant context, and a tenant routing table

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Most tenants are small clinics (solo to a few doctors); a few may become multi-branch groups. Cross-tenant leakage of medical data would be catastrophic. AWS SaaS Lens and Azure guidance favour starting pooled with a path to dedicated databases for large tenants [RN-05 §1]. RLS has known pitfalls with poolers and owners [RN-05 §1] [RN-16 §2].

## Decision
- PostgreSQL 18, self-hosted and portable (no managed-only features) — required by the hosting uncertainty in [ADR-0022](0022-deployment-portable-hosting.md).
- Shared schema; every tenant-scoped table has `tenant_id` (and `branch_id` where relevant) as the leading column of its indexes.
- Row-Level Security on every tenant-scoped table with `FORCE ROW LEVEL SECURITY`; the application connects as a non-owner role without `BYPASSRLS`.
- Tenant context is set per transaction with `set_config('app.tenant_id', …, true)` (never session-level `SET`), via the data-access wrapper in [ADR-0005](0005-drizzle-withtenant.md); safe with PgBouncer in transaction mode.
- A `tenant_deployment` routing table maps each tenant to its database from day one so a large group can later move to a dedicated database.
- Double booking is prevented by exclusion constraints on time ranges (`btree_gist`).
- CI runs a cross-tenant isolation suite: two or more seeded tenants, every repository/query path asserted to return zero foreign rows, plus a check that no tenant-scoped table lacks a policy.

## Consequences
+ Cheapest operations for many small tenants; one migration run.
+ Isolation enforced in the database, not only in application code.
− Unique and foreign-key checks are not RLS-filtered; constraints must include `tenant_id` where needed.
− Performance depends on `tenant_id`-leading indexes and policy design; covered by tests.

## Alternatives considered
- Schema-per-tenant: migration fan-out and catalogue bloat at thousands of tenants.
- Database-per-tenant: highest isolation, highest cost; kept only as the escape hatch via routing.
- Citus: unnecessary at expected scale.

## Sources
[RN-05 §1–§2], [RN-16 §2, §3], [RN-18 §4.11], [RN-06 §2]
