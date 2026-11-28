# A-03-07 "My patients only" and the chart-read audit

Status: Planned · Tier: T0 · Branch: `feat/A-03-07-my-patients-and-read-audit`
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 11, 18, 19; from A-03-01: criteria 23, 25, 33, 36, 41 · Requirements: CLN-27, CLN-45, PLT-44, PLT-47 · Decisions: OD-140, OD-141, ADR-0050

Sixth API slice of A-03, after A-03-06 (the read row records whether sensitive fields were included).
Contract: delivers the rows of the A-03 screen contract that name this slice, each proven by a contract test (ADR-0047).

## Goal
The owner can limit doctors to the charts that list them, and sees on each chart every opening with person, role, branch and time, support sessions included.

## Plan
1. **Contracts** — `ChartReadEntry` (person name, role keys, branch, `at`, `support` with the super admin's name), `ChartReadPage` (50 per page, newest first, cursor); `DuplicateCandidate` gains the hidden shape (file number only, `hiddenByDoctorList: true`).
2. **Database** (`/db-migration`; expand only) — an index on `audit_event (tenant_id, target_id, at)` for `patient.chart_viewed` reads (partial on the event), or a `patient_read` table if the plan check shows the audit table cannot serve it; the choice and its reason recorded here. Append-only either way.
3. **API**
   - Setting `patients.my_patients_only` in the settings catalogue (boolean, default off, overridable by `organization`, lockable; `clinic.settings.manage`), resolved through the A-02 cascade.
   - One visibility predicate used by search, family, duplicates and the summary: a member whose roles in the clinic grant doctor but not owner sees only charts listing them; a direct read answers 404 `not_found`; candidates outside the list show the hidden shape. An owner who is also a doctor sees all.
   - `GET /patients/:id` writes exactly one `patient.chart_viewed` row (actor, role keys, branch, chart id, `sensitiveIncluded`) in the read's transaction; in a support session the row is marked support (A-02 criterion 14); search, family and duplicate checks write none.
   - `GET /patients/:id/reads?cursor=` (`patients.read_log.view`; owner, support read).
4. **Web, Flutter** — none.
5. **End-to-end** — none.

Tests written first: route matrix with the setting on and off for search, family, summary (404) and candidates; owner-doctor sees all; a doctor added to the list sees the chart at once (11); one read row per summary read, none for search, family or candidates; `sensitiveIncluded` by role; support marking (18); log paging by 50, order and contents, support shown with the super admin's name (19); a failed read writes no row; plan check of the log query.
Estimated hand-written lines: ~2,900 (contracts ~200, database ~150, setting and predicate ~700, read audit and log ~650, tests ~1,200).

## From A-03-01 (re-plan, 2026-11-27)
- Where this file's earlier plan names a route, field or code differently, the [contract](../specs/patients/A-03-screen-contract.md) wins. Superseded names: `ChartReadPage` with a cursor and `GET /patients/:id/reads?cursor=` → page numbers (`page`, `pageSize`: 5 on the card, 50 on the full log) with `total`, `supportTotal` and `sensitiveIncluded`; `hiddenByDoctorList: true` → `visible: false`. Added: `limitedToMyPatients` in the search and count answers (a doctor cannot read `GET /clinic/settings`). The one visibility predicate also covers `GET /patients/count`, `familySize` in search results, `GET /patients/recent` and `GET /patients/:id/merge-preview`. Criterion 33 gets an API test: `GET /patients/:id`, then `GET /patients/:id/reads` holds that opening. The impact route returns numbers only (`ownerDoctors` is a count).
- Contract rows ([contract](../specs/patients/A-03-screen-contract.md)): `permissions[]` in `GET /auth/session` and `allowed` on the summary (moved here from A-03-02); the hidden candidate shape and 404 for hidden charts; `GET /patients/:id/reads` (card and full log: page numbers, `sensitiveIncluded`, `support=only`, `supportTotal`); `GET /patients/recent` (improvement 2); `patients.my_patients_only` in the settings cascade; `GET /patients/my-patients/impact` (improvement 7).
- Criteria added: 23, 25, 33, 36, 41.
- Components: none (API slice).
- New estimate: ~3,510 (contracts ~300, database ~150, setting and predicate ~700, permissions and `allowed` ~300, read audit and log ~730, recent ~130, impact ~100, tests ~1,100).

## From A-03-02 (security review M1, 2026-11-27)
- Every answer that carries a `PatientChart` reads a chart, not only `GET /patients/:id`: an edit that changes nothing (200 with the chart, no audit row; the 409 `stale` body gives the `updatedAt` it needs), the archive, the restore and a replayed create. This slice must:
  - apply the one visibility predicate wherever a chart is looked up (`findChart` in `modules/patients/charts.ts`), so `PATCH /patients/:id`, archive, restore and a replay answer 404 `not_found` for a hidden chart, and a limited doctor learns nothing from 409 `stale` about a chart they cannot see;
  - write `patient.chart_viewed` for every answer carrying a chart that has no audit row of its own (the no-op edit, the replay), or answer them without the chart.
- Tests: one per route above with "my patients only" on (404) and one read row per no-op edit and replay.

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Reviewer and security-reviewer findings fixed: <list>

## Notes for the next session
- From A-03-06 (security review, informational): every `PatientChart` answer now carries custom field values, sensitive ones included, with no `patient.chart_viewed` row yet. Derive `sensitiveIncluded` from what `chartFieldsOf` returned, and decide whether the create, edit, archive and restore answers count as reads.
- From A-03-06: the custom field search path (`byFieldValue` in `modules/patients/fields/field-values.ts`) must apply "my patients only" as the other search paths do.
