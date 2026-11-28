# A-03-05 Custom field definitions and their limit

Status: Done (PR open) · Tier: T0 · Branch: `feat/A-03-05-custom-field-definitions`
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

## Built (2026-11-28)
Branch: `claude/gracious-goodall-a54lwz` (the cloud session's branch, in place of `feat/A-03-05-custom-field-definitions`).
- **Contracts**: `patient-field-rules.ts` (shared by browser and server: `PATIENT_FIELD_RULES`, `patientFieldRuleProblems` (which validation fits which type, order of min and max, caps 200 for text and 2,000 for long text), `checkPatientFieldValue` (each type's value shape, required, lengths, range, presets, the custom expression matched in full, active choices only), `storedPatientFieldValue`, `checkPatientFieldPattern`), `patient-fields.ts` (the eight types, `PatientFieldDefinition`, `PatientFormField`, `PatientFieldDefinitions` with `limits` and `listUpdatedAt`, create, update and order requests, the seven routes). Codes 400 `type_fixed`, 409 `searchable_limit`; Arabic messages in `@shifa/i18n`.
- **Safe pattern engine**: `re2js` 2.10.0 (MIT, pure JS port of RE2, published 2026-11-10, past the 24-hour rule): linear time, so no expression can backtrack catastrophically; backreferences and lookaround are refused at compile; expressions are capped at 100 characters (criterion 39, gap 18). Added to `@shifa/contracts` and `@shifa/api` (bundle external).
- **Database** (expand only): `20261128074650_a03_patient_fields` (tables `patient_field`, `patient_field_option`; checks: key = `cf_` and the number, type, rules shape and 16 kB, roles a clinic subset with edit roles inside view roles, a sensitive field never searchable, state with `archived_at`/`purged_at`) and `20261128074651_a03_patient_field_policies` (ENABLE + FORCE RLS, tenant policies, `shifa_app` SELECT, INSERT, UPDATE on both: never DELETE; function `tenant_custom_field_count(uuid, bigint)`, SECURITY DEFINER, one integer, in the same platform actions as `tenant_usage_counts()`). Rollback: drop the function, the policies and the grants; the tables go with a contract migration. Classification, `COUNT_FUNCTIONS`, privileges pin and two isolation cases added; `test/patient-fields.test.ts` covers the count and the checks.
- **API** (`modules/patients/fields/`): `field-store.ts` (loading by section in creation order, the owner's and the member's views, the purge), `field-draft.ts` (a create or an edit checked as a whole), `field-writes.ts` (choices and order), `fields.service.ts`, `fields.controller.ts`. Every write takes the clinic's limits lock (`ClinicLimits.lock`), purges first, then checks the label (active fields, folded), the 5 searchable and `limits.custom_fields` (active + archived within 30 days, on the injected clock). `ClinicLimits` gains `limitOf` and `usage`; `usageOf`/`usageInClinic` count custom fields, so `GET /clinic/capabilities`, the subscription card, the super admin's entitlements and the type preview report the use (it read null until now).
- **Routes and access** (route matrix): `GET /patients/fields` every clinic role (`patients.view`); `GET /patients/fields/definitions`, `POST /patients/fields`, `PATCH /patients/fields/:key`, `PUT /patients/fields/order`, `POST …/:key/archive`, `POST …/:key/restore` owner only (`patients.fields.manage`); a support session reads the definitions (support matrix, every GET). No new permission key or grant.
- **Audit**: `patient_field.created`, `.edited` (`changed` keys; a reorder is `changed: ['order']` for each moved field), `.archived`, `.restored` (actor the owner), `.purged` (no actor: the clock decided); data `key` and changed keys only, never a label.
- **Decisions in the build** (reported to the owner):
  - The purge runs inside the clinic's own requests, not as a job: every field write and every fields read outside a support session purges first, and every read and count treats a field archived 30 days ago as gone even before. There is no worker yet (backlog "Purge without a worker"); A-03-06 adds the value deletion to `purgeExpired`.
  - A purged field stays as a tombstone row (`state = 'purged'`) so `cf_<n>` (the clinic's next number) is never given again.
  - A choice field's default is sent as the choice's label (or its id on edit) and answered as option ids; archiving a choice drops it from the default.
  - `order` in answers is the place within the section in the listed order; the order route rewrites positions of the active fields and puts archived ones after them; `listUpdatedAt` (newest save of a live field) is its `expectedUpdatedAt`.
  - A restore whose label an active field took meanwhile answers 400 on `body.label`; one that would make a sixth searchable field answers 409 `searchable_limit`.
  - The super admin's count takes the cutoff in epoch milliseconds (`bigint`), so the API's clock decides there too, to the millisecond.
- **Locked tests changed with the owner's consent** (2026-11-28): two tests of `fields-definitions.test.ts` now use a clinic of their own (the file's clinic reaches its 20 fields before them), and the purge test of `fields-limits.test.ts` moved to the end of its file (its 31-day clock move ended the super admin's session for the audit test after it). No expectation changed.

## Review (2026-11-28)
- Reviewer, blocking, fixed: B1 an edit that sent `validation` always read as changed (jsonb gives the stored keys back in its own order), so a save of the unchanged form wrote, bumped `updatedAt` and audited `changed: ['validation']`: rules and options are now compared value by value; B2 contract rows proven field by field: `fields-contract.test.ts` parses every answer with `PatientFieldDefinition`, `PatientFieldDefinitions`, `PatientFormFields` and the 409 with `ErrorEnvelope`, plus the B1 case; valid fixtures `PatientFieldDefinitions` and `PatientFormFields` (and the two new error codes) in `packages/contracts/fixtures/responses.json`, with Dart decoders.
- Reviewer, non-blocking, fixed: N3 the rules cap is 16 kB (a default of 250 choice ids fits; it answered 500 above about 205); N4 a field moved into a section is placed at most at position 999; N7 the super admin's cutoff is passed in milliseconds.
- Security reviewer, blocking, fixed: H1 a 100-character pattern could compile to a program of 90,000 instructions (about 15 MB kept in the cache and about 1 s per match), so about 200 owner requests could exhaust the shared API: repeat counts above 200 are refused before compiling, compiled programs above 1,000 instructions are refused, and only accepted patterns are cached (at most 50). Covered by `packages/contracts/test/patient-field-pattern-cost.test.ts`.
- Security reviewer, low, fixed: L1 the member's view counted roles held in other branches; it now counts tenant-wide roles and the active branch's (`rolesInScope`, the guard's rule), tested in `fields-contract.test.ts`; L2 as N3.
- To `docs/backlog.md`: N5 section order after a move or a purge, N6 gaps in the owner's `order` while archived fields stay, N9 a label race test, N10 a section respelled by an edit is kept, a per-member limit on field writes (H1 option 5); N8 and L3 (purge without a worker, suspended clinics) are in "Purge without a worker" and in the A-03-06 slice notes.

## Stopped at
Built, reviewed, review fixes in; PR open.

## Evidence
- Red phase: the three locked suites failed for the right reason (the contract module missing; 26 of 26 API tests answered 404 on the missing routes).
- `pnpm verify` on the final tree: `all green` (format, instructions, lint-root, scripts-test, file-length, pub-get, drift, typecheck+lint+test 309.5 s, e2e 162.0 s); `node scripts/check-drift.mjs --full`: every check CLEAN (the Dart client included). Docker-backed suites ran in this cloud session (OD-83).
- Targeted runs: `fields-definitions`, `fields-limits`, `fields-contract` 31 of 31; route matrix and support matrix 12 of 12; db `patient-fields`, privileges, isolation (direct and PgBouncer), architecture 135 of 135; contracts `patient-fields` and `patient-field-pattern-cost` 20 of 20; Dart client fixtures 157 of 157.
- Reviewer and security-reviewer findings fixed: B1, B2, N3, N4, N7, H1, L1, L2 (see Review); the rest in `docs/backlog.md`.

## Notes for the next session
- <only what is needed to resume>
