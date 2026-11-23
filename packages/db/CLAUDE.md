# @shifa/db

Drizzle client, migrations, database roles and the transaction wrappers (ADR-0004, ADR-0005, ADR-0043). Schema rules: `.claude/rules/db.md`; new migrations: `/db-migration`; new tables: `/rls-policy`. The `drift` step of `verify` fails when the schema has no matching migration or a folder is misnamed, incomplete or older than `main`'s newest.

## Querying
Pools and raw Drizzle are never exported; ESLint blocks `pg` / `drizzle-orm/node-postgres` outside `src/` and `test-harness/`.

```ts
const db = createDb(appUrl); // shifa_app, once per process
const rows = await db.withTenant({ tenantId, branchId, userId }, (tx) => tx.select().from(branch));
```
- Three roles, three pools, each refusing any other role, superuser, BYPASSRLS, owner or role member: `createDb()` (`withTenant()`, `ping()`), `createAuthDb()` (`withAuth()`, `withUser(id)`, `withSetupLink(hashHex)`, `withUserLink(id, hashHex)` for accepting an invitation), `createPlatformDb()` (`withPlatformAdmin({ actorId, event, data?, … }, (tx, audit) => …)`: one null-tenant audit row per call, `data` allowlisted to short enum words). Platform helpers take that `tx`: `createClinic()` (with its owner: pending membership, owner role, setup link), `issueOwnerLink()` (replaces the owner's unused links), `registerPlatformAdmin()` (seed only).
- Every wrapper sets or clears every `app.*` setting with `set_config(..., true)` (`src/context.ts`): never `SET`, no session state behind PgBouncer.
- A throw in the callback rolls back; never swallow database errors in it. `tx` dies when the callback ends. Raw SQL only as a `sql` template, one statement per `execute`.
- Log a database error's `code` and constraint only: messages and `detail` can echo values.
- App code never connects as `shifa_owner`; migrations run as the owner through `migrate(ownerUrl)`.

## Tests
- Docker must run. `pnpm --filter @shifa/db test` (or `pnpm verify`). One PostgreSQL + PgBouncer set per run; each worker clones `shifa_template` into `shifa_test_<pool id>`; before each file, earlier files' test-only tables are dropped and all tables truncated.
- `@shifa/db/testing` (test files only): `testDb()`, `testAuthDb()`, `testPlatformDb()`, `withoutTenant(db, fn)`, `ownerDb()` (test-only tables, catalogs), `rawAppDb()` (negative tests), `superuserDb(db?)` (roles, or rows no role may read), `resetTestDb()`, `createTestTenants(...ids)` (empties, then writes `tenant` rows and one `clinic.created` audit row), insert helpers (`fixtureId`, `syntheticPhones`, `insertUser`, `insertMembership`, …). Other packages: `dbTestProject()` from `@shifa/db/vitest.db.config`.
- PgBouncer (transaction mode, pool 2): `pooledTestDb()`, `rawPooledAppDb()`, `pooledHarnessUrl()`; `showPooler()` read-only; a `'reset'` variant has `server_reset_query_always = 1`. `POOLING_DATABASE` (pool 1) is never truncated: take `holdPoolingDatabase()` first. Leak tests: `test/pooling/`.
- Shared handles live per file; once closed, the next call opens a new one. Outside Vitest: `startHarnessContainer()` from `@shifa/db/harness` under `acquireDbTestLock()` (tests and `scripts/` only). The guard refuses any host, port or database the harness did not create.
- Test-only tables: `create table if not exists` in the test, never in migrations or the classification.
- `test/architecture/rls-presence.test.ts` (pristine clone `shifa_test_9997`): every table classified; tenant tables with `tenant_id`, ENABLE + FORCE RLS, PUBLIC/`shifa_app` policies on `current_tenant_id()`, `tenant_id`-led indexes; a `roleAccess` reason for every `shifa_auth`/`shifa_platform` policy; access classes match privileges. `test/privileges.test.ts` pins every role's privileges.
- `test/isolation/isolation.test.ts` runs each case in `test/isolation/cases/` direct and pooled; `prepare(ctx)` writes parent rows; `append-only`/`read-only` tables must refuse writes by privileges.

## Pins
`drizzle-orm` / `drizzle-kit` 1.0.0-rc.5, `pg`, `testcontainers` exact. Identity tables follow Better Auth 1.7.27 (phone-number, two-factor plugins). Images by digest in `test-harness/image.ts`.
