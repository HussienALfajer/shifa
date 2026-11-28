# A-03-04 Duplicates, family and treating doctors

Status: Built, in review · Tier: T0 · Branch: `feat/A-03-04-duplicates-family-doctors`
Spec: [A-03](../specs/patients/A-03-patients.md) criteria 7, 9, 10, 20 (duplicate registered anyway, treating doctors changed); from A-03-01: criteria 27, 29 · Requirements: CLN-41 (warning part), CLN-42, CLN-43 · Decisions: OD-138, OD-139, OD-140

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

## From A-03-01 (re-plan, 2026-11-27)
- Where this file's earlier plan names a route, field or code differently, the [contract](../specs/patients/A-03-screen-contract.md) wins. Superseded names: `GET /patients/doctor-choices` → `GET /patients/doctors`; `GET /patients/:id/family` → `POST /patients/family` (phone in the body) plus `family` in the summary; `PUT /patients/:id/doctors` → `treatingDoctorIds` in `PATCH /patients/:id`; `acknowledgedCandidates` → `acknowledgedCandidateIds`; `DuplicateCandidate.archived` → `visible`, `state` and `reason`.
- Contract rows ([contract](../specs/patients/A-03-screen-contract.md)): `POST /patients/duplicates` (visible and hidden candidate shapes, archived candidates registered anyway, gap 6 option a); `POST /patients/family` (holder, members, relation asked only with a holder); `GET /patients/doctors` (names and `active`, `patients.manage`); `familySize` and `relation` in search results; `family` and `treatingDoctors` in the summary.
- Criteria added: 27, 29.
- Components: none (API slice).
- New estimate: ~3,500 (contracts ~340, database ~300, duplicates ~620, family ~380, doctors ~600, tests ~1,260).

## Built (2026-11-28)
Branch: `claude/youthful-pasteur-0helm2` (the cloud session's branch, in place of `feat/A-03-04-duplicates-family-doctors`).
- **Contracts**: `patient-card.ts` (`PatientCard`, `PatientRelation` (ten keys), `FamilyMember`, `TreatingDoctor`, `DuplicateReason`, `DuplicateCandidate`; apart from patients.ts because the 409 envelope uses it), `patient-input.ts` (the identity input schemas, internal), `patient-links.ts` (`DuplicateCheckRequest`, `DuplicateCandidates`, `PatientFamilyRequest`, `PatientFamily`, `PatientDoctors` and the three routes). `PatientChart` gains `relation`, `family`, `treatingDoctors`; search results `familySize`, `relation`; create and edit `relation`, `treatingDoctorIds`, `acknowledgedCandidateIds`. Codes: 409 `possible_duplicate` (with `candidates` in the envelope), 400 `doctor_not_member`; Arabic messages in `@shifa/i18n`.
- **Database** (expand only): `20261128020206_a03_treating_doctors` (table `patient_treating_doctor`, index `patient_tenant_id_contact_phone_idx`, check `patient_relation_value_check`) and `20261128020211_a03_treating_doctor_policies` (ENABLE + FORCE RLS, tenant policy, `shifa_app` SELECT, INSERT, DELETE). Rollback: drop the policy and grants; the table, index and check go with a contract migration. The index is built without `CONCURRENTLY`: `patient` holds no production rows yet. Classification, privileges pin and isolation case added. Audit `data` may now hold lists of ids (type only; the 1 kB check is unchanged).
- **API** (`modules/patients`): `duplicates.ts` (rule 1: same contact phone and the same given-name key; rule 2: two or more typed words each a whole token of the chart's name, any order, birth year ±2; merged never, archived marked; ≤ 5, phone matches first), `family.ts` (holder = the chart marked `holder`; a phone new to the clinic makes the chart its holder; `holder` refused while the phone has one, a relation refused on a new phone, both 400 on `body.relation`; a transaction lock on the clinic's phone serialises the choice; a phone change moves the chart, its relation then the one sent, else none, holder on a new phone), `doctors.ts` (doctor = holds the doctor role; active = member active and doctor; new ids must be active doctors, ids already on the chart may stay; list replaced by delete and add), `links.service.ts` (the three reads). The create and an edit that changes a name part, the phone or the birth re-check duplicates; an edit re-checks only those fields. Audit: `patient.duplicate_registered` (`candidateIds`), `patient.doctors_changed` (`added`, `removed` member ids), `patient.edited` names `relation` when it changed.
- **Decisions in the build** (reported to the owner): "similar given name" is the same normalised key (ADR-0034), not a trigram score, so twins «حسن» and «حسين» do not warn; rule 2 needs two words; family lists hold active charts only; `familySize` counts the active charts on the phone (an archived result counts itself); `GET /patients/doctors` lists deactivated doctors too, `active: false`; the candidate shape is one object with a nullable `card` (contract row updated).

## Stopped at
API layer built and green locally; reviewer and security-reviewer next, then the PR.

## Evidence
- `verify` (full): <summary line>
- Reviewer and security-reviewer findings fixed: <list>

## Notes for the next session
- From A-03-03: build the candidate query on `patient_name_token` (`name-search.ts`: intersected index-only scans, the trigram check per word) and the phone-tail columns. The A-03-03 benchmark timed only the duplicate check's lookups as search terms (full name, contact phone); add this slice's own query shape ("similar given name", "similar full name with birth year ±2") to `apps/api/test/patients/search-bench.test.ts` and keep p95 ≤ 150 ms. `familySize` and `relation` on search results are this slice's (contract row `POST /patients/search`).
