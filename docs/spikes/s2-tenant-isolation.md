# Spike S2 result: tenant isolation behind PgBouncer

Date: 2026-11-15 · Spec: [0.3-S2](../specs/spikes/0.3-s2-tenant-isolation.md) · Slices: [0.3-S2a](../slices/0.3-s2a-pgbouncer-harness.md), [0.3-S2b](../slices/0.3-s2b-pooling-leak-tests.md), [0.3-S2c](../slices/0.3-s2c-plan-bench-and-adr.md) · Decision: [ADR-0030](../adr/0030-pgbouncer-transaction-mode-tenant-context.md) · Requirements: PLT-01, PLT-50

## Answer
**Safe with these settings, and not safe without them.** The tenant context itself (`set_config(..., true)` inside `withTenant()`) does not leak between clients behind PgBouncer in transaction mode: no test in criteria 4–8 found a transaction that saw another tenant's `app.*` context. But other session state does leak unless PgBouncer resets every server connection: a `WITH HOLD` cursor opened inside `withTenant(A)` returned A's row inside `withTenant(B)`. The full list of required production settings is the table in [ADR-0030](../adr/0030-pgbouncer-transaction-mode-tenant-context.md) (including `idle_in_transaction_session_timeout`, explicit `[databases]` entries without a forced user, a userlist with `shifa_app` only, and a startup check that refuses to run without them). The two that the leak tests depend on:

1. `server_reset_query = DISCARD ALL` with `server_reset_query_always = 1` (owner, OD-28). The wrappers reset only the `app.*` settings. Other session state created inside `withTenant()` outlives COMMIT on the shared server connection: a `WITH HOLD` cursor opened for tenant A returned A's row inside tenant B's transaction, and a session advisory lock stayed held. With the reset, both were gone before the next client.
2. `max_prepared_statements > 0`, so Drizzle `.prepare()` works in transaction mode (criterion 7).

The session forms stay forbidden in code (`.claude/rules/db.md`); the reset is the backstop, not a licence.

## Versions tested
PostgreSQL 18.6 (`postgres:18.6-trixie`), PgBouncer 1.26.1 (`edoburu/pgbouncer:v1.26.1-p0`, binary only), Drizzle ORM 1.0.0-rc.5, `pg` 8.23.1, Node 24. A Drizzle or PgBouncer upgrade reruns `pnpm --filter @shifa/db test` (the pooling tests run on every PR) and, for cost, `bench:rls`.

## Evidence per criterion
Raw observations of a test run are written to `.verify/s2-pooling/*.json` (git-ignored). Test files are under `packages/db/test/`.

| # | Result | Proof |
|---|---|---|
| 1 | PgBouncer pinned by digest, transaction mode, `default_pool_size = 2`, `max_prepared_statements = 200`, per-run userlist; the guard accepts only the harness's PostgreSQL and PgBouncer host and port pairs | `pgbouncer.test.ts`, `guard-pooler.test.ts`, `harness.test.ts` (S2a) |
| 2 | `pooledTestDb()` connects as `shifa_app` through PgBouncer; `createDb()`'s role check passes for it and refuses the owner behind the pooler | `pgbouncer.test.ts`, `pgbouncer-routing.test.ts` (backend pid found in `SHOW SERVERS`) |
| 3 | The isolation suite and the runner gap checks run direct and pooled; an uncovered tenant table still fails | `isolation/isolation.test.ts`, `isolation/runner-gaps.test.ts` (`describe.each(DB_MODES)`) |
| 4 | After a committed, a rolled-back and a failed `withTenant()`, the next transaction on the same server pid sees no `app.*` setting and 0 rows | `pooling/context-reuse.test.ts`; negative: `set_config(..., false)` in the wrapper fails all 3 tests |
| 5 | A session-level `SET app.tenant_id` from a raw client survives on the shared pooler, but `withTenant(B)` sees only B and `withPlatformAdmin` no tenant; with `server_reset_query_always = 1` the next client sees nothing | `pooling/session-leftovers.test.ts`; negative: dropping the wrapper's `app.branch_id` or `app.admin_reason` reset fails it |
| 6 | A client killed mid-transaction: PgBouncer drops that server connection, no `idle in transaction` backend remains, the next client has no context; the same after `idle_in_transaction_session_timeout` fires | `pooling/broken-clients.test.ts` |
| 7 | A Drizzle named prepared statement run for A and B over shared server connections returns only the current tenant's rows, also after PostgreSQL switched to a generic plan (7 and 12 generic executions) and behind the reset pooler | `pooling/prepared-statements.test.ts` |
| 8 | 20 rounds × 50 concurrent `withTenant()` over 3 synthetic tenants on 2 server connections: 1000 calls, 0 mismatches | `pooling/concurrency.test.ts` |
| 9 | `pg_advisory_xact_lock` works across server connections and is released at COMMIT; temp tables are refused to `shifa_app`, `ON COMMIT DROP` included (OD-27); the session forms are forbidden in the rules | `pooling/session-features.test.ts`, `.claude/rules/db.md`, `packages/db/CLAUDE.md` |
| 10 | On `plan_probe` (50 tenants × 1,000 rows, the `load` preset's volume, `ANALYZE`d), the tenant's latest 20 rows, queried as `shifa_app` inside `withTenant()` through PgBouncer with no tenant filter of its own, use `plan_probe_tenant_created` with the policy (`current_setting('app.tenant_id')`) as the index condition and no sequential scan, and return only that tenant's 20 rows; without the index the same walker reports `Seq Scan on plan_probe` | `pooling/plan-check.test.ts` (the negative case is a permanent test). The reviewer showed that a `plpgsql VOLATILE` `current_tenant_id()` turns the policy-only query into a sequential scan, which this test now catches |
| 11 | RLS adds about 1% at p50 to that query through PgBouncer (below) | `pnpm --filter @shifa/db bench:rls`, `.verify/s2-bench/report.json` |

## RLS cost (criterion 11, report only)
Same transaction shape and the same 20 rows for both (BEGIN; `set_config('app.tenant_id', $1, true)`; the tenant's latest 20 rows; COMMIT), interleaved, one client each, through the shared PgBouncer: (a) `shifa_app` under RLS with the application query that names no tenant (the policy picks it), (b) `shifa_bench_bypass`, a BYPASSRLS login created only in the bench's throw-away container, with `tenant_id = $1` named explicitly. 200 warm-up and 2,000 measured transactions each. Both plans used `plan_probe_tenant_created`. Runs 1 and 2 measured an earlier shape in which the RLS side also named the tenant; run 3 is the policy-only shape.

| Run | Machine | RLS p50 / p95 (ms) | BYPASSRLS p50 / p95 (ms) | Ratio p50 / p95 |
|---|---|---|---|---|
| 2026-11-15, Windows 11 + Docker Desktop, run 1 | Intel Core i9-14900HX, 32 threads, 31.7 GB | 2.426 / 4.018 | 2.408 / 3.973 | 1.01 / 1.01 |
| 2026-11-15, Windows 11 + Docker Desktop, run 2 | same | 4.925 / 16.262 | 4.917 / 15.216 | 1.00 / 1.07 |
| 2026-11-15, Windows 11 + Docker Desktop, run 3 (policy only) | same | 4.648 / 8.367 | 4.678 / 8.444 | 0.99 / 0.99 |
| Owner, WSL2 | pending (acceptance step) | | | |
| CI dispatch (`rls-bench.yml`, ubuntu-24.04) | pending (after merge; dispatch needs the workflow on `main`) | | | |

The absolute numbers are dominated by the Docker Desktop network path on Windows and vary between runs; the ratio is the result: the policy (`tenant_id = current_tenant_id()`, an inlined STABLE SQL function) becomes the index condition, so a query that relies on RLS alone costs nothing measurable next to the round trips, whether or not it also names its tenant. The bench role is not in `sql/roles.sql` or the migrations; the roles tests check that `shifa_app` and `shifa_owner` have neither superuser nor BYPASSRLS (`architecture/rls-presence.test.ts` "confirms shifa_app owns nothing and does not bypass RLS", `roles.test.ts`), and `createDb()` refuses such a role at runtime. No test yet refuses a new BYPASSRLS login added to `roles.sql` under another name (backlog).

## What breaks in transaction mode (criterion 9)
Forbidden on the application pool, inside `withTenant()` too: `SET` and `set_config(..., false)` (use `set_config(..., true)`), session advisory locks (use `pg_advisory_xact_lock`), `LISTEN` (realtime uses Centrifugo, ADR-0015), temporary tables (no TEMP privilege, OD-27), `WITH HOLD` cursors, SQL `PREPARE` (Drizzle `.prepare()` is fine with `max_prepared_statements > 0`). `LISTEN` and SQL `PREPARE` are listed from PgBouncer's documented limits, not tested.

## `server_reset_query_always` (criterion 5, OD-28)
Required. Without it, session state created inside a tenant transaction reaches the next tenant on that server connection (WITH HOLD cursor rows, session advisory locks; by extension `LISTEN` registrations and any session `SET`). Measured cost on one server connection (S2b, Windows + Docker Desktop): p50 2.89 ms without vs 3.03 ms with the reset (+0.14 ms, about 5%), and about 8% lower throughput with 8 concurrent clients (412 vs 380 transactions/s). With several server connections the reset overlaps other work and the cost was not visible.

## PgBouncer restart or reload (not tested; expected behaviour)
- **Restart or crash:** every client and server connection drops; open transactions roll back on PostgreSQL; the next connection starts with a fresh backend, so no context survives. Clients see connection errors and must retry the whole transaction (`withTenant()` callbacks are not retried automatically).
- **Reload (`RELOAD`/SIGHUP):** server connections stay up; changed settings apply to new assignments. A reload that changes the `[databases]` user mapping would move server connections to another role while clients keep their cached role check (backlog: role check per transaction).

## Risks left
- **Drizzle 1.0 RC** (ADR-0005 caveat): only rc.5 is tested; any upgrade reruns the pooling tests and the bench.
- **Role check cached per client connection** (backlog): a PgBouncer reload that remaps users is not caught until the client reconnects.
- **TEMP revoke depends on database ownership** (backlog): on a database not owned by `shifa_owner` the baseline revoke does nothing; the role check should test it.
- **Session-state ban is rule text** (backlog): no automated check yet; the reset is the production backstop.
- **Out of scope:** TLS between PgBouncer and PostgreSQL, PgBouncer HA, production image provenance (ADR-0030 sets the requirement), other poolers, load testing with a threshold.
