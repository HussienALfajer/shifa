# ADR-0021: Supporting services — Garage, Valkey, Gotenberg, ExcelJS, Postgres search with Arabic normalisation

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
The platform needs S3-compatible storage (attachments, PDFs, DICOM), a cache, Arabic PDF generation, Excel export and Arabic name search — all self-hostable and portable because of hosting uncertainty ([ADR-0022](0022-deployment-portable-hosting.md)) and sanctions-era access [RN-16 §8–§12].

## Decision
- Object storage: Garage (AGPLv3, run unmodified as a separate service) via the S3 API; buckets/prefixes per tenant; server-side encryption where supported; Orthanc's S3 plugin compatibility verified in the Phase 0 spike. Runner-up: SeaweedFS (Apache 2.0).
- Cache and ephemeral data: Valkey 9 (BSD-3) for rate limits, session caches and the Centrifugo engine.
- PDFs: HTML → PDF with headless Chromium via Gotenberg, with embedded self-hosted Arabic fonts. The same HTML/CSS templates (`@page` for A5, A4, 80 mm, 58 mm) serve browser printing and server PDFs, so prescriptions, receipts and reports look identical.
- Excel: ExcelJS behind a `ReportWriter` interface with streaming.
- Search: PostgreSQL only in Release 1 — application-side Arabic normalisation (alef/hamza forms, taa marbuta, alef maqsura, diacritics, tatweel, Arabic-Indic digits) stored in generated columns, `pg_trgm` similarity and `simple` full-text configuration; stays inside RLS and the offline normaliser uses the same function. Meilisearch CE is the later option for the public doctor directory if needed.
- Thermal printing: browser print through OS drivers by default; raster ESC/POS over WebUSB/Web Serial as fallback for tablets (cheap printers lack Arabic code pages) [RN-17 §11].

## Consequences
+ Every dependency is self-hostable, licence-clean for a closed SaaS, and portable to a Syrian data centre.
− We operate more services ourselves; covered by the deployment and monitoring setup.

## Alternatives considered
- MinIO Community Edition: admin console removed (May 2025), binaries and images stopped (Oct 2025), maintenance mode (Dec 2025), repository archived (2026) [RN-16 §9].
- Redis 8: AGPL option; Valkey preferred for licence clarity [RN-16 §10].
- pdfmake/PDFKit: Arabic shaping problems; Typst kept as a spike candidate [RN-16 §11].
- SheetJS from npm: stale with CVEs [RN-16 §12].
- Postgres Arabic Snowball stemmer: too aggressive for names; `unaccent` is Latin-only [RN-16 §8].

## Sources
[RN-16 §8–§12], [RN-17 §11], [RN-14 §2]
