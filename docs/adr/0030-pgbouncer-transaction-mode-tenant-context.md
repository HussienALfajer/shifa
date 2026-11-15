# ADR-0030: PgBouncer in transaction mode with transaction-scoped tenant context, and its required settings

Status: Proposed · Date: 2026-11-15 · Deciders: product owner (with Claude) · Amends: [ADR-0004](0004-postgresql-pooled-tenancy-rls.md), [ADR-0005](0005-drizzle-withtenant.md)

## Context
[ADR-0004](0004-postgresql-pooled-tenancy-rls.md) claims that tenant context set per transaction with `set_config(..., true)` is safe behind PgBouncer in transaction mode, and [ADR-0005](0005-drizzle-withtenant.md) puts that call in `withTenant()`. Spike S2 ([spec](../specs/spikes/0.3-s2-tenant-isolation.md), [result](../spikes/s2-tenant-isolation.md)) tested the claim with PostgreSQL 18.6, PgBouncer 1.26.1 and Drizzle 1.0.0-rc.5: context reuse after commit, rollback and error; session-level leftovers; killed clients and idle-transaction timeouts; named prepared statements through generic plans; 1000 concurrent calls on 2 server connections; plan use under RLS; and RLS cost. No test found a transaction that saw another tenant's context or rows through the wrappers. But session state created inside `withTenant()` (a `WITH HOLD` cursor, a session advisory lock) outlived COMMIT on the shared server connection, and a WITH HOLD cursor opened for one tenant returned that tenant's row inside another tenant's transaction. The owner decided on 2026-11-12 that production must reset every server connection (OD-28) and that temporary tables stay refused (OD-27).

## Decision
- PgBouncer is the connection pooler between the application (`shifa_app`) and PostgreSQL, in **transaction mode**. Tenant context stays transaction-scoped as ADR-0004/0005 say; the S2 leak tests (`packages/db/test/pooling/`, `test/isolation/` in both modes) run on every PR.
- Required PgBouncer settings in every environment that serves the application:

  | Setting | Value | Why |
  |---|---|---|
  | `pool_mode` | `transaction` | Many clients share few server connections; the context is per transaction |
  | `server_reset_query` | `DISCARD ALL` | Clears cursors, advisory locks, `LISTEN`, prepared statements and settings |
  | `server_reset_query_always` | `1` | Runs the reset after every transaction in transaction mode (OD-28); measured about +0.14 ms p50 on one server connection |
  | `max_prepared_statements` | greater than 0 (tested with 200) | Drizzle `.prepare()` uses protocol-level named statements |
  | `auth_type` | `scram-sha-256` | No plain or MD5 passwords |
  | `[databases]` | explicit entries per database, no `* =` wildcard | Only the application databases are reachable |
  | userlist | `shifa_app` only (plus the stats login) | The owner and superuser never go through the pooler |
  | `stats_users` | a monitoring login | Monitoring reads `SHOW`; no `admin_users` login on the application path |

- Required on the database: `idle_in_transaction_session_timeout` set (value chosen with the deployment, S2 proved behaviour at 1 s), so a client that disappears mid-transaction never holds a server connection or locks.
- Application rules, unchanged by the reset: no session state on the application pool, inside `withTenant()` too (`SET`, `set_config(..., false)`, session advisory locks, `LISTEN`, temporary tables, `WITH HOLD` cursors, SQL `PREPARE`), as written in `.claude/rules/db.md`. The reset is the backstop, not a licence.
- Production image provenance: the test harness uses the community image `edoburu/pgbouncer` (single maintainer) as a carrier for the binary. Production uses PgBouncer from the distribution's or PGDG's packages, or an image built by us from them, pinned by version; chosen with the deployment ([ADR-0022](0022-deployment-portable-hosting.md)).
- Out of this decision: TLS between PgBouncer and PostgreSQL, PgBouncer high availability, and the pool sizes; they are set with the deployment.

## Consequences
- Every transaction pays the `DISCARD ALL` round on its server connection (about 5% latency on one busy connection, invisible with several). Throughput planning counts it.
- Server-side prepared statements are deallocated after each transaction and prepared again by PgBouncer, so generic plans are not reused across transactions; acceptable at clinic scale.
- RLS cost itself is not a concern: about 1% at p50 for a typical tenant query on the `load` preset's volume, and the planner uses the `tenant_id`-leading index (S2 criteria 10–11).
- A Drizzle, `pg` or PgBouncer upgrade reruns the pooling tests and `bench:rls` before it lands.
- Known gaps tracked in `docs/backlog.md`: the role check is cached per client connection, the TEMP revoke depends on database ownership, and the session-state ban has no automated check.

## Alternatives considered
- **Transaction mode without the reset:** rejected; the WITH HOLD cursor test showed one tenant's rows reaching another tenant.
- **Session mode:** no cross-tenant session state, but one server connection per client and no pooling benefit; kept as the fallback if a future upgrade breaks the transaction-mode tests.
- **No pooler (direct connections):** simplest, but connection count grows with every API instance and job worker; not needed given the result.
- **Other poolers (PgCat, Supavisor):** out of the spike's scope; not tested.

## Sources
- Spike result: [docs/spikes/s2-tenant-isolation.md](../spikes/s2-tenant-isolation.md)
- Slices: [0.3-S2a](../slices/0.3-s2a-pgbouncer-harness.md), [0.3-S2b](../slices/0.3-s2b-pooling-leak-tests.md), [0.3-S2c](../slices/0.3-s2c-plan-bench-and-adr.md)
- Owner decisions OD-27 and OD-28 ([open decisions](../open-decisions.md))
