# A-03-04 Duplicates, family and treating doctors

Status: Planned · Tier: T0 · Branch: `feat/A-03-04-duplicates-family-doctors`
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 7, 9, 10, 20 (duplicate registered anyway, treating doctors changed) · Requirements: CLN-41 (warning part), CLN-42, CLN-43 · Decisions: OD-138, OD-139, OD-140

Third API slice of A-03, after A-03-03.
Contract: delivers the rows of the A-03 screen contract that name this slice, each proven by a contract test (ADR-0047).

## Goal
Registration warns before a duplicate and the server refuses an unacknowledged one; charts sharing a phone show as a family with each member's relation; each chart lists its treating doctors.

## Plan
1. **Contracts** — `DuplicateCheckRequest` (the registration fields so far, in the body), `DuplicateCandidate` (id, display name, file number, age, `archived`), `CreatePatientRequest.acknowledgedCandidates` (ids); `PatientRelation` (the ten values); `FamilyMember`; `TreatingDoctor` (member id, name, `active`); codes 409 `possible_duplicate` (with candidate ids), `doctor_not_member`.
2. **Database** (`/db-migration`, `/rls-policy`; expand only)
   - `patient.relation` constrained to the ten values (column from A-03-02); an index `(tenant_id, contact_phone)` for families.
   - `patient_treating_doctor` (tenant_id, patient_id `(tenant_id, patient_id)` FK, member_id `(tenant_id, member_id)` FK, added_by, added_at): FORCE RLS, isolation case. It is a chart foreign key, so A-03-08's merge registry will name it.
3. **API** (`modules/patients`)
   - `POST /patients/duplicates` (`patients.manage`): the same phone with a similar given name, or a similar full name with a birth year within 2 years, on the A-03-03 token index; at most 5, archived marked; no read audit.
   - The create re-checks on the server: unacknowledged candidates answer 409 `possible_duplicate` with their ids; registering anyway audits `patient.duplicate_registered` with the candidate ids.
   - Family: `GET /patients/:id/family` and `POST /patients/family` (by phone, in the body, while registering); changing the phone moves the chart to that family.
   - Treating doctors: set on create (a doctor who registers is added; others pick one or more, or none), `PUT /patients/:id/doctors`; only doctor members of the clinic are accepted; a deactivated doctor stays, marked inactive, and is not offered (`GET /patients/doctor-choices`). Audit `patient.doctors_changed` (member ids only).
   - "My patients only" filtering of these lists comes in A-03-07.
4. **Web, Flutter** — none.
5. **End-to-end** — none.

Tests written first: each candidate rule and the near misses (twins with different given names are no duplicate; the same name warns) (7); archived candidates marked; 409 on an unacknowledged create, success with the ids and its audit row (7, 20); family by phone, relation values, a phone change moves the chart (9); doctors on create by role, a non-doctor refused, edit by anyone with `patients.manage`, deactivated doctor kept and not offered (10); audit rows without names; isolation case; candidate check within the A-03-03 benchmark's budget (re-run).
Estimated hand-written lines: ~3,300 (contracts ~300, database ~300, duplicates ~600, family ~350, doctors ~500, tests ~1,250).

## Stopped at
Planned.

## Evidence
- `verify` (full): <summary line>
- Reviewer and security-reviewer findings fixed: <list>

## Notes for the next session
- <only what is needed to resume>
