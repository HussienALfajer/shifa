# A-03-05 Custom field definitions and their limit

Status: Planned · Tier: T0 · Branch: `feat/A-03-05-custom-field-definitions`
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 14, 15, 17 (definitions, archive, restore, purge), 20 (field events); from A-03-01: criteria 37, 38, 39 · Requirements: PLT-13, PLT-30 to PLT-36 (definitions; print stored) · Decisions: ADR-0008, OD-144

Fourth API slice of A-03, after A-03-04.
Contract: delivers the rows of the A-03 screen contract that name this slice, each proven by a contract test (ADR-0047).

## Goal
The owner adds, edits, orders, archives and restores up to 20 administrative fields for the clinic's charts; the limit is enforced and reported, and archived fields are purged after 30 days.

## Plan
1. **Contracts** — `PatientFieldType` (text, long text, number, date, single choice, multiple choice, yes/no, phone), `PatientFieldDefinition` (key `cf_…`, Arabic label, English label, type, required, validation by type: length or range, a text pattern; default, options ≤ 250 each with state, view roles, edit roles, section title and order, sensitive, searchable, `printable`, state, `archivedAt`, `purgeAt`), create and update requests (type fixed after creation); codes 409 `limit_reached`, `searchable_limit`, `sensitive_not_searchable` (400), `field_type_fixed`.
   - The value validator shared by browser and server (per type and validation) lives in `@shifa/contracts`; A-03-06 applies it to values.
2. **Database** (`/db-migration`, `/rls-policy`; expand only)
   - `patient_field` (tenant_id, id, key unique per tenant and never reused, labels, type, rules jsonb with a schema check, section, order, view and edit role keys, sensitive, searchable, printable, state, archived_at, created/updated by and at) and `patient_field_option` (tenant_id, field_id, id, label, order, state): FORCE RLS, isolation cases; a CHECK that a sensitive field is not searchable. Keys are generated server-side; a used key stays reserved after purge (tombstone row).
3. **API** (`modules/patients/fields`)
   - `GET /clinic/patient-fields` (`patients.fields.manage`; support read), `POST`, `PATCH /clinic/patient-fields/:id`, `PUT …/order`, `POST …/:id/archive` and `/restore` (within 30 days), options added, renamed, ordered and archived, never deleted.
   - `limits.custom_fields` (A-02-03 limits under the advisory lock): active fields plus those archived within 30 days; one more answers 409 `limit_reached`; `used` filled in `GET /clinic/capabilities` and the super admin's entitlements (it read null until now). At most 5 searchable (409 `searchable_limit`).
   - Purge job on the injected `Clock`: after 30 days an archived field's values are removed (A-03-06 adds the value table to it) and it stops counting; audit `patient_field.purged`.
   - Audit: `patient_field.created`, `.edited` (changed keys), `.archived`, `.restored`, `.purged`; no labels or values in audit, logs or errors.
4. **Web, Flutter** — none.
5. **End-to-end** — none.

Tests written first: every type with its validation rules and defaults; type fixed after creation; options ≤ 250, renamed and archived, never deleted (14); limit 409 at 21 counting archived within 30 days, use reported in capabilities and to the super admin, searchable 409 at 6, sensitive and searchable refused (15); archive, restore on day 29, purge on day 31 on a fake clock, key never reused (17); audit rows per event without labels (20); route matrix (owner, support read); isolation cases.
Estimated hand-written lines: ~3,300 (contracts and validator ~700, database ~400, API ~1,000, purge ~200, tests ~1,000).

## From A-03-01 (re-plan, 2026-11-27)
- Where this file's earlier plan names a route, field or code differently, the [contract](../specs/patients/A-03-screen-contract.md) wins. Superseded names: `/clinic/patient-fields[/:id]` → `/patients/fields` (the member's view), `/patients/fields/definitions` (the owner's view) and `/patients/fields/:key`; `field_type_fixed` → 400 `type_fixed`; 400 `sensitive_not_searchable` → 400 `validation_failed` on `body.searchable`; `printable` → `print`; the order route takes `expectedUpdatedAt` and refuses a move across sections.
- Contract rows ([contract](../specs/patients/A-03-screen-contract.md)): `GET /patients/fields` (the member's view for the form); `GET /patients/fields/definitions` (the owner's view with `limits`); `POST /patients/fields`, `PATCH /patients/fields/:key` (`type_fixed`, `expectedUpdatedAt`), `PUT /patients/fields/order`, archive and restore; the `limits.custom_fields` use for the settings link.
- Criteria added: 37, 38, 39.
- Components: none (API slice).
- The custom expression is checked with a safe engine and a length cap (gap 18); the library is chosen in the plan and checked against the 24-hour package rule.
- New estimate: ~3,940 (contracts and validator ~800, database ~420, API ~1,250, purge ~200, safe pattern check ~200, tests ~1,070).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Reviewer and security-reviewer findings fixed: <list>

## Notes for the next session
- <only what is needed to resume>
