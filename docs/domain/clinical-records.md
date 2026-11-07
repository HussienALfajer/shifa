# Clinical Records (General Template)

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-04, RN-07, RN-08, RN-11, RN-01

Purpose: defines the clinical record every doctor gets regardless of specialty — the patient file summary, visit note, vitals, diagnoses, history, attachments, prescriptions, medical reports and the versioned template engine that specialty packs ([dental](dental.md), [orthopedics](orthopedics.md)) build on. Build phase: **Phase A** (core platform). Imaging is specified separately in [imaging](imaging.md).

Related decisions: ADR-0006 (one organisation model, global identities), ADR-0008 (custom fields — administrative only), ADR-0009 (versioned templates + specialty packs), ADR-0023 (no real patient data in dev). See the [ADR index](../adr/README.md) and [open decisions](../open-decisions.md).

## Principles

- The record belongs to the clinic (tenant) and is its legal record; the patient sees only what the clinic releases (OD-14). Cross-clinic sharing is out of Release 1. [RN-04 §7]
- Speed over completeness: doctors spend about half their clinic time on documentation; every screen offers "normal / same as last time" shortcuts and saved bundles. [RN-08 §1], [RN-11 §4]
- Clinical data flows only through versioned templates; administrative custom fields (ADR-0008) never hold clinical data.
- Signed content is immutable; corrections are addenda. [RN-04 §6]

## Patient file summary

- CLN-01 One screen shows: identity (name, age, sex, file number, phone), alert chips (allergies, chronic diseases, anticoagulants, pregnancy, other flagged history), last visits, active problems, current medications, upcoming appointments and the patient's financial balance (balance visible only to roles with billing permission).
- CLN-02 Alert chips are derived from structured history and specialty questionnaires (e.g. the dental medical-history form) and appear on every clinical screen header.
- CLN-03 The timeline lists visits, prescriptions, reports, attachments and procedures in reverse chronological order with filters by type and doctor.

## Visit note

- CLN-04 A visit (encounter) has: visit type, chief complaint, history of present illness, examination, diagnoses, plan, follow-up — structured as a SOAP-style template rendered by the template engine.
- CLN-05 Each section supports quick-pick phrases, the doctor's saved phrases and free text; "same as last visit" copies the previous note's section for edit.
- CLN-06 Vitals: blood pressure (systolic/diastolic), pulse, temperature, weight, height (BMI computed), SpO₂ (optional); out-of-range values are highlighted against configurable reference ranges.
- CLN-07 One-tap follow-up booking from the visit screen pre-fills doctor, branch and suggested interval.
- CLN-08 "Mark visit done → next patient" closes the visit and advances the queue (see scheduling-queue domain doc).

## Diagnoses

- CLN-09 Diagnoses come from a curated Arabic/English list per specialty mapped to WHO ICD-10 codes, plus free text; laterality is a separate field, not encoded in the code (US ICD-10-CM laterality codes are not used). [RN-08 §9]
- CLN-10 The data model stores code system + version so an ICD-11 mapping (Arabic edition available, CC BY-ND) can be added without migrating history. (ICD-11 mapping: Later) [RN-04 §3]
- CLN-11 Diagnoses can be marked active/resolved and feed the problem list.

## History

- CLN-12 Structured history: allergies (agent, reaction, severity), chronic diseases, current medications, past surgeries, family/social notes; each item records source (clinic-entered vs patient self-reported) and date.
- CLN-13 Patient self-reported basics from the patient app (allergies, chronic diseases, medications, blood group) appear labelled "self-reported" until a clinician confirms them.

## Attachments

- CLN-14 Staff can capture with the device camera or upload images and PDFs (lab results, outside reports, film photos), tagged with type, date and visit; images open in a simple viewer. Diagnostic DICOM viewing is in [imaging](imaging.md).
- CLN-15 Upload survives connection loss (resumable) and shows progress; failed uploads remain queued on the device.

## Prescriptions

- CLN-16 Prescription builder with autocomplete over the platform drug catalogue (generic name, Syrian trade names, strength, form) plus clinic-added drugs; source of the catalogue is OD-10. [RN-04 §3]
- CLN-17 Doctor favourites and named prescription templates (e.g. "post-extraction", "knee OA flare") insert multiple items in one action; specialty packs ship seed templates.
- CLN-18 The prescription screen shows the allergy and pregnancy banner; prescribing a drug whose class matches a recorded allergy shows a warning requiring acknowledgement. Drug–drug interaction checking: Later. [RN-04 §3]
- CLN-19 Print on A5 with clinic letterhead, logo, stamp and doctor signature images; bilingual drug lines (Arabic instructions, Latin drug names isolated for correct bidi rendering).
- CLN-20 A signed prescription can be shared to the patient app (release rule per OD-14).

## Medical reports and certificates

- CLN-21 Arabic templates for sick leave, medical report, referral letter (and specialty-specific ones from packs) auto-fill patient, doctor, dates and diagnoses.
- CLN-22 An issued report is stored as an immutable rendered copy (PDF) with issue number; re-issuing creates a new number referencing the old. QR verification of issued reports: Later.

## Saved plan bundles

- CLN-23 A doctor can save a bundle = diagnosis + prescription template + advice text + follow-up interval (+ procedure lines from specialty packs) and apply it in one action; bundles are per doctor with optional clinic-wide sharing.

## Signing, locking, addenda

- CLN-24 A visit note is a draft until the doctor signs it; signing locks all clinical content of the visit.
- CLN-25 After signing, changes are only possible as addenda (author, time, reason); the original stays visible.
- CLN-26 Unsigned notes older than a configurable period (default 24 h) appear on the doctor's "to sign" list.
- CLN-27 Every read of a patient record and every clinical write is recorded in the audit log (who, when, what, from which device); see the security docs.

## Template engine (versioned)

- CLN-28 Clinical forms are defined as versioned templates in a FHIR Questionnaire-like JSON model: canonical `url` never changes, every response stores the exact `url|version`, `linkId`s are stable, published versions are immutable. [RN-04 §2]
- CLN-29 Changing or deleting a `linkId`, recoding an answer, or moving items between groups is a breaking change and requires a new major version; old responses keep rendering with their original version.
- CLN-30 Template layering: platform core template → specialty pack template (e.g. `pack:dental@2.1.0`) → clinic variant derived via `derivedFrom`; in Release 1 clinic variants can only hide optional items and add items (template editor UI: Later).
- CLN-31 On visit signing, structured values (vitals, diagnoses, scores) are extracted into queryable observation/condition records; extraction is definition-based, not StructureMap. [RN-04 §2]
- CLN-32 Clinical calculators (e.g. BMI, specialty scores) store formula version, inputs and result.
- CLN-33 Custom UI widgets (odontogram, body chart, perio grid, growth chart) are registered components that a template item can reference; they store their data in specialty entities, not in free-form answers.

## Specialty assignment and packs

- CLN-34 Each practitioner has one primary specialty (General, Dentistry, Orthopedics in Release 1) assigned only from the super-admin panel after licence verification; the specialty selects which pack's templates, widgets, catalogues and reports the doctor sees. (ADR-0009)
- CLN-35 The general template is always available to every doctor in addition to their pack.
- CLN-36 Pack access is a tenant entitlement (ADR-0007); the specialty narrows it per practitioner.

## Clinical content governance

- CLN-37 All seed content (drug catalogue entries, prescription templates, diagnosis lists, report wording, reference ranges) carries a reviewer and review date; content is not released until signed off by the clinical advisors (OD-17).
- CLN-38 No real patient data is ever used for seeding, demos or tests; fixtures come from a synthetic generator (ADR-0023).

## Key entities

- `Encounter` — one visit; type, doctor, branch, status (draft/signed), timestamps.
- `TemplateDefinition` / `TemplateVersion` — canonical template and immutable published versions.
- `TemplateResponse` — answers for one encounter bound to `url|version`.
- `Observation` / `Condition` — extracted structured values and diagnoses.
- `AllergyIntolerance`, `MedicationStatement`, `HistoryItem` — structured history with source.
- `Prescription` / `PrescriptionItem` / `RxTemplate` — prescriptions and reusable templates.
- `DrugCatalogItem` — platform catalogue entry (+ clinic-added items).
- `IssuedDocument` — immutable rendered report/certificate with number.
- `PlanBundle` — saved diagnosis→Rx→advice→follow-up bundle.
- `Addendum` — post-signature correction.

## Verification notes

- Template versioning: render a response saved with v1 after v2 is published — identical output; publishing a version with a reused `linkId` of different meaning fails validation.
- Signing: attempts to edit a signed encounter via API return an error; addendum path succeeds and is audited.
- Allergy banner: prescribing a drug in a recorded allergy class requires acknowledgement (UI test + API rule test).
- Print: A5 prescription PDF snapshot tests with Arabic text and Latin drug names render in correct order.
- Audit: reading a patient summary writes exactly one audit entry with actor and tenant.
- Tenant isolation: encounter, prescription and document queries return zero rows for another tenant under the application role.
