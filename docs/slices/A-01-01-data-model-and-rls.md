# A-01-01 Data model and RLS

Status: Planned · Tier: T0 · Branch: `feat/A-01-01-data-model-and-rls`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 1, 2 (database part), 14 (table and append-only); [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criteria 1, 13 (policy coverage) · Requirements: PLT-01, PLT-02, PLT-03, PLT-47 · Decisions: ADR-0004, ADR-0005, ADR-0006, ADR-0030; OD-82 (proposed with this plan)

First of eight A-01 slices (plan approved by the owner: see roadmap). Schema changes are serialised: no other A-01 slice starts its migration before this one merges.

## Goal
Every table of both A-01 specs exists with its tenant safety proven: tenant tables under FORCE RLS with isolation cases, identity tables readable by `shifa_app` only for the signed-in person, an append-only audit table, and a clinic created in one transaction. No route yet.

## Plan
1. **Contracts** — none.
2. **Database** (`/db-migration`, `/rls-policy` for each table; one expand migration, nothing to backfill):
   - Roles (OD-82, recommendation; ADR-0043 written here): `shifa_auth` (login, no BYPASSRLS, no membership) for the Better Auth adapter and link lookups: identity tables, `setup_link` SELECT/UPDATE by token hash, the person's own memberships across tenants (`user_id = current_user_id()`), INSERT on `audit_event`; and `shifa_platform` for `withPlatformAdmin()` (ADR-0005 "own role and audit"): platform tables, INSERT on tenant tables only under a tenant context it sets inside the clinic-creation transaction, INSERT on `audit_event` with a null tenant. `roles.sql` re-asserts both like `shifa_app`; `assertApplicationRole` accepts the three roles.
   - Platform tables (global, `shifa_platform` and `shifa_auth` per table): `tenant` (name, type solo / multi_doctor / multi_branch, status trial / active / suspended, subscription_end, idle_minutes 15/30/60 default 30, check constraint), `organization` (ADR-0006, one per tenant), `deployment_route` (PLT-02, `tenant_deployment` of ADR-0004). `shifa_app` reads its own tenant row only (`id = current_tenant_id()`).
   - Identity tables (global, personal data): Better Auth `user` (+ `phone_number` unique E.164), `session` (+ `active_tenant_id`, `active_branch_id`, `last_active_at`), `account`, `two_factor`, `verification`, written to Better Auth's schema for the pinned version and plugins (phone number, two factor); `auth_throttle` (key = HMAC, never the phone or IP; window, count, locked_until). Policy for `shifa_app`: own row on `app.user_id`; full access for `shifa_auth` only.
   - Tenant tables (`tenant_id` leading, ENABLE + FORCE RLS, `current_tenant_id()` policies): `branch` (name, address, phone, archived_at), `setup_link` (purpose owner_setup / member_setup / invitation, membership_id, token_hash sha-256, expires_at, used_at, replaced_at), `membership` (user_id null until accepted, phone_e164 and display_name as the owner typed them so the owner never reads `user`, status pending / active / deactivated, last_active_at; unique `(tenant_id, phone_e164)`), `role_assignment` (role, branch_id null = tenant-wide; FK `(tenant_id, branch_id)`), `permission_override` (membership, key, granted bool), `audit_event` (tenant_id nullable: null = platform event, actor_id, target_id, event, at, request_id, small allowlisted `data`).
   - `audit_event` append-only: no UPDATE/DELETE for any application role; platform rows (null tenant) invisible to `shifa_app`.
   - UUID keys only; a check that the schema has no sequence.
3. **packages/db** — `runAsPlatformAdmin()` on the `shifa_platform` pool with an audit row per call (closes the backlog "own role" item; `/health` moves to `db.ping()` as the backlog asks); `runAsAuth()` and `runAsUser(userId)` on the `shifa_auth` pool (set or clear every `app.*` setting, as `withTenant()`); `createClinic(tx, input)` inserting tenant, organization, main branch «الفرع الرئيسي» and deployment route in one transaction (the owner membership joins it in A-01-03).
4. **Test harness** — isolation runner: `prepare()` for parent rows (A-01b criterion 1), `appendOnly` class (backlog B7: "permission denied" expected for UPDATE/DELETE), role-specific cases for `shifa_auth` self-read policies; RLS presence: count only policies for PUBLIC or `shifa_app` (A-01b criterion 13), require a reason for every `TO shifa_auth`/`TO shifa_platform` policy in `classification.ts`. Synthetic insert helpers in `@shifa/testing` (clinic, branch, member, phones from `phones.ts`).
5. **API, web, Flutter, end-to-end** — none (`DATABASE_URL_AUTH`, `DATABASE_URL_PLATFORM` appear in `env.ts` in A-01-02).

Tests written first: isolation case per tenant table with `prepare()` parents (A-01a 1, A-01b 1); `app.user_id` policy tests on `user`, `session`, `two_factor`, `account` (A-01a 1); `shifa_auth` self-read of memberships across two tenants and nothing else; append-only and null-tenant invisibility (14); no-sequence check; one-transaction `createClinic` with a forced failure leaving nothing (2); role attribute tests for the two new roles; presence-test cases for the PUBLIC/`shifa_app` count.
Estimated hand-written lines: ~3,600 (schema ~650, policies and roles SQL ~450, wrappers ~300, runner and presence ~450, isolation and policy tests ~1,300, helpers ~250, ADR and domain doc ~200). Checkpoints: (1) roles + wrappers, (2) platform and identity tables, (3) tenant tables + isolation, (4) audit + createClinic + docs.

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Isolation suite: —
- Reviewer and security-reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
Pin the Better Auth version (≥ 24 h old, pnpm refuses younger) before writing the identity tables; record it here so A-01-02 uses the same one.
