# A-01-01 Data model and RLS

Status: Built, in review · Tier: T0 · Branch: `feat/A-01-01-data-model-and-rls` (built on the cloud session branch `claude/gracious-gauss-azbrab`, [cloud sessions](../process/cloud-sessions.md) §4)
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 1, 2 (database part), 14 (table and append-only); [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criteria 1, 13 (policy coverage) · Requirements: PLT-01, PLT-02, PLT-03, PLT-47 · Decisions: ADR-0004, ADR-0005, ADR-0006, ADR-0030; OD-82 (closed 2026-11-23: two roles)

First of eight A-01 slices (plan approved by the owner 2026-11-23, second-session critique waived: see roadmap). Schema changes are serialised: no other A-01 slice starts its migration before this one merges.

## Goal
Every table of both A-01 specs exists with its tenant safety proven: tenant tables under FORCE RLS with isolation cases, identity tables readable by `shifa_app` only for the signed-in person, an append-only audit table, and a clinic created in one transaction. No route yet.

## Plan
1. **Contracts** — none.
2. **Database** (`/db-migration`, `/rls-policy` for each table; one expand migration, nothing to backfill):
   - Roles (OD-82, approved; ADR-0043 written here): `shifa_auth` (login, no BYPASSRLS, no membership) for the Better Auth adapter and link lookups: identity tables, `setup_link` SELECT/UPDATE by token hash, the person's own memberships across tenants (`user_id = current_user_id()`), INSERT on `audit_event`; and `shifa_platform` for `withPlatformAdmin()` (ADR-0005 "own role and audit"): platform tables, INSERT on tenant tables only under a tenant context it sets inside the clinic-creation transaction, INSERT on `audit_event` with a null tenant. `roles.sql` re-asserts both like `shifa_app`; `assertApplicationRole` accepts the three roles.
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
All layers built and green; reviews and PR next.

## As built (differences from the plan)
- **Migrations:** `20261123183313_a01_identity_and_tenancy` (generated: 15 tables, keys, checks, foreign keys) and `20261123183321_a01_policies_and_grants` (custom: helpers `current_user_id()` and `current_link_token_hash()`, RLS, privileges, role policies, the append-only trigger). Both **expand** (new tables only, nothing to backfill). Rollback before any real data: drop the 15 tables and the three functions; after real data, roll forward only.
- **`organization` is a tenant table** (it carries `tenant_id`, so classifying it global would fail the presence check and hide a tenant's name from RLS); `deployment_route` is a tenant table too, `access: 'read-only'` for `shifa_app`, with two reasoned `shifa_platform` policies (route and move). Only `tenant` is global among the platform tables.
- **Setup links by hash:** `withSetupLink(tokenHashHex)` sets `app.link_token_hash`; `shifa_auth` sees only the matching link and may update only `used_at` (column privilege). Token hashes and throttle keys are stored as 64 hex digits (`text` with a check), not `bytea`.
- **`auth_throttle`** has a uuid key and a unique `(kind, key_hash)`; columns `window_start`, `failures`, `locked_until`.
- **API:** `withPlatformAdmin` left the app pool, so `/health/ready`, the startup check, two API tests and the OpenAPI generator stub moved to `db.ping()` / `withTenant()` (backlog L2, as the plan said). No env keys yet (A-01-02).
- **Harness:** `createTestTenants(...ids)` empties the database and writes `tenant` rows; each file now starts by dropping earlier files' probe tables (the privilege matrix read every table in the worker database and failed on another file's probe). The two script tests of the migrations drift check wrote a probe schema over `schema/index.ts`; they now add it beside the real schema (replacing it made drizzle-kit prompt to drop 15 tables).
- **Isolation runner:** each case starts from an empty database with tenants A and B; `prepare(ctx)` writes parents through `ctx.inTenant()`; read-only tables are seeded by the owner under the tenant's own context.
- **Locked tests:** two lint-only edits after the red phase (an unneeded type parameter in `identity-policies.test.ts`, an unused destructured name in `runner-access.test.ts`), approved by the owner on 2026-11-23; assertions unchanged.
- **Better Auth pinned at 1.7.27** (published 2026-11-20; the 1.8 line is still beta). The identity tables follow its core schema plus the `phoneNumber` and `twoFactor` plugins; A-01-02 configures `advanced.database.generateId: 'uuid'` and maps the snake_case columns.
- Hand-written lines: about 3,400 (tests about 1,800), within the ~3,600 estimate.

## Evidence
- `pnpm verify` (fast, affected): all green: format, instructions, lint-root, scripts-test (3 Docker suites left to `verify:full`), file-length, pub-get, drift (`migrations` CLEAN), typecheck+lint+test (`@shifa/db`, `@shifa/api`).
- `@shifa/db` against PostgreSQL 18 and PgBouncer (Testcontainers, in this cloud session): 35 files, 267 tests pass. New: `roles` (attributes and membership refusal for the three roles), `privileges` (exact table and column matrix, secret columns, helper functions), `identity-policies` (A-01a 1), `audit-event` (14), `schema-keys` (no sequence, uuid primary keys), `create-clinic` (2, forced failure leaves nothing), `wrappers`, `isolation/runner-access` (prepare, append-only, read-only), `architecture/rls-presence-roles` (A-01b 13).
- Isolation suite: 8 tenant tables × direct and PgBouncer, 18 of 18 pass.
- Red phase: 39 tests failed for the right reasons (missing roles, tables, helpers) before any implementation.
- Negative evidence: `membership_auth_own_read` widened to `USING (true)` and `shifa_app` given back UPDATE on `audit_event`: 20 tests fail (identity, privileges, presence, audit, isolation); reverted.
- Reviewer and security-reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
Better Auth is pinned at **1.7.27**: add it (and its Drizzle adapter of the same version) in A-01-02. The adapter's schema keys are `user`, `session`, `account`, `verification`, `twoFactor` (exported by `@shifa/db`); columns are snake_case, so map fields or use Drizzle's column names. `user.email` is required and unique: fill a placeholder for phone sign-ups.
