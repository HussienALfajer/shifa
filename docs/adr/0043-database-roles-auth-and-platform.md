# ADR-0043: Two more database roles, `shifa_auth` for identity and `shifa_platform` for super-admin work

Status: Accepted (owner, 2026-11-23, OD-82) · Date: 2026-11-23 · Deciders: product owner (with Claude) · Amends: [ADR-0005](0005-drizzle-withtenant.md) (the platform path gets its own role and audit)

## Context
Until A-01 the application had one login role, `shifa_app`, under FORCE RLS with tenant policies on `current_tenant_id()` ([ADR-0004](0004-postgresql-pooled-tenancy-rls.md)). Its `withPlatformAdmin(reason, …)` was a placeholder: the same role with no tenant context, so it could see nothing, and no audit row.

The A-01 specs need three kinds of access that tenant RLS cannot give `shifa_app`:
- **Sign-in** must find a person by phone, and read and write sessions and MFA state, before any tenant is known ([A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 6 to 12). A setup link must be found by its token alone (criterion 4).
- **The clinic chooser** lists one person's memberships across tenants ([A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criterion 10).
- **The super admin** creates clinics and manages their status without seeing clinic data (A-01a criteria 2, 3, 13), and every such action is audited (criterion 14).

Giving `shifa_app` these powers (a "no tenant = see all" branch in its policies, or BYPASSRLS) would undo the one guarantee every tenant table rests on.

## Decision
- **Three login roles**, all `NOSUPERUSER NOBYPASSRLS NOINHERIT`, members of no role and owners of nothing, re-asserted by `packages/db/sql/roles.sql` on every run:
  - `shifa_app`: tenant work through `withTenant()` (unchanged), plus `ping()` for health checks;
  - `shifa_auth`: the identity path (`createAuthDb()`): `withAuth()` (the Better Auth adapter: identity tables, null-tenant audit events), `withUser(userId)` (adds the person's own memberships and their tenants), `withSetupLink(tokenHash)` (adds the one link with that SHA-256 hash; only `used_at` may change);
  - `shifa_platform`: the super-admin path (`createPlatformDb()`): `withPlatformAdmin({ actorId, event, requestId?, targetId? }, fn)` writes one `audit_event` row (null tenant) in the same transaction as the work.
- **Privileges keep the two new roles off clinic data.** Tenant isolation policies stay for PUBLIC, as `/rls-policy` writes them, so they also bind the new roles; what each role may touch is a table and column privilege matrix pinned by `packages/db/test/privileges.test.ts`. `shifa_platform` holds INSERT (not SELECT) on the tenant tables `createClinic()` fills, under a tenant context it sets and clears inside that transaction, and SELECT and UPDATE only on `deployment_route` (routing, no clinic data); `shifa_auth` holds SELECT on `membership` and SELECT plus `UPDATE (used_at)` on `setup_link`, filtered by its own policies.
- **Restrictive policies hold the side roles to their own rows** even if a tenant is set on their path (any role can set `app.tenant_id`, and the PUBLIC tenant policies would otherwise OR it in): `shifa_auth` reads only its person's memberships and its one link; both side roles write only null-tenant audit rows; `shifa_platform` inserts into tenant tables only in a `clinic.created` transaction. Column grants are pinned too (`test/privileges-columns.test.ts`).
- **Role-specific policies need a reason.** A policy for `shifa_auth` or `shifa_platform` alone is listed by name with its reason under `roleAccess` in `packages/db/src/schema/classification.ts`; the RLS presence check fails without it, fails a policy for any other role, and counts only PUBLIC or `shifa_app` policies as tenant coverage.
- **Identity tables are global and personal data.** `user`, `session`, `account`, `two_factor` (Better Auth 1.7.27 schema, uuid keys) are readable by `shifa_app` only for `app.user_id` (`current_user_id()`) and without secret columns (session token, password hash, OAuth tokens, TOTP secret, backup codes); `verification` and `auth_throttle` are `shifa_auth` only.
- **Every wrapper sets or clears every `app.*` setting** (`app.tenant_id`, `app.branch_id`, `app.user_id`, `app.admin_reason`, `app.link_token_hash`) with `set_config(..., true)` (ADR-0030). Each pool checks on every new connection that it is exactly its own role.
- **Audit is append-only for everyone.** No application role holds UPDATE or DELETE on `audit_event`; a statement trigger refuses them even for the owner (TRUNCATE stays an owner-only operation, used by the test harness). Rows with a null tenant (platform and sign-in events) are invisible to `shifa_app`.

## Consequences
+ `shifa_app` keeps its single rule (tenant rows of the current tenant only); a bug in identity or platform code cannot widen it.
+ Each cross-tenant need is a named, reasoned, tested policy or privilege instead of a branch in a shared policy.
+ The platform path is audited by construction: no `withPlatformAdmin()` call commits without its row.
− Three connection pools and three secrets per deployment (`DATABASE_URL_AUTH`, `DATABASE_URL_PLATFORM` arrive with A-01-02), and three PgBouncer userlist entries.
− Cross-tenant lookups (`membership` by `user_id`, `setup_link` by token hash) have no index of their own, because every tenant-table index leads with `tenant_id`; they scan until volume asks for a reasoned exception (backlog).
− Platform audit rows can be written but not yet read by any application role; the audit viewer adds that read.

## Alternatives considered
- **`shifa_app` with a "no tenant = all rows" policy branch:** one mistake in context handling exposes every clinic; refused by `/rls-policy` since 0.2-06b.
- **A BYPASSRLS role for sign-in and the platform:** simplest, but nothing in the database would then limit what that code reads.
- **`SECURITY DEFINER` functions for each identity query:** narrow, but every Better Auth adapter call would need its own function; the adapter works on tables.

## Sources
OD-82; [slice A-01-01](../slices/A-01-01-data-model-and-rls.md); ADR-0004, ADR-0005, ADR-0006, ADR-0030; backlog items B1, B5, B7 (0.2-06b security review) and L2 (0.2-06a security review).
