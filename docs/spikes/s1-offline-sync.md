# Spike S1 result: offline sync engine — PowerSync vs custom outbox

Status: Automated runs done (2026-11-16); owner's manual run and the Flutter probe (0.3-S1e) pending · Spec: [0.3-S1](../specs/spikes/0.3-s1-offline-sync.md) · Slice: [0.3-S1](../slices/0.3-s1-offline-sync-spike.md) · Decision: [ADR-0031](../adr/0031-offline-sync-custom-outbox.md) (Proposed)

## Answer
Both engines met every automated criterion on the reception scenarios with the same server command handler: no lost or duplicated command after two simulated hours offline, on a degraded link, across token expiry and across a browser restart. They differ in cost, not in correctness. The **custom outbox** is recommended for reception (web) and, unless the Flutter probe (0.3-S1e) shows otherwise, for the patient app: about one tenth of the web bundle, no extra service to run, and the database's row-level security stays the only tenant boundary. PowerSync would add a service with a replication role that bypasses RLS, so its sync-stream filters become a second tenant boundary to maintain. This is also the spec's default when the result is inconclusive.

## Setup
- Server: spike API in `spikes/s1-offline/server` (Fastify, `@shifa/db` `withTenant()` as `shifa_app`), tables in schema `s1` with FORCE RLS. One command handler for both engines: `POST /commands` (outbox) and `POST /powersync/upload` (PowerSync connector).
- Engines: outbox on IndexedDB (`idb` 8.0.4) with `GET /sync/pull` (snapshot + changes since a cursor); PowerSync service 1.28.3 (`journeyapps/powersync-service@sha256:effc8cfa…`), PostgreSQL bucket storage, Sync Streams edition 3, web SDK `@powersync/web` 2.7.0 (`@powersync/common` 2.5.0, `@journeyapps/wa-sqlite` 2.0.10).
- Scenario suite (`spikes/s1-offline/scenarios`): Playwright 1.65.1 (Chromium), Toxiproxy 2.13.0 between each browser and the services (two proxies per device with PowerSync: API and sync stream), PostgreSQL 18.6 with `wal_level=logical`, all images digest-pinned. Fake browser clock for the two simulated hours.
- Data: synthetic only (`@shifa/testing` `demo` preset, seed 31): tenant A (3 doctors) and tenant B.

## Results per criterion

| # | Criterion | Outbox | PowerSync | Evidence |
|---|---|---|---|---|
| 1 | Shared server, FORCE RLS, idempotent commands | Pass | Pass (same handler) | `server/test/idempotency.test.ts`, `tenancy.test.ts` (32 DB tests + 5 pull tests) |
| 2a | Queue numbers per shift, remaps returned | Pass | Pass | `queue-numbers.test.ts`; two-hours run: 40 tickets, 0 duplicate, 0 gap; 20 remaps (outbox run) and 24 (PowerSync run; the count depends on arrival order), each shown on the device that made it |
| 2b | Overlap → conflict, never dropped | Pass | Pass | `appointments.test.ts`; 1 conflict shown in each run |
| 2c | Cash append-only, accepted into an open session | Pass | Pass | `cash.test.ts` (`UPDATE`/`DELETE` denied to `shifa_app`) |
| 3 | Offline cash: sale and refund only, rate and offline mark on receipt | Pass | Pass (same UI and server rules) | `cash.test.ts`, `web/test/cash-rules.test.ts` |
| 4 | PowerSync self-hosted, PostgreSQL storage, scoped streams, shared upload | — | Pass | `scenarios/powersync/`; suite green with `ENGINE=powersync` |
| 5 | Outbox: IndexedDB + snapshot/changes pull through `withTenant()` | Pass | — | `web/test/outbox.test.ts`, `server/test/pull.test.ts` |
| 6 | Two devices, 2 h offline: 40 walk-ins, 60 status changes, 50 sales + 5 refunds in 3 currencies, 2 overlapping bookings | Pass | Pass | `two-hours-offline.spec.ts`: 157 commands received of 157, totals SYP 90,211.00 / TRY 344.00 / USD 360.00 = sum of commands |
| 7 | 2 s latency, 30% of connections reset, response cut mid-upload | Pass | Pass | `degraded-links.spec.ts`: the server applied the cut batch, the device retried it, no duplicate |
| 8 | Banner: time offline and pending count → 0 | Pass | Pass | banner ≥ 1 h 57 min offline, pending back to 0 on both devices |
| 9 | Token expires during the outage | Pass | Pass | `session-expiry.spec.ts`: 10 queued, 0 synced before re-login, 10 synced once after |
| 10 | Tenant A never receives tenant B rows; forged commands refused and logged by id | Pass | Pass | `tenant-scoping.spec.ts` (local store and, for PowerSync, the raw sync stream read with A's token); `tenancy.test.ts` (log lines: tenant id, command id, code only) |
| 11 | Flutter probe: cached reads offline, SQLCipher, offline cancel syncs once | Pending | Pending | split to [0.3-S1e](../slices/0.3-s1e-flutter-probe.md) (line budget) |
| 12 | Owner's 2-hour manual run on two devices | Pending | Pending | [checklist](s1-manual-checklist.md) |
| 13 | This report, ADR-0031 | Done (Proposed) | | reviewer and security-reviewer before the PR |

Red proof: two deliberately broken engines fail the suite. One drops every tenth command: 142 of 157 received in the two-hours run, 151 of 158 on the degraded link, 9 of 10 after re-login. The other replays each batch without idempotency keys: 20 of 10 after re-login, and the two-hours run never settles.

Survival on tab close / browser restart (edge case): a persistent Chromium profile closed while offline and reopened offline kept **8 of 8** queued commands on both engines, opened from the service worker's cached shell, and synced all 8 once. Not tested: browser storage eviction under storage pressure (IndexedDB and PowerSync's IndexedDB-backed SQLite are both "best effort" storage unless `navigator.storage.persist()` is granted; Phase A should request it).

## Differences that decide

| | Custom outbox | PowerSync |
|---|---|---|
| Web bundle (gzip) | 35.5 KB JS, no WASM | 347.7 KB JS + 2.78 MB WASM (four wa-sqlite builds; one loads at runtime, 0.5–0.9 MB) |
| Services to run | none beyond the API | PowerSync service (≈309 MiB idle) + its storage database + logical replication |
| Tenant boundary on download | RLS through `withTenant()` (the same as every API read) | Sync-stream filters; the replication role must bypass RLS, so a wrong stream query leaks across tenants with no database backstop |
| Database setup | none | `wal_level=logical`, replication role with `BYPASSRLS`, publication (PostgreSQL 18 needs `publish_generated_columns = stored` for generated columns: missing it stalled replication silently in this spike), storage database |
| "Today only" | a SQL filter in the pull | needed a `day` JWT claim and `clinic_day` columns, because stream queries cannot use the clock |
| Local querying | key-value rows, filtered in JS | full SQLite, reactive queries |
| Upload path | own queue, retries with the same ids | SDK queue; optimistic writes to synced tables are replaced at the next checkpoint |
| Version churn seen | none (idb 8) | sync rules deprecated for Sync Streams edition 3; `AbstractPowerSyncDatabase` deprecated in 2.x |
| Code in the spike | engine 338 lines + server pull 94 | engine 344 lines + service setup and streams 135 |

## Risks and limits found
- **Pull cursor:** the outbox pull re-reads a 5-second overlap so rows committed after the cursor but stamped earlier are not missed; a write transaction longer than 5 s could still be missed until the next snapshot. Phase A should use a commit-ordered change counter instead.
- **Offline flag:** the server decides the OD-29 cash rules from the device's own `offline` flag; a device that is wrong about its state can only make an online-only movement look offline (refused), not the reverse, unless it lies. Acceptable for staff devices; the role matrix comes in Phase A.
- **PowerSync status semantics:** a stale upload error kept the banner "offline" after sync until the engine was changed to follow the stream connection only. Outbox status is fully ours.
- **Bugs the suite caught in the spike itself:** a timestamp format the browser could not parse made pulls fail after the first booking (fixed in `web/src/rows.ts`); the PostgreSQL 18 publication default above.
- **Not measured:** real mobile networks (the owner's manual run covers a LAN), eviction, battery.

## Owner's manual run (criterion 12)
Pending: [checklist](s1-manual-checklist.md), once per engine.

## Next
1. Owner: manual run (both engines), then approve or change ADR-0031.
2. 0.3-S1e: Flutter probe on both engines; its result confirms or changes the patient-app half of ADR-0031.
3. On approval: ADR-0031 Accepted, ADR-0014 `Status:` line, OD-05 closed, SCH-34 updated.
