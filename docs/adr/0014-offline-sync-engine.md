# ADR-0014: Offline-capable reception and patient app; sync engine chosen by spike

Status: Proposed (blocked by OD-05) · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Aleppo and Azaz suffer power and internet cuts [RN-03 §5]. A clinic that cannot register walk-ins or take cash during an outage will abandon the product. Candidate engines differ in maturity: PowerSync's self-hosted service moved to Apache 2.0 on 2026-11-03 and supports offline writes on web and mobile [RN-16 §4], but its web SDK 2.0 broke compatibility in 2026 [RN-17 §5] and its Flutter drift integration and free self-hosted edition are labelled alpha/beta [RN-19 §B5]. ElectricSQL is read-only sync; Zero 1.0 has no offline writes [RN-16 §4].

## Decision (proposed)
- Offline scope for Release 1 reception (clinic-web): today's appointments and queue, registering walk-ins and new patients, calling patients (with local voice packs), cash receipts and cash-session movements, printing tickets and receipts. Everything else needs connectivity.
- Patient app: read-only cache of own data plus a queue of pending writes (booking requests, profile edits) with idempotency keys.
- Server-side domain conflict rules decide outcomes: queue numbers are reassigned or confirmed by the server on sync; double bookings are rejected by database constraints and surfaced to the receptionist; cash movements are append-only and never conflict.
- Run a Phase 0 spike with real network loss comparing (a) PowerSync self-hosted and (b) a custom outbox (IndexedDB/SQLite command log + idempotency keys + server rules). Criteria: correctness of the three conflict rules, recovery after 2 hours offline, web and Flutter SDK stability, operational load. Default if inconclusive: custom outbox for the narrow scope above.

## Consequences
+ The clinic keeps working during outages; data integrity is guaranteed server-side.
− Offline adds real complexity; scope is deliberately narrow.

## Alternatives considered
- Fully online app: unacceptable in the target environment.
- Local edge server in every clinic: kept as an option for multi-room clinics and imaging (OD-18), not the default.

## Sources
[RN-06 §6], [RN-16 §4], [RN-17 §5], [RN-19 §B5], [RN-03 §5]
