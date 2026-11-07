# ADR-0019: Medical imaging — unmodified Orthanc per tenant behind our DICOMweb gateway; OHIF viewer

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
Release 1 includes a professional DICOM viewer for dental and orthopedic clinics. Orthanc's core is GPLv3 and its DICOMweb, PostgreSQL, object-storage and authorization plugins are AGPL; proprietary code that talks to Orthanc over REST/DICOM stays closed, but code running inside Orthanc alongside AGPL plugins does not [RN-14 §3]. OHIF v3 and Cornerstone3D are MIT [RN-14 §1]. Two tenants uploading the same study to one shared Orthanc would share one resource [RN-14 §2]. Links in Syria are slow (CBCT 300 MB ≈ 13 min at 3 Mbps) [RN-14 §5].

## Decision
- Orthanc from the official image, never modified, with PostgreSQL index, S3 object storage (Garage — compatibility to be tested), DICOMweb, authorization and GDCM plugins; not publicly reachable.
- One Orthanc instance per tenant, provisioned on demand when the imaging entitlement is enabled (shared Postgres server with a database per tenant; per-tenant bucket prefix). Labels inside an instance for branches.
- Our proprietary imaging gateway (in the API): tenant → upstream mapping, DICOMweb route allowlist (unknown routes denied), short-lived viewer tokens, audit of every access, resumable uploads, expiring share links.
- An out-of-process imaging worker consumes Orthanc `/changes`, extracts metadata into Shifa, creates thumbnails, and later derivatives.
- Viewer: OHIF v3 fork pinned, served on the same origin, embedded via iframe + postMessage, canvas kept LTR with Arabic surrounding UI; Cornerstone3D components for dental mounts (FMX/bitewing), thumbnails and side-by-side comparison; three.js for STL later.
- Ingest: browser upload of files, folders and patient CDs (DICOMDIR) with validation and resume; phone photos stored as images (flagged non-diagnostic). For clinics with modalities: an edge box (Orthanc + UPS) with store-and-forward, and a Windows capture bridge for intraoral sensors (OD-18).
- No custom code inside the Orthanc process.

## Consequences
+ Licence-clean proprietary code; strong tenant isolation; per-clinic export/deletion is trivial.
− Many small Orthanc containers to operate; revisit if tenant count makes this unmanageable.
− OHIF has no documented RTL/Arabic support; tablet usability must be tested.

## Alternatives considered
- Shared Orthanc with labels: UID collisions across tenants.
- dcm4chee: heavier Java stack.
- Cloud DICOM services: account/payment availability uncertain.
- MedDream: commercial, regulatory-cleared; possible later.
- dwv (GPL), Stone viewer (AGPL): licence conflicts.

## Sources
[RN-14 §1–§8], [RN-17 §7], [RN-13 §7]
