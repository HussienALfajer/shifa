# A-03-02 Chart core: registration, file number, edit, archive

Status: Planned · Tier: T0 · Branch: `feat/A-03-02-chart-core`
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 1–3, 12 (identity part), 13, 20 (created, edited, archived, restored) · Requirements: CLN-01 (identity), CLN-39, CLN-44, PLT-07, PLT-08 (per-clinic chart) · Decisions: ADR-0006, ADR-0031, OD-136, OD-137, OD-143

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
- Contract rows ([contract](../specs/patients/A-03-screen-contract.md)): `GET /patients/count` (page line, first patient); `POST /patients` (create, replay, `previous_file_number_taken`, `failed` retry with the same id); `GET /patients/:id` identity part with `registeredBranch`, `createdAt`, `createdByName`, `updatedAt`, `updatedByName`; `PATCH /patients/:id` with `expectedUpdatedAt` and 409 `stale`; `POST /patients/:id/archive` and `/restore` with `expectedUpdatedAt`.
- Criteria added: 22, 28 (edit and archive), 32.
- Components: none (API slice).
- Moved out: `permissions[]` in the session and `allowed` on the summary go to A-03-07, which owns visibility, so this slice stays inside the ~4,000 budget.
- New estimate: ~3,990 (contracts ~380, database ~520, generator ~200, API ~1,330, tests ~1,560).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Isolation suite: <summary line>
- Reviewer and security-reviewer findings fixed: <list>; deferred to backlog: <list>

## Notes for the next session
- Keep the chart repository the only writer of `patient`: A-03-03 adds the name tokens to the same write path.
