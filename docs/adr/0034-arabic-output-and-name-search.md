# ADR-0034: Arabic output and name search — Gotenberg settings, Vazirmatn, thermal raster, normaliser

Status: Accepted (owner, 2026-11-16); name-search normaliser and index amended by [ADR-0052](0052-patient-name-search-on-a-token-table.md) · Date: 2026-11-16 · Deciders: product owner (with Claude) · Amends: [ADR-0021](0021-supporting-services.md)

## Context
[ADR-0021](0021-supporting-services.md) chose Gotenberg (headless Chromium) for Arabic PDFs, one HTML/CSS template set for browser printing and server PDFs, raster ESC/POS for cheap thermal printers, and an application-side Arabic name normaliser with `pg_trgm`. Spike S3 ([spec](../specs/spikes/0.3-s3-arabic-output.md), [result](../spikes/s3-arabic-output.md)) ran each part on synthetic data: four document types in both digit styles, goldens, browser-print parity, a thermal raster round-trip, the normaliser in TypeScript, Dart and SQL with shared vectors, and search on PostgreSQL 18 under RLS.

## Decision
**PDF engine**
- Gotenberg 8.x pinned by version and digest (8.40.0 in the spike, OD-41), on an internal network only. HTML and fonts are uploaded with every request; the client never sends a URL. Chromium allow-list `^file:///tmp/.*` with the matching deny list. Only the Chromium routes stay on: `--webhook-disable`, `--api-disable-download-from`, `--libreoffice-disable-routes`, `--pdfengines-disable-routes`; Phase A adds `--api-enable-basic-auth` and publishes the port only on the internal network.
- Every conversion waits for `document.fonts.status === 'loaded'` (`waitForExpression`) and leaves the network-idle wait off.
- Paged documents (A5, A4) set their size in CSS `@page` and use `preferCssPageSize`. Roll documents (receipts, tickets) set no CSS page size; Gotenberg prints them with `paperWidth`, zero margins and `singlePage`. Their template ends with an empty 10 mm tear-off block, because `singlePage` drops anything that spills past the measured height. The worker checks that a roll PDF has one page.
- Page headers and "صفحة X من Y" are CSS page-margin boxes (`@top-center`, `@bottom-center` with `counter(page)`/`counter(pages)`, `arabic-indic` for Arabic digits). They print the same in Gotenberg and in the browser.

**Font and template conventions**
- **Vazirmatn** (OFL, `@fontsource/vazirmatn`, arabic + latin + latin-ext subsets, 400/700), self-hosted and uploaded with the HTML. Noto Naskh Arabic and Amiri are rejected because they fragment the PDF text layer (copy, search, screen readers).
- Data never goes into CSS unescaped: text in page-margin `content` is CSS-escaped (`cssString`), HTML text and the title HTML-escaped.
- `<html lang="ar" dir="rtl">`; one font family with no generic fallback, so a missing glyph shows up as an extra font in `pdffonts`; Latin runs (drug names, doses, phones, currency codes) in `<bdi dir="ltr">`; `font-variant-numeric: tabular-nums`; sizes in pt and mm.
- Numbers through `Intl.NumberFormat('ar-SY-u-nu-<style>')` and dates through `Intl.DateTimeFormat` (day/month/year with RLM marks), never a bare ISO date in Arabic text. Both digit styles stay supported until OD-20 is decided.
- 58 mm receipts at 9 pt base size, 80 mm at 10 pt (owner, 2026-11-16).

**Thermal raster**
- The same receipt or ticket HTML, screenshotted by Gotenberg at the printer's dot width (576 px for 80 mm, 384 px for 58 mm, 203 dpi) with CSS `zoom: 203/96`, so that CSS mm map to printer dots.
- 1-bit by threshold (128) for text; Floyd–Steinberg stays available. Encoded as `ESC @`, then `GS v 0` bands of at most 255 rows, then a short feed. No cut command inside a receipt.
- A real printer run on the clinics' models must pass before the first pilot (OD-39).

**Name-search normaliser**
- One function with the steps and order of the spike result, criterion 7 (ADR-0021's list plus OD-40: word-final ة/ى folding and compound-name particles; `ال` kept; ASCII-only lower-casing; bidi controls removed; NFC at both ends). The display name never changes.
- `vectors/name-search-vectors.json` is the contract: a rule change edits the vectors first, then every port. CI runs the vectors against the TypeScript port and the Dart port (the offline clients).
- The key is a **stored column written by the application** (the patient repository) with a key version, not a generated column. A SQL port of the function is kept only as a drift check in tests.
- Search runs inside `withTenant()` with `pg_trgm` similarity (threshold 0.3) on a `(tenant_id, name_key gin_trgm_ops)` GIN index (`btree_gin`). Whether that index can be used under RLS depends on OD-42 (`LEAKPROOF` for `similarity_op`). Until then, tenants up to a few thousand patients are served by the primary-key plan (about 8 ms).

## Consequences
+ Arabic PDFs, browser prints and thermal images come from one template set and are covered by goldens, text checks and a parity test (kept in `spikes/s3-arabic-output/` for Phase A).
+ The server and the offline clients compute the same search key, held equal by one vector file.
− Copying text out of a PDF reverses lam-alef ligatures and changes date order in every reader tested: PDFs are for people, never a data source.
− One Gotenberg container needs about 0.5 GB and served about 2.5–3 PDFs per second one at a time and about 5–6 per second with 5 in flight on the spike machine; beyond that, throughput needs more containers.
− Search on large tenants is slow until OD-42 is decided.

## Alternatives considered
- Gotenberg 9.x: released 2026-11-05; owner kept the spec's 8.x for the spike (OD-41). Re-evaluate in Phase A after reading its changelog.
- Noto Naskh Arabic, Amiri: better-looking naskh for prescriptions, but broken text layer. Cairo: also clean, wider; Vazirmatn preferred by the owner.
- Generated key column only: no forgotten write path, but a third copy of the rules and Unicode-version drift in `normalize()`.
- Marking pg_trgm functions `LEAKPROOF`, a per-tenant `SECURITY DEFINER` search function, or Meilisearch: OD-42.

## Sources
[Spike S3 result](../spikes/s3-arabic-output.md), [ADR-0021](0021-supporting-services.md), [RN-16 §8, §11], [RN-17 §11]
