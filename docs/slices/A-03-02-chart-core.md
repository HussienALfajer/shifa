# A-03-02 Chart core: registration, file number, edit, archive

Status: Built, in review · Tier: T0 · Branch: `claude/jolly-hawking-4nj8kv` (the cloud session's branch; planned as `feat/A-03-02-chart-core`)
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 1–3, 12 (identity part), 13, 20 (created, edited, archived, restored); from A-03-01: criteria 22, 28, 32 · Requirements: CLN-01 (identity), CLN-39, CLN-44, PLT-07, PLT-08 (per-clinic chart) · Decisions: ADR-0006, ADR-0031, OD-136, OD-137, OD-143

First API slice of A-03, after the design slice [A-03-01](A-03-01-design-and-screen-contract.md) (approved). Schema changes of A-03 are serialised: A-03-02 → 03 → 04 → 05 → 06 → 07 → 08.
Contract: delivers the rows of the A-03 screen contract that name this slice, each proven by a contract test (ADR-0047); a change forced during the build updates the row and its drawing and is reported to the owner.

## Goal
Reception registers a chart with its identity, gets the clinic's next file number, opens and edits it; the owner archives and restores it. The chart is the frame every later A-03 slice and spec adds to.

## Plan
1. **Contracts** — `PatientNameParts` (each part 1–40: Arabic or Latin letters, space, hyphen, apostrophe; the shared rule used by browser and server), `Sex`, `BirthInput` (date, or age in years, or months under 2), `CreatePatientRequest` (client `id` uuid, names, `contactPhone` and `secondPhone` through the A-01 normaliser, +963 and +90; `previousFileNumber`), `UpdatePatientRequest`, `PatientChart` (identity, `displayName`, `fileNumber`, `ageLabel` source fields, `birthDateEstimated`, `registeredBranch`, `state` `active | archived | merged`, `mergedInto`); codes `previous_file_number_taken`, `patient_archived`.
2. **Database** (`/db-migration`, `/rls-policy`; expand only)
   - `patient` (tenant_id, id uuid chosen by the client, file_number, previous_file_number with a trimmed unique per tenant, given, father, family, mother names, contact and second phone E.164, sex, birth_date, birth_date_estimated, registered_branch_id `(tenant_id, branch_id)` FK, state, merged_into_id, relation (nullable; used by A-03-04), created/updated by and at): ENABLE + FORCE RLS, classification `patient` (personal), isolation case direct and pooled; `(tenant_id, id)` unique as the target of every later chart FK (backlog "Patient ids on commands"); CHECK lengths on every text column.
   - `patient_file_counter` (tenant_id PK, next): FORCE RLS; numbers taken by `UPDATE … RETURNING` in the create transaction, so a failed save rolls its number back and concurrent creates never share one.
   - Synthetic generator in `@shifa/testing` gains charts of this shape (names from its lists, family phones, ages and estimated dates).
3. **API** (`modules/patients`; `/add-endpoint` for each route)
   - Permissions `patients.view`, `patients.manage`, `patients.archive`, `patients.merge`, `patients.fields.manage`, `patients.read_log.view` in the catalogue, granted per the spec's table (accountant view only; support session read).
   - `POST /patients` (create; a replay with the same `id` and body returns the stored chart, another body with that id 409), `GET /patients/:id` (identity summary; no read audit yet, A-03-07), `PATCH /patients/:id` (same checks; refused on an archived or merged chart 409 `patient_archived`), `POST /patients/:id/archive` and `/restore` (owner).
   - Age to estimated birth date on an injected `Clock` (Damascus day); an exact date later clears the flag.
   - Audit: `patient.created`, `patient.edited` (changed field keys only), `patient.archived`, `patient.restored`; no name, phone, date or previous number in audit, logs, spans or errors.
4. **Web, Flutter** — none (UI code slices A-03-09 and A-03-10).
5. **End-to-end** — none; API tests only.

Tests written first: name part rules and display name (1); both phone countries and the second phone (1); age in years and months to an estimated date, exact date clears the flag (1); 20 concurrent creates give 20 distinct consecutive numbers, a failed save uses none, the counter is per clinic (2); previous number unique after trimming, 409 (2); replayed create returns the stored chart, a different body 409 (3); edit and its audit keys, edit refused on archived (12, 13); archive and restore owner only, never deleted (13); route matrix for the six permissions by role, support read-only; isolation cases for both tables; leak test (no name or phone in logs, spans, errors, audit).
Estimated hand-written lines: ~3,700 (contracts ~350, database ~500, generator ~200, API ~1,150, tests ~1,500).

## From A-03-01 (re-plan, 2026-11-27)
- Where this file's earlier plan names a route, field or code differently, the [contract](../specs/patients/A-03-screen-contract.md) wins; also `archivedAt` and `archivedByName` on the summary, `archived` in `GET /patients/count`, and `expectedUpdatedAt` with 409 `stale` on edit, archive and restore. `GET /patients/:id` has no read audit until A-03-07; no screen reads a chart before A-03-09, which comes after A-03-07, so no unaudited read reaches a person (`.claude/rules/patient-data.md`).
- Contract rows ([contract](../specs/patients/A-03-screen-contract.md)): `GET /patients/count` (page line, first patient); `POST /patients` (create, replay, `previous_file_number_taken`, `failed` retry with the same id); `GET /patients/:id` identity part with `registeredBranch`, `createdAt`, `createdByName`, `updatedAt`, `updatedByName`; `PATCH /patients/:id` with `expectedUpdatedAt` and 409 `stale`; `POST /patients/:id/archive` and `/restore` with `expectedUpdatedAt`.
- Criteria added: 22, 28 (edit and archive), 32.
- Components: none (API slice).
- Moved out: `permissions[]` in the session and `allowed` on the summary go to A-03-07, which owns visibility, so this slice stays inside the ~4,000 budget.
- New estimate: ~3,990 (contracts ~380, database ~520, generator ~200, API ~1,330, tests ~1,560).

## Built (2026-11-27)
- **Contracts** (`packages/contracts/src/patients.ts`): `isPatientNamePart` (Arabic or Latin letters with their marks, space, hyphen, apostrophes; at least one letter; the shared rule), `patientDisplayName`, `Sex`, `AgeUnit`, `PatientAge` (2–130 years or 0–23 months), `PatientState`, `PatientChart`, `CreatePatientRequest` (a date of birth or an age, exactly one), `UpdatePatientRequest` (`expectedUpdatedAt`; not both), `PatientStateChangeRequest`, `PatientCount`; codes `previous_file_number_taken`, `patient_id_taken`, `patient_archived`, `patient_not_archived`, `patient_merged`, `stale` (with `StaleChange`: `updatedAt`, `updatedByName`).
- **Database** (expand only): `20261127153450_a03_patients` (tables) and `20261127153456_a03_patient_policies` (ENABLE + FORCE RLS, tenant policies, grants). `patient`: primary key `(tenant_id, id)` (the target of every later chart foreign key; the same client id may exist in two clinics, so an id never reveals another clinic's chart), unique `(tenant_id, file_number)` and `(tenant_id, previous_file_number)` (stored trimmed), composite foreign keys to `branch` and to itself (`merged_into_id`), CHECKs on every text column, state, archive and merge consistency. `patient_file_counter`: one row per clinic, taken by an upsert inside the registration's transaction. shifa_app holds SELECT, INSERT, UPDATE on both and no DELETE (charts are never deleted; pinned in `test/privileges.test.ts`). Rollback: drop the policies, disable RLS, revoke the grants; the tables go with a contract migration.
- **Generator**: `generatePatientCharts({ random, count, today })` in `@shifa/testing` (families of one to four on a shared synthetic phone and family name, exact dates or typed ages with their estimated dates). The name lists are now typed `readonly string[]` (their literal types were unused).
- **API** (`modules/patients`): the six permission keys and their grants; `GET /patients/count`, `POST /patients`, `GET /patients/:id`, `PATCH /patients/:id`, `POST /patients/:id/archive`, `POST /patients/:id/restore`; audit `patient.created`, `patient.edited` (changed keys as `true` only), `patient.archived`, `patient.restored`. `PermissionCheck` in `src/access/` answers the count's second key (`patients.archive`) by the guard's rule.

### Decisions taken during the build (reported to the owner)
- **Registered branch:** the session's active branch; a member with a clinic-wide role and no active branch registers in the clinic's only active branch, or in none (`registeredBranch: null`) when the clinic has several. The contract row's `registeredBranch` is therefore nullable.
- **Replay:** a SHA-256 of the parsed request (keys sorted) is kept on the chart (`create_hash`); the same id and body answers 201 with the stored chart and takes no number; another body with that id answers 409 `patient_id_taken` (a new code; the plan said only "409"). Two saves of one id at once give one chart.
- **Stale:** `updatedAt` is written by the API at millisecond precision and always moves forward, so `expectedUpdatedAt` compares exactly. Edit and archive check the state first (`patient_merged`, `patient_archived`), then `stale`; restore checks `patient_not_archived`, then `stale`.
- **An edit that changes nothing** answers the chart unchanged, with no audit row and the same `updatedAt`.
- **Create status:** a replay answers 201 like the first save (one status per route).
- **Dates on the wire:** `birthDate` is a `YYYY-MM-DD` string (as in `platform.ts`; generated clients turn `format: date` into a timestamp); an input date must exist (no 30 February).
- **Support session and the count (question for the owner):** a support session answers every GET as the owner does (A-02 rule), so `GET /patients/count` shows it the archived count too. The spec's table gives support "–" for archive (a write); kept as is unless the owner wants `archived: 0` there.
- **Dart client budget** raised to 430 files and 16,600 lines (`scripts/drift.config.mjs`, with its reason): this slice took it to 285 files and 11,072 lines.
- **Locked tests:** four `no-unused-vars` errors and one import order in three locked tests were fixed after the owner unlocked them (no assertion changed); their type errors were fixed in the implementation instead (`birthOf` overloads, the list types).

## Stopped at
Built, reviewed and verified; PR open. Locked tests: the owner unlocked three of them on 2026-11-27 for a lint-only fix (no assertion changed); relocked, then cleared when the PR opened.

## Evidence
- Patient tests: `vitest run test/patients test/telemetry/patients-leak.test.ts` → 4 files, 36 tests passed (registration, edit and archive, birth, leak).
- API suite: 130 files, 934 tests passed (after moving the metrics test's unrouted probe off `/patients/…`).
- DB suite: 64 files, 471 tests passed (RLS presence, isolation direct and pooled with `patient` and `patient_file_counter`, privileges).
- Contracts: 87 tests passed; testing: 238 tests passed; drift `--full`: every check CLEAN.
- `pnpm verify` (fast, final tree): every step green except two that timed out under the parallel load, and both passed when run again alone: `route-matrix.test.ts` (setup hook over 90 s; alone 9 of 9 in 30 s) and one e2e journey (`account-clinics.spec.ts` (4), an axe check on a page this slice does not touch; alone the whole e2e run: 33 of 33). The Docker-backed suites ran in the session (OD-83); CI's `verify (full)` is the gate. `verify:full` locally was not run in full; its drift step (`check-drift --full`) is CLEAN.
- Reviewer (fresh context): 1 blocking, fixed: a merged chart refuses edit and archive (409 `patient_merged`) and restore (409 `patient_not_archived`), and its summary leads to the kept chart. 3 low, fixed: answers parsed with the contract schemas; the registering-branch rule tested (branch-scoped, the only branch, none of several); six saves of one id give one chart and take one number. All in `test/patients/review.test.ts`. Its question (the archived count in a support session) is a decision above, for the owner.
- Security reviewer: M1 (a no-op edit or a replay answers the chart without an audit row; the 409 `stale` body gives the `updatedAt`) recorded in the A-03-07 plan ("From A-03-02"): the visibility predicate on every chart lookup and a read row for those answers. L1 fixed (no control, format or invisible characters in the previous number; 400 instead of a 500 on NUL). L2 fixed (the leak test runs in the telemetry project, so it sees query spans). L4 fixed (archive and restore of another clinic's chart: 404). Deferred to `docs/backlog.md`: L3 (a keyed replay hash before A-05) and the two older leak tests outside the telemetry project.
- Patient tests after the fixes: 5 files, 43 tests passed.

## Notes for the next session
- Keep the chart repository the only writer of `patient`: A-03-03 adds the name tokens to the same write path.
