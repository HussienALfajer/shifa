# ADR-0031: Offline sync with a custom outbox (command log, idempotency keys, pull endpoint)

Status: Accepted (owner, 2026-11-16; manual run deferred to Phase A, OD-37) · Date: 2026-11-16 · Deciders: product owner (with Claude) · Decides: [ADR-0014](0014-offline-sync-engine.md) (OD-05)

## Context
[ADR-0014](0014-offline-sync-engine.md) left the offline sync engine to spike S1: (a) PowerSync self-hosted or (b) a custom outbox. The spike ([spec](../specs/spikes/0.3-s1-offline-sync.md), [result](../spikes/s1-offline-sync.md)) built one server command handler (idempotency keys, the three conflict rules, OD-29 offline cash rules, RLS) and ran a throwaway reception prototype on both engines through real network cuts with Toxiproxy: two devices offline for two simulated hours, a degraded link with a cut mid-upload, token expiry during the outage, a browser restart offline, and tenant scoping. Both engines passed every automated criterion. They differ in bundle size (35.5 KB of gzipped JS vs 348 KB plus 2.8 MB of SQLite WASM), in operations (PowerSync adds a service, a storage database and logical replication), and in where the tenant boundary sits on the download side (RLS for the outbox; sync-stream filters for PowerSync, whose replication role bypasses RLS).

## Decision
- Reception (clinic-web) and the patient app use a **custom outbox**:
  - Writes are commands with a client UUID as idempotency key, kept in a local queue (IndexedDB on web, drift/SQLite with SQLCipher on Flutter) and uploaded in order to one command endpoint; a stored result is returned for a replayed key.
  - The server is the authority: real queue numbers in arrival order with remaps returned (SCH-16, SCH-32), overlapping bookings returned as conflicts from the exclusion constraint (SCH-14), cash movements append-only and, offline, sales and refunds only at the last synced rate (OD-29, BIL-25).
  - Download is a snapshot plus changes since a cursor, read through `withTenant()`, limited to the branch and today (patients: their own rows). Phase A replaces the spike's time-overlap cursor with a commit-ordered change counter.
  - A network error keeps the queue and retries the same ids; a 401 keeps the queue and waits for a new login; logout deletes the local store.
- The scenario suite (`spikes/s1-offline/scenarios`, workflow `s1-offline`) is kept and pointed at the real reception module in Phase A.
- The patient-app half is confirmed by the Flutter probe (slice 0.3-S1e): both engines passed criterion 11 on Flutter 3.47.9 with about the same code size; the outbox uses drift (no code generation) on `sqlite3`'s SQLCipher build with a random per-install key, and logout deletes the key and the store. For Phase A: put `hooks.user_defines.sqlite3.source: sqlcipher` in the pub workspace root (elsewhere it is ignored and plain SQLite is linked), refuse to open a store when `PRAGMA cipher_version` is empty, keep the key in secure storage with a this-device-only accessibility and exclude the database from backups, and issue device ids per principal on the server. The probe's Linux CI dispatch runs after its merge.
- The owner's 2-hour manual run on two devices (spike criterion 12) is deferred (OD-37): the automated scenarios cover every scripted action on both engines. It runs in Phase A on the real reception module with the same [checklist](../spikes/s1-manual-checklist.md), outbox engine only, before the first clinic pilot.

## Consequences
- No sync service to deploy or upgrade; every read that reaches a device passes RLS like any API read.
- We own the queue, retry and status code (≈ 430 lines in the spike) and its tests; no local SQL query engine on web (rows filtered in JS), which is enough for today's branch data.
- Browser storage is best effort: Phase A requests persistent storage and shows the pending count (SCH-33) so staff notice a lost queue.

## Alternatives considered
- **PowerSync self-hosted (1.28.3, web SDK 2.7.0):** correct in every scenario, with full local SQLite and reactive queries; rejected for now for the bundle size, the extra service and storage, and the second tenant boundary in sync streams with a replication role that bypasses RLS. Revisit if the local data grows beyond today's branch rows or if the Flutter probe shows the custom outbox is much harder on mobile.
- ElectricSQL and Zero: excluded by ADR-0014 (no offline writes).
