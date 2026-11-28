# A-03-06 Custom field values on charts

Status: Planned · Tier: T0 · Branch: `feat/A-03-06-custom-field-values`
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 4 (searchable values), 16, 17 (archived field not required, archived option kept, values purged); from A-03-01: criteria 40 · Requirements: PLT-30 to PLT-36 (values) · Decisions: ADR-0008, OD-144

Fifth API slice of A-03, after A-03-05.
Contract: delivers the rows of the A-03 screen contract that name this slice, each proven by a contract test (ADR-0047).

## Goal
Reception fills the clinic's fields on registration and edit; each member sees and edits only the fields their roles allow; sensitive values stay in the summary; searchable values join the search box.

## Plan
1. **Contracts** — `customFields` on `CreatePatientRequest`, `UpdatePatientRequest` and `PatientChart` (by key, grouped by section on read), validated with the A-03-05 validator against the current definitions; code 403 `field_not_editable`.
2. **Database** (`/db-migration`, `/rls-policy`; expand only)
   - `patient_field_value` (tenant_id, patient_id `(tenant_id, patient_id)` FK, field_id, value jsonb with a size CHECK, updated by and at): FORCE RLS, isolation case; a chart foreign key for A-03-08's merge registry.
   - `patient_search_value` (tenant_id, patient_id, field_id, normalised key): FORCE RLS, isolation case; written with the value for searchable fields only, rewritten when a field becomes or stops being searchable.
3. **API**
   - Values written in the chart's create and edit transaction: required fields (active ones only), defaults, choices among active options (an archived option a chart holds stays and is not offered), phone values through the A-01 normaliser.
   - View stripping in one place (the chart serialiser): a field a member's roles cannot view is absent from every answer; writing one they cannot edit answers 403 `field_not_editable`. Sensitive values appear only in `GET /patients/:id`, never in search results, families, duplicate candidates or lists.
   - Search (A-03-03) gains the searchable values: matched by equality on `patient_search_value`; the benchmark re-run with 5 searchable fields.
   - The A-03-05 purge removes the field's values and search keys.
   - Audit `patient.edited` lists changed custom field keys, never values.
4. **Web, Flutter** — none.
5. **End-to-end** — none.

Tests written first: every type's value validation on the server (the browser uses the same validator, tested in contracts) (16); required and default on create; archived field stops being required; archived option kept and refused anew (17); view stripping and 403 per role on create, edit and every read (16); sensitive absent from search, family and candidates (16); search by a searchable value, a field made unsearchable stops matching (4); purge removes values on a fake clock (17); isolation cases for both tables; leak test (no value or label in logs, spans, errors, audit).
Estimated hand-written lines: ~3,200 (contracts ~250, database ~350, values and stripping ~1,000, search ~350, tests ~1,250).

## From A-03-01 (re-plan, 2026-11-27)
- Where this file's earlier plan names a route, field or code differently, the [contract](../specs/patients/A-03-screen-contract.md) wins. Superseded name: `customFields` → `fields`.
- Contract rows ([contract](../specs/patients/A-03-screen-contract.md)): `fields` in `POST /patients`, `PATCH /patients/:id` and the summary (`field_not_editable`); the `custom_field` search path; `chartCount` per field and per choice (improvement 8).
- Criteria added: 40.
- Components: none (API slice).
- New estimate: ~3,300 (contracts ~270, database ~350, values and stripping ~1,000, search ~350, chart counts ~100, tests ~1,230).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Benchmark p95 with searchable fields: <figures>
- Reviewer and security-reviewer findings fixed: <list>

## Notes for the next session
- From A-03-05 (reviews N8, L3): archived fields are purged only inside the clinic's own requests (`purgeExpired` in `modules/patients/fields/field-store.ts`); a suspended or idle clinic never purges. Every value read must apply the cutoff (`isLive`), `purgeExpired` must also delete the purged fields' values, and chart writes should call it; criterion 17 ("values are removed") needs a worker or another purge path before values are stored for long (backlog "Purge without a worker").
- From A-03-05 (L1): view and edit roles of a value follow `rolesInScope` (tenant-wide roles and the active branch's), as the member's view does.
