# Medical Imaging (DICOM)

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-14, RN-12, RN-13, RN-08, RN-07, RN-16, RN-17

Purpose: specifies the shared imaging module used by dentistry and orthopedics — viewing, ingest, storage, measurements, dental mounts, serial comparison, sharing and the clinic-side edge components. Build phase: **Phase D**. Simple photo/PDF attachments (no DICOM) are part of [clinical records](clinical-records.md) in Phase A; specialty views are in [dental](dental.md) and [orthopedics](orthopedics.md).

Related decisions: ADR-0019 (imaging stack: per-tenant Orthanc behind our gateway, OHIF viewer), ADR-0023 (no real patient data in dev). Open questions: OD-18 (edge box hardware, bandwidth, CBCT feasibility). See the [ADR index](../adr/README.md).

## Architecture rules

- IMG-01 The archive is the official, unmodified Orthanc image (PostgreSQL index plugin, S3-compatible object storage plugin with encryption, DICOMweb, authorization and GDCM plugins); it is never reachable from the internet. [RN-14 §8]
- IMG-02 One Orthanc instance per tenant, provisioned on demand only when the tenant's imaging entitlement is enabled; shared PostgreSQL server with a separate database per tenant and per-tenant bucket prefix. This avoids cross-tenant merging of identical studies (same UIDs uploaded by two clinics). [RN-14 §2] (per-tenant choice is an inference to validate at scale)
- IMG-03 All viewer and API traffic passes through our imaging gateway, which issues short-lived viewer tokens, maps tenant → Orthanc upstream, allow-lists DICOMweb routes (QIDO-RS, WADO-RS, WADO-URI, STOW-RS), audits every access and handles resumable uploads. Unknown routes are rejected (the Orthanc authorization plugin treats unknown URIs as "system"). [RN-14 §2]
- IMG-04 AGPL boundary: no custom code runs inside the Orthanc process (no Python/Lua plugins). Our code talks to Orthanc only over REST/DICOM, keeping proprietary code licence-clean. [RN-14 §3]
- IMG-05 An imaging worker (our code, out of process) consumes Orthanc change events, extracts metadata into the application DB (patient match, modality, tooth numbers, body part, side), and generates thumbnails/previews.
- IMG-06 Studies are stored lossless as received; lossy derivatives are only for previews.
- IMG-07 A support contract with the Orthanc team is budgeted if the object-storage plugins become critical (they are not fixed for free outside contracts). [RN-14 §2]

## Viewer

- IMG-08 Diagnostic viewer is a pinned fork of OHIF v3 (MIT), served under the application origin and embedded via iframe + postMessage; Arabic i18n bundle for surrounding UI, image canvas kept LTR. [RN-14 §1], [RN-17 §7]
- IMG-09 Capabilities: 2D stacks, MPR for CT/CBCT, window/level, zoom/pan, annotations, comparison with prior studies, hanging protocols for dental and orthopedic layouts.
- IMG-10 Measurement tools: length, angle, Cobb angle, ellipse ROI, HKA (hip-knee-ankle), hallux valgus angle and intermetatarsal angle, leg-length discrepancy; a calibration step (known distance or pixel spacing) with calibration status saved.
- IMG-11 Measurements are persisted as structured data (type, value, unit, side, calibration status, image reference) and appear in specialty charts (e.g. Cobb trend in [orthopedics](orthopedics.md)).
- IMG-12 A custom React + Cornerstone3D component renders thumbnails, dental mounts and simple side-by-side comparisons inside clinic screens without opening the full viewer.
- IMG-13 Tablet support is tested early on target devices; touch issues in OHIF are known. [RN-14 §1]

## Ingest

- IMG-14 Browser upload of DICOM files and folders, including patient CDs/DVDs (DICOMDIR), with client-side validation and resumable chunked upload that survives connection drops. [RN-14 §4]
- IMG-15 Phone photos of films/screens are stored as JPEG attachments flagged "non-diagnostic", optionally wrapped as DICOM Secondary Capture.
- IMG-16 Each new study is matched to a patient (demographics + staff confirmation); unmatched studies land in a tenant "unassigned" inbox.
- IMG-17 Clinic edge box (optional per clinic with panoramic/CBCT/CR devices): mini-PC + UPS running Orthanc (SQLite) that receives C-STORE from modalities, keeps recent months locally for LAN viewing, and pushes to the tenant's cloud instance via the Orthanc Transfers accelerator (HTTPS, compression, retry) when internet is available. [RN-14 §8]
- IMG-18 Windows capture bridge agent for intraoral sensors and cameras: folder-watch and DICOM/JPEG import first, then TWAIN; offline queue; launched from the web app by deep link. [RN-14 §4]

## Dental-specific

- IMG-19 Mount templates: FMX (18–20 images), bitewings (2/4), paediatric; drag images into slots; manual tooth tagging per image. [RN-14 §6]
- IMG-20 Tooth-tagged images feed the per-tooth history in the odontogram ([dental](dental.md) DEN-13, DEN-57).
- IMG-21 Enhancement filters (brightness, contrast, sharpen, invert) and calibrated linear measurement.

## Orthopedic-specific

- IMG-22 Serial comparison of follow-up radiographs for the same `SiteRef` (side-by-side, synchronised zoom).
- IMG-23 Imaging requests and results carry `SiteRef` (site, side, level) consistent with the episode.

## Sharing and audit

- IMG-24 Expiring share links (configurable duration, optional PIN) for referrals; every view through a link is audited.
- IMG-25 Every study access (view, download, share) is written to the audit log with actor, tenant and study.

## Bandwidth and storage facts (planning inputs)

- Fixed broadband in Syria ~3 Mbps median, mobile ~25 Mbps (2026). A 300 MB CBCT takes ~13 minutes at 3 Mbps; 1 GB ~45 minutes — hence edge store-and-forward for CBCT clinics. [RN-14 §5]
- Estimated storage per clinic ~50–125 GB/year (assumption-based); bandwidth, not storage cost, is the constraint. (unverified)
- Progressive HTJ2K loading needs server support that Orthanc does not document. [RN-14 §5]

## Later (explicitly deferred)

- IMG-26 HTJ2K progressive derivatives with range-capable serving and LAN/cloud auto-switching. (Later)
- IMG-27 STL/PLY intraoral-scan viewer (three.js). (Later)
- IMG-28 AI second opinion via partner API (dental caries/periapical lesions; fracture detection). (Later)
- IMG-29 CBCT implant planning and orthopedic templating via partner/desktop tools. (Later)
- IMG-30 Managed cloud DICOM archive tier once account and payment eligibility from Syria is confirmed. (Later)

## Key entities

- `ImagingTenantInstance` — tenant → Orthanc upstream mapping and status.
- `ImagingStudy` / `ImagingSeries` — metadata mirror (patient, modality, date, body part, side, tooth numbers, source).
- `ImagingUpload` — resumable upload session state.
- `ImagingMeasurement` — structured measurement with calibration status.
- `DentalMount` / `MountSlot` — mount template instance and tooth tags.
- `ImagingShareLink` — expiring link with access log.
- `EdgeDevice` — registered clinic edge box / capture bridge with last-seen and queue depth.

## Verification notes

- Tenant isolation: a token for tenant A cannot query (QIDO) or retrieve (WADO) any study of tenant B; gateway route allow-list tests include unknown and system routes.
- Licence boundary: CI check that no files are mounted into Orthanc plugin/script directories other than official configuration.
- Upload resilience: automated test interrupts a multi-hundred-MB upload and resumes without duplication; DICOMDIR import of a synthetic CD fixture.
- Measurement persistence: values saved from the viewer match recomputation from stored coordinates; uncalibrated measurements are flagged in UI and reports.
- Pilot: one Aleppo clinic with real (consented, non-dev) workflow measures end-to-end upload and viewing times before broad rollout (OD-18); development uses synthetic/public sample DICOM only (ADR-0023).
