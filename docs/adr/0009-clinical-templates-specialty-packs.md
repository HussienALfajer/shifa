# ADR-0009: Clinical templates — versioned form engine plus specialty packs; Release 1 specialties are general, dental and orthopedics

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The platform needs global templates, specialty templates and clinic customisation, while old records must always render exactly as signed. Some specialty needs (odontogram, perio chart, skeleton chart) cannot be expressed as plain form fields [RN-04 §2, §4] [RN-12 §11] [RN-13 §12].

## Decision
- A form engine shaped like FHIR Questionnaire/SDC: each template has a canonical `url` that never changes and immutable published versions; every response stores `url|version`; `linkId`s are stable (changing one is a breaking change); draft → published lifecycle.
- Inheritance: platform core template → specialty pack template → clinic-derived template (`derivedFrom`), which may only add or hide items, never reuse a `linkId` with a new meaning. A clinic template editor is out of Release 1; packs ship as code-defined templates.
- Specialty Packs are more than forms: forms + custom UI widgets + default settings + reports + print layouts + calculators. Calculators store formula version, inputs and result.
- Release 1 packs: Core (every doctor: SOAP note, vitals, diagnoses, prescriptions, attachments, allergies/history, medical reports), Dental (full scope in [dental](../domain/dental.md)), Orthopedics (full scope in [orthopedics](../domain/orthopedics.md)). Other specialties come in later releases.
- A practitioner's specialty is assigned by the super admin during verification; it determines which packs are available to that practitioner (entitlements still apply).
- On signing, structured data (vitals, diagnoses, measurements) is extracted to typed, FHIR-shaped records for reporting.
- The internal model is FHIR-shaped; no full FHIR server in Release 1; a FHIR R4 API and IPS export come later.

## Consequences
+ Old records always render; templates evolve safely.
+ Rich specialty UX without polluting the generic engine.
− Two mechanisms to maintain (form engine and pack widgets).

## Alternatives considered
- openEHR: strong governance, but operational-template versioning is unspecified and tooling is heavy [RN-04 §2].
- Free custom fields for clinical data: no versioning or semantics; rejected.
- HAPI FHIR / Medplum server from day one: weight not needed for Release 1 [RN-04 §5].

## Sources
[RN-04 §1–§2, §4–§5], [RN-12 §11], [RN-13 §12], [RN-07], [RN-08]
