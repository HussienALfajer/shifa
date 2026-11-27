# A-03-03 Name normaliser and patient search

Status: Planned · Tier: T0 · Branch: `feat/A-03-03-normaliser-and-search`
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 4–6; from A-03-01: criteria 21, 24 · Requirements: CLN-40 · Decisions: ADR-0030, ADR-0034, OD-40, OD-42, OD-145

Second API slice of A-03, after A-03-02. Three checkpoints: normaliser, search, benchmark and ADR.
Contract: delivers the rows of the A-03 screen contract that name this slice, each proven by a contract test (ADR-0047).

## Goal
One search box finds a clinic's active charts by name however it was spelled, by phone, by file number and by previous file number, inside the tenant's RLS, within 150 ms at p95 at 50,000 charts per clinic.

## Plan
### Checkpoint 1 — the normaliser in production
- The ADR-0034 normaliser moves from `spikes/s3-arabic-output` into a shared package (`@shifa/contracts` `name-key.ts`) and a Dart port (`packages/shifa_testing` or a small `shifa_name_key` package used by the offline clients), with `name-search-vectors.json` moved beside it as the contract.
- The backlog gaps as the owner decided them (OD-145, 2026-11-27): U+061C, U+2060 and every other format character (Cf) removed like the bidi controls; Latin letters lower-cased over the whole Latin range without locale rules (backlog "Normaliser gaps", "Search folding loose ends"; amends OD-40's ASCII-only rule, recorded in the ADR); the vectors gain those cases and ؤ, digit and NFC variants, vectors first, then every port. CI runs the vectors on both ports; the SQL port stays a drift check in tests only.
### Checkpoint 2 — tokens and search
- **Database** (`/db-migration`, `/rls-policy`; expand + migrate): `patient_name_token` (tenant_id, patient_id `(tenant_id, patient_id)` FK, token, key version; FORCE RLS, isolation case), written by the chart repository on every create and edit in the same transaction, and backfilled for charts made in A-03-02; a `(tenant_id, token)` btree for equality matching under RLS (no `LEAKPROOF`, no superuser, no extra service, OD-42). Phone search: digits stored normalised with an index usable for the last 7 or more digits (reversed-digits key or a suffix column, chosen by the plan check). `pg_trgm` similarity ranks the matched rows only.
- **Contracts** — `PatientSearchRequest` (term in the body only, `includeArchived` honoured for the owner), `PatientSearchResult` (at most 20, best first: display name, file number, age fields, sex, contact phone, family size, `state`, `matchedBy`).
- **API** — `POST /patients/search` (`patients.view`); order: exact file or previous number, then phone, then name rank; a merged chart's number answers the chart it was merged into, marked `merged` (A-03-08 makes the state reachable; tested here with a fixture row); a per-member rate limit (429 `rate_limited`); search writes no read audit; the term is never logged (leak test).
### Checkpoint 3 — benchmark and ADR
- Benchmark test at 50,000 synthetic charts in each of two clinics, under `shifa_app` behind PgBouncer (the 0.3-S2 pooling harness): search by name, phone tail, file number, and the duplicate-check query shape A-03-04 will use, p95 ≤ 150 ms; `EXPLAIN` asserts the token index is used.
- ADR-0052 "Patient name search on a token table" amending ADR-0034 (closes its OD-42 consequence).
Searchable custom field values join this search in A-03-06.

Tests written first: vectors on TypeScript and Dart, the new gap cases (6); one test per search path: name variants from the vectors, any part order, phone formats and last 7+ digits, file number, previous number (4); archived only for the owner with the flag, merged number leads to the kept chart, the 20 cap and the order (4); tokens rewritten on edit and backfilled; isolation case for the token table; term absent from logs, spans and URLs; rate limit; the benchmark and plan check (5).
Estimated hand-written lines: ~3,900 (normaliser and Dart port ~600, vectors ~150, database ~450, search service and route ~900, benchmark ~350, ADR ~120, tests ~1,330).

## From A-03-01 (re-plan, 2026-11-27)
- Where this file's earlier plan names a route, field or code differently, the [contract](../specs/patients/A-03-screen-contract.md) wins.
- Contract rows ([contract](../specs/patients/A-03-screen-contract.md)): `POST /patients/search` (results, `truncated`, term lengths, 429 `rate_limited`, `includeArchived` for the owner) with `matchedBy` and `matchedParts` (improvement 1).
- Criteria added: 21, 24.
- Components: none (API slice).
- The merge picker's `excludeId` and `activeOnly` are owned by A-03-08.
- New estimate: ~4,130 (normaliser and Dart port ~600, vectors ~150, database ~450, search service and route ~1,130, benchmark ~350, ADR ~120, tests ~1,330); about 130 over the budget, so the PR may split by the budget (ADR-0032).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Benchmark p95 per path: <figures>
- Reviewer and security-reviewer findings fixed: <list>

## Notes for the next session
- Keep the candidate query of A-03-04 on the same token index: it is measured here.
