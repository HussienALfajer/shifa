# A-03-08 Merge of two charts and the chart foreign-key registry

Status: Planned · Tier: T0 · Branch: `feat/A-03-08-merge`
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 8, 4 (merged number leads to the kept chart), 20 (merged) · Requirements: CLN-41 (merge part) · Decisions: OD-139

Last API slice of A-03, after A-03-07: it needs every table that refers to a chart.
Contract: delivers the rows of the A-03 screen contract that name this slice, each proven by a contract test (ADR-0047).

## Goal
The owner merges two charts of the same person: one file number remains, the other leads to it, nothing is deleted, and every later table that refers to a chart is merged with it.

## Plan
1. **Contracts** — `MergePreview` (both charts side by side, per identity field both values, custom fields to fill, doctors to join), `MergeRequest` (kept id, other id, chosen value per identity field, the other's file number typed back as confirmation), `PatientChart.mergedInto`; codes 409 `patient_not_active`, `merge_confirmation_mismatch`.
2. **Database** (`/db-migration`; expand only) — no new table; `patient.merged_into_id` checked to point at an active chart of the same tenant (constraint or trigger); a merged chart refused for writes in the database as well as the API.
3. **API**
   - Merge step registry: every table with a `(tenant_id, patient_id)` foreign key registers a merge step (A-03 tables: name tokens, treating doctors, field values, search values; later specs add theirs). A start-up and test check reads the catalog and refuses a chart foreign key without a step.
   - `GET /patients/:id/merge-preview?other=` and `POST /patients/merge` (`patients.merge`, owner): one transaction locking both charts in id order; the kept chart takes the chosen identity values; empty custom fields filled from the other; doctors joined; tokens rebuilt; the other becomes `merged` with `merged_into_id`, read-only, never deleted.
   - Search and `GET /patients/:id` of a merged chart lead to the kept one (A-03-03's fixture becomes real); its file number keeps finding the kept chart. If the phones differ, the kept phone decides the family.
   - Audit `patient.merged` (both ids, chosen field keys). Cannot be undone.
4. **Web, Flutter** — none.
5. **End-to-end** — none.

Tests written first: field choice with the kept chart's value by default; custom fields filled only where empty; doctors joined without duplicates; merged chart read-only in API and database, found by its number, leading to the kept one; different phones move the family; a merged or archived chart refused (409); confirmation mismatch; concurrent merges of overlapping charts (lock order); audit row (8, 20); start-up check fails on a test table with an unregistered chart foreign key; isolation (a chart of another clinic cannot be merged).
Estimated hand-written lines: ~2,800 (contracts ~250, database ~150, registry and check ~400, merge ~800, tests ~1,200).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Reviewer and security-reviewer findings fixed: <list>

## Notes for the next session
- Later specs (A-04 appointments, A-05 queue, A-06 invoices, A-07 visits) each register a merge step for their chart foreign key; the start-up check enforces it.
