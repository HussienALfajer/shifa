# Spike S1 result: offline sync engine — PowerSync vs custom outbox

Status: Automated runs done (2026-11-16), Flutter probe (0.3-S1e) passed locally on both engines; owner's manual run and the probe's CI dispatch pending · Spec: [0.3-S1](../specs/spikes/0.3-s1-offline-sync.md) · Slice: [0.3-S1](../slices/0.3-s1-offline-sync-spike.md) · Decision: [ADR-0031](../adr/0031-offline-sync-custom-outbox.md) (Proposed)

## Answer
Both engines met every automated criterion on the reception scenarios with the same server command handler: no lost or duplicated command after two simulated hours offline, on a degraded link, across token expiry and across a browser restart. They differ in cost, not in correctness. The **custom outbox** is recommended for reception (web) and for the patient app (the Flutter probe, 0.3-S1e, passed on both engines with similar code size, so it does not change the choice): about one tenth of the web bundle, no extra service to run, and the database's row-level security stays the only tenant boundary. PowerSync would add a service with a replication role that bypasses RLS, so its sync-stream filters become a second tenant boundary to maintain. This is also the spec's default when the result is inconclusive.

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
| 11 | Flutter probe: cached reads offline, SQLCipher, offline cancel syncs once | Pass | Pass | [0.3-S1e](../slices/0.3-s1e-flutter-probe.md): `flutter_probe/test/` (4 tests per engine, `flutter test` on the Windows host against the scenario stack); CI dispatch on Linux pending |
| 12 | Owner's 2-hour manual run on two devices | Pending | Pending | [checklist](s1-manual-checklist.md) |
| 13 | This report, ADR-0031 | Done (Proposed) | | reviewer and security-reviewer before the PR |

Red proof: two deliberately broken engines fail the suite. One drops every tenth command: 142 of 157 received in the two-hours run, 151 of 158 on the degraded link, 9 of 10 after re-login. The other replays each batch without idempotency keys: 20 of 10 after re-login, and the two-hours run never settles.

Survival on tab close / browser restart (edge case): a persistent Chromium profile closed while offline and reopened offline kept **8 of 8** queued commands on both engines, opened from the service worker's cached shell, and synced all 8 once. Not tested: browser storage eviction under storage pressure (IndexedDB and PowerSync's IndexedDB-backed SQLite are both "best effort" storage unless `navigator.storage.persist()` is granted; Phase A should request it).

## Flutter probe (criterion 11, slice 0.3-S1e)
- Toolchain: Flutter 3.47.9 (Dart 3.13.7). One SQLite build for both engines: `sqlite3` 3.9.1 with the SQLCipher community edition from its build hook (`hooks.user_defines.sqlite3.source: sqlcipher`; the hook downloads a sha256-pinned binary from the package's GitHub release). `sqlcipher_flutter_libs` and `powersync_sqlcipher` are end-of-life, so neither is used.
- Outbox: drift 2.35.4 **without code generation** (hand-written `GeneratedDatabase`, plain SQL, drift table-update notifications for the screen's streams); pull through `/sync/pull`, queue uploaded to `/commands`.
- PowerSync: `powersync` 2.6.1 with `EncryptionOptions` (the SDK detects the SQLCipher variant and issues the same `PRAGMA key`); reads through drift via `drift_sqlite_async` 0.3.1, which works on the pinned Flutter (PowerSync's internal table names are mapped to their views). New sync stream `patient_tickets`; uploads go to the same `/powersync/upload` handler.
- Key: 32 random bytes per install in `flutter_secure_storage` 11.2.0 (tests: an in-memory store), used as a hex passphrase. Logout closes, deletes the database files and deletes the key.
- Results, both engines: cached appointments and ticket readable after an offline restart, status offline, no other patient's rows (also checked on the pull and the raw PowerSync stream in `tenant-scoping.spec.ts`); the file does not open without the key or with a wrong one, holds no plain text of a known value, and `PRAGMA cipher_version` answers; an offline cancel survives a restart and one failed flush, then reaches the server once (report: 1 command, 1 applied); cancelling another patient's appointment is refused and changes nothing; logout leaves no file and no key. Red proof: an unencrypted stub fails the encryption and logout tests; a stub that drops its queue on restart fails the cancel test.
- Size (Windows x64 native libraries): SQLCipher 4.77 MiB for both engines; PowerSync adds its core extension (0.41 MiB) and `sqlite3_connection_pool` (33 KiB). Android and iOS app sizes were not measured (no device build in the probe).
- Code: outbox engine 331 lines (engine + store); PowerSync engine 291 lines (engine + connector + schema) plus one sync stream. On mobile the two engines cost about the same to write; the difference stays the server side (service, replication role, second tenant boundary).
- `flutter test` on the desktop host was enough: no `integration_test/` or emulator fallback was needed.

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
- **Offline flag (review fix):** the server decides the OD-29 cash rules from the command's `offline` flag. A device can believe it is online for a few seconds after the link drops, so online-only cash actions (open, close, expense, deposit, float adjustment) are never queued: the prototype sends them directly and shows an Arabic error when there is no answer. Only sales and refunds go through the queue.
- **Device binding (review fix):** the device id is bound into the token at login; the server refuses commands naming another device, and PowerSync streams a device's results by the token's claim, not a client-chosen parameter (`server/test/device-binding.test.ts`).
- **Degraded link wording:** Toxiproxy's `reset_peer` with toxicity 0.3 resets 30% of *connections*, not 30% of packets; with keep-alive the effective loss is lower. Combined with 2 s latency and the cut mid-upload it still exercised retries and idempotency.
- **Re-login:** the spike's login needs no password (synthetic users), so criterion 9 proves that an expired token blocks sync and that the queue survives, not real re-authentication.
- **PowerSync status semantics:** a stale upload error kept the banner "offline" after sync until the engine was changed to follow the stream connection only. Outbox status is fully ours.
- **Bugs the suite caught in the spike itself:** a timestamp format the browser could not parse made pulls fail after the first booking (fixed in `web/src/rows.ts`); the PostgreSQL 18 publication default above.
- **Not measured:** real mobile networks (the owner's manual run covers a LAN), eviction, battery.

## Owner's manual run (criterion 12)
Pending: [checklist](s1-manual-checklist.md), once per engine.

## Next
1. Owner: manual run (both engines), then approve or change ADR-0031.
2. 0.3-S1e: done locally on both engines (confirms the patient-app half of ADR-0031); dispatch `s1-offline` with `flutter=true` after the merge for the Linux run.
3. On approval: ADR-0031 Accepted, ADR-0014 `Status:` line, OD-05 closed, SCH-34 updated.
