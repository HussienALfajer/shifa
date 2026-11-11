# @shifa/db

Drizzle client, migrations, database roles and `withTenant()` (ADR-0004, ADR-0005). Rules for schema work: `.claude/rules/db.md`; new migrations: `/db-migration`. The `drift` step of `verify` (`node scripts/check-drift.mjs`) fails when the schema has no matching migration or a folder is misnamed, incomplete or older than `main`'s newest; `--fix` never applies to migrations.

## Querying
Every tenant query runs inside `withTenant()`; the pool and raw Drizzle instance are never exported, and ESLint blocks `pg` / `drizzle-orm/node-postgres` outside `src/` and `test-harness/`.

```ts
const db = createDb(appUrl); // connects as shifa_app, once per process
const rows = await db.withTenant({ tenantId, branchId, userId }, (tx) =>
  tx.select().from(appointments).where(eq(appointments.day, day)),
);
```
- Context is set with `set_config(..., true)` inside the transaction: never `SET`, never outside a transaction.
- Throwing inside the callback rolls back. Do not catch and swallow database errors inside it.
- `tx` works only while the callback runs: never store it or use it after an un-awaited call. Raw SQL only as a `sql` template, one statement per `execute`.
- `createDb()` refuses a role that is superuser, has BYPASSRLS or owns tables.
- `withPlatformAdmin(reason, fn)` is the only other path (no tenant context; audited later).
- Log a database error's `code` (SQLSTATE) and constraint name only: PostgreSQL messages and `detail` can echo values.
- App code never connects as `shifa_owner`. Migrations run as the owner through `migrate(ownerUrl)`.

## Tests
- Docker must be running (Docker Desktop on Windows). `pnpm --filter @shifa/db test` (or `pnpm verify`).
- One PostgreSQL + PgBouncer pair per run; each Vitest worker gets `shifa_test_<pool id>` cloned from the migrated `shifa_template`; tables are truncated before each file.
- From `@shifa/db/testing` (lint allows it in test files only): `testDb()` (app role, use for behaviour), `ownerDb()` (create test-only tables, read catalogs), `rawAppDb()` (negative tests only), `superuserDb()` (role tests, inside a rolled-back transaction), `resetTestDb()`.
- Another package adds DB tests with `dbTestProject()` from `@shifa/db/vitest.db.config` in its Vitest `projects`.
- PgBouncer (transaction mode, server pool 2) runs in front: `pooledTestDb()`, `rawPooledAppDb()`, `pooledHarnessUrl()` mirror the direct handles; `showPooler('CONFIG')` reads its console (read-only); `POOLING_DATABASE` (server pool 1) exists from start, is never truncated.
- `testDb()` is shared within a file; once something closes it (an app under test at shutdown), the next call opens a new one.
- Outside Vitest (scripts such as the API boot check), `@shifa/db/harness` starts the container: `startHarnessContainer()` under `acquireDbTestLock()`. Lint allows it in tests and `scripts/` only.
- The guard refuses any host, port or database the harness did not create and never reads `DATABASE_URL`. A second run waits up to 5 minutes for `.verify/db-test.lock`.
- Test-only tables (like `rls_probe`) are created in the test with `create table if not exists`, never in migrations, and never listed in the classification.
- `test/architecture/rls-presence.test.ts` checks the catalog of a pristine clone (`shifa_test_9997`): every `public` table classified, tenant tables with `tenant_id`, ENABLE + FORCE RLS, policies on `current_tenant_id()`, indexes led by `tenant_id`, views `security_invoker`.
- `test/isolation/isolation.test.ts` runs every case in `test/isolation/cases/` as `shifa_app`, direct and pooled (reads and forged writes from tenant A against tenant B) and fails for a tenant table without a case. New tables: `/rls-policy`.

## Pins
`drizzle-orm` / `drizzle-kit` 1.0.0-rc.5 (exact; upgrade with a changelog entry), `pg`, `testcontainers` exact. Images (PostgreSQL, PgBouncer, Ryuk) by digest in `test-harness/image.ts` (CI pulls the same).
