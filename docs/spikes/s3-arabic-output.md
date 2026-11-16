# Spike S3 result: Arabic output (PDF, thermal) and Arabic name search

Date: 2026-11-16 (local run; CI dispatch skipped, OD-43) · Spec: [0.3-S3](../specs/spikes/0.3-s3-arabic-output.md) · Slice: [0.3-S3](../slices/0.3-s3-arabic-output-spike.md) · Decision: [ADR-0034](../adr/0034-arabic-output-and-name-search.md) (Accepted, owner 2026-11-16), amending [ADR-0021](../adr/0021-supporting-services.md) · Requirements: PLT-38, BIL-30, SCH-28, SCH-30, CLN-22, PAT-14, PLT-50; "Arabic-normalised search" ([Release 1 scope](../product/scope-release-1.md))

## Answer
**ADR-0021's output plan works, with four corrections. Its search plan works for the normaliser, but not yet for the index under RLS.**

- Gotenberg's Chromium shapes Arabic, keeps mixed Arabic/Latin lines and Arabic-Indic digits in order, prints `@page` sizes, repeating table headers and CSS page-number margin boxes, and matches Playwright's browser print page for page and word for word. Chromium loads nothing but the uploaded files: Gotenberg's allow and deny lists block every other URL (a canary on the same network received no request; the security review also saw a WebSocket, `file:///etc/…` and Chromium's own update check blocked).
- Corrections found on the way (all in ADR-0034):
  1. **Font: Vazirmatn** (owner, 2026-11-16). All four candidates print correctly. Noto Naskh Arabic and Amiri break the PDF *text layer*: their glyph positioning splits words into fragments, so copy, search and screen readers get "المج موع". Vazirmatn and Cairo keep it whole.
  2. **Roll paper (receipts, tickets) ends with an empty 10 mm tear-off block.** Gotenberg's `singlePage` sets the page to the measured content height. Chromium's print layout can need a pixel more, and Gotenberg silently drops whatever spills onto a second page: the long receipt lost its last line until the tear-off block took the overflow.
  3. **Dates use the locale format** (`Intl`, day/month/year with RLM marks), never a bare ISO date: inside Arabic text the bidi algorithm turns "2026-11-16" into "16-11-2026".
  4. **Wait for fonts** (`waitForExpression: document.fonts.status === 'loaded'`), and leave Gotenberg's network-idle wait off: with it on, every render took about 1.3 s instead of 0.3–0.4 s.
- The name normaliser (OD-40 rules) is one function in TypeScript, Dart and SQL. 313 shared vectors hold all three equal, and 5,000 random strings show it is idempotent. In PostgreSQL 18 it finds every rule variant of a synthetic patient in the top 5 inside `withTenant()`.
- **Open (OD-42):** under RLS, PostgreSQL does not use the `tenant_id`-led GIN trigram index, because pg_trgm's `%` operator is not `LEAKPROOF`. At the `load` volume (1,000 patients per tenant) the plan is the primary key plus a filter: 7.7 ms p50. A 50,000-patient tenant gets a sequential scan: 271 ms p50. Marking `similarity_op` `LEAKPROOF` (superuser) makes the GIN index serve both conditions; the owner decides in Phase A.

## Versions tested
Gotenberg 8.40.0 (`gotenberg/gotenberg:8.40.0@sha256:53073e79…`, Chromium 156, Skia/PDF m156; owner chose the last 8.x over 9.x, OD-41). Playwright Chromium 159.0.8154.6 (browser print). Fonts from `@fontsource/*` 5.3.0 (OFL): Vazirmatn (chosen), Cairo, Noto Naskh Arabic, Amiri; subsets arabic, latin and latin-ext at 400/700, uploaded with the HTML. PDF checks: poppler-utils 25.03.0 (Debian trixie) for `pdffonts`, `pdfinfo` and `pdftoppm`; PDFium 143.0.7483.0 (`pypdfium2` 5.0.0, pinned by hash) for text. PostgreSQL 18.6 with pg_trgm 1.6 and btree_gin. Dart port on the Flutter 3.47.9 SDK with `unorm_dart` 0.3.3 (Dart has no built-in NFC). Node 24.

## Evidence per criterion
Test files are under `spikes/s3-arabic-output/`. Local run on Windows 11 + Docker Desktop (Intel Core i9-14900HX, 32 threads, 32 GB). The owner skipped the CI dispatch of `s3-arabic-output` (OD-43, 2026-11-16): the local run above is the evidence; the manual workflow stays on `main` for Phase A.

| # | Result | Proof |
|---|---|---|
| 1 | Image pinned by version and digest; the container reports 8.40.0; Chromium may load `file:///tmp/` only (allow and deny lists); webhook, download-from, LibreOffice and PDF-engine routes are disabled. All documents render with 0 requests to a canary HTTP server on the same network. A probe page with `<img>`, `<link>` and `fetch()` pointing at the canary is blocked (still 0), while the canary itself answers (control). The canary sees only requests to itself; that other hosts are blocked too rests on the same allow list (seen in Gotenberg's logs during the security review), not on this test. Logs hold operation, document type, status, bytes and ms only | `output/test/gotenberg.test.ts` (5 tests) |
| 2 | Prescription A5 (Latin drug names and doses, a long drug name that wraps), receipt 80/58 mm with every BIL-30 line (lines, tender per currency, change, rounding, balance, rate footer), a 36-line receipt, report A4 over 2 pages, ticket 80/58 mm with an inline-SVG QR code; every one with Western and with Arabic-Indic digits; data from `@shifa/testing` (seed 30033) | `output/src/templates/`, `output/test/pdf-text.test.ts` |
| 3 | **Met except the lam-alef ligature**, which every reader returns reversed (pinned by `extraction-limits.test.ts`; no expected string contains لا). For 7 documents × 2 digit styles: the expected Arabic strings come out of the text layer in logical order, with no presentation forms (Arabic-digit documents also contain no Western digit next to an Arabic one); every font is embedded and is Vazirmatn; page sizes are within 1 mm of `@page` (roll paper: width, one page); the report has its header and "صفحة X من Y" on every page. See "PDF text layer" below for what extraction cannot keep | `pdf-text.test.ts` (58 tests) |
| 4 | Every PDF page matches its golden (pixelmatch threshold 0.1, ≤ 0.5 % differing pixels); 16 PDF and 20 thermal goldens committed after the owner's eye check; a layout shifted by 3 mm fails and writes a diff image | `golden.test.ts` (15 tests, the negative case is permanent), `output/goldens/` |
| 5 | Playwright's print-to-PDF of the same HTML and fonts gives the same page count, page sizes within 1 mm and the same text as Gotenberg, for all documents in both digit styles, across two Chromium versions (156 and 159). Roll paper is compared on width and text: browser printing gets its page length from the printer driver | `parity.test.ts` (14 tests) |
| 6 | Receipt and ticket screenshots at exactly 576 and 384 px (CSS `zoom` 203/96, so CSS mm become printer dots); threshold and Floyd–Steinberg 1-bit; ESC/POS stream `ESC @`, `GS v 0` bands of ≤ 255 rows, `ESC d 3`; a test-side decoder returns the identical bitmap, finds no cut (`GS V`) and no stray byte; the long 58 mm receipt is one stream of several bands; decoded images match their goldens (≤ 0.2 %) | `thermal.test.ts` (22 tests), `test/escpos-decode.ts` |
| 7 | One function, same order in all three ports: NFC; remove tashkeel, superscript alef, Quranic marks, tatweel and bidi controls; fold أ إ آ ٱ → ا, ؤ → و, ئ → ي; word-final ة → ه and ى → ي (word-final = not followed by an Arabic letter); Arabic-Indic and Persian digits → 0–9; ASCII A–Z lower-cased; Unicode spaces, ZWNJ, ZWJ and BOM → one space, trimmed; particles عبد ابو ابي ام ابن بن بنت joined with the next word (two passes, because بن + ت forms بنت); NFC again. The display name is never changed. Not covered: ALM (U+061C) stays in the key and U+2060 (word joiner) stops a particle join, in all three ports alike (backlog) | `search/src/normalise.ts`, `normaliser_dart/lib/normalise.dart`, `search/sql/schema.sql` |
| 8 | `vectors/name-search-vectors.json`: 313 cases, every rule ≥ 5 cases (17 rule groups, incl. interactions, Latin, empty and invisible-only input, every name of the synthetic lists). All pass in TypeScript (325 tests) and Dart (316 tests); idempotence over every vector and 5,000 seeded random strings in both. Negative evidence: dropping ى folding in Dart fails 29 named cases | `search/test/vectors.test.ts`, `parity-vectors.test.ts`, `normaliser_dart/test/vectors_test.dart` |
| 9 | 50,000 synthetic patients (`load` preset, 50 tenants) in `s3.patient_a` and `s3.patient_b` (FORCE RLS, policy on `current_tenant_id()`, GIN `(tenant_id, name_key gin_trgm_ops)`). For each of 8 rule variants, 25 sampled patients typed with that variant: 25/25 found in the top 5 inside `withTenant()` as `shifa_app`, on both tables. Searching tenant B's patient from tenant A returns only tenant A's rows. Limits: no digits or NFC variant in this test (the vectors cover them), the synthetic names hold no ؤ, and for `patient_a` a rule variant gives the identical key by construction, so `patient_b` (SQL key against TypeScript key) is the real evidence | `search/test/search.test.ts`, `schema.test.ts`, `od40-merges.test.ts`, `.verify/s3/search-quality.json`, `od40-merges.json` |
| 10 | The SQL function gives the vector key for all 313 inputs, the same as TypeScript (no drift today); the generated column keeps `display_name` untouched | `key-drift.test.ts`. Comparison below |
| 11 | Render: p50 0.32–0.40 s sequential, 0.78–1.0 s at 5 concurrent, peak 410–520 MiB. Search: 7.7 ms p50 at the `load` volume; 271 ms p50 for one 50,000-patient tenant (sequential scan, OD-42) | `bench:render`, `bench:search`; `.verify/s3/render-bench.json`, `search-bench.json` |
| 12 | This report, [ADR-0034](../adr/0034-arabic-output-and-name-search.md) (Accepted, owner 2026-11-16), ADR-0021 status line, roadmap | — |

## PDF text layer (criterion 3)
What the PDF shows is right in every font; what text extraction returns depends on the font and on the reader:

- **Fonts.** With Noto Naskh Arabic, both poppler and PDFium return words in fragments ("المج موع", "ت وق يع"); Amiri partly; Vazirmatn and Cairo whole. That is why the owner chose Vazirmatn.
- **Readers.** pdftotext (poppler 25.03) wraps runs in bidi embedding controls and still splits some words. PDFium 143 returns clean logical order. PDFium 159 (`pypdfium2` 5.15.2) reverses some Arabic words ("رمع" for "عمر") in the same file. The checks use PDFium 143, pinned.
- **Kept out of the comparison, on both sides (`test/stack.ts` `squash`):** tashkeel, which extraction places before or after its letter depending on glyph positions ("شكًرا" for "شكرًا"); bracket direction, because a mirrored bracket comes out as drawn (")1(" for "(1)"); invisible bidi marks.
- **Lam-alef ligature:** every reader tested returns it reversed ("دوالر" for "دولار", "هللا" for "الله"), so copying such a word from the PDF gives the wrong spelling. Visual output is right. No template choice avoids the ligature; Phase A must not rely on PDF text for search or data exchange.
- **Dates:** the RLM marks that order a date in Arabic text are not in the text layer, so extraction returns the date's numbers in visual order ("2026/11/16"). The checks compare day, month and year separately.

## Thermal (criterion 6) and 58 mm legibility
At 9 pt (owner's choice) every BIL-30 line of the 58 mm receipt fits on one line and the 1-bit image reads cleanly. At 11 pt "المدفوع (ليرة)" and its amount break onto two lines. Threshold and Floyd–Steinberg images are both kept. Threshold is recommended for text, because dithering only adds noise to black-on-white type and for the ticket's QR code. Nobody scanned the QR codes in the spike; check them with a phone on the real printer. A real printer has not been tested (OD-39): before the first pilot, print the goldens' byte streams on the clinics' models.

## Render cost (criterion 11)
`BENCH_RENDER_N=40 pnpm --filter @shifa-spike/s3-output bench:render` (run 2026-11-16, Windows 11 + Docker Desktop, i9-14900HX): 40 renders per document after a warm-up, then 40 more in rounds of 5 concurrent requests; peak container memory from the cgroup's `memory.current` sampled every 100 ms (`.verify/s3/render-bench.json`). Percentiles are nearest-rank (`floor(p·n)`); with n = 40, p95 is the second-largest sample.

| Document | Sequential p50 / p95 (ms) | 5 concurrent p50 / p95 (ms) | Peak memory (MiB) |
|---|---|---|---|
| prescription A5 | 322 / 352 | 874 / 1115 | 432 |
| receipt 80 mm | 399 / 737 | 952 / 1183 | 453 |
| receipt 58 mm | 371 / 603 | 832 / 896 | 438 |
| receipt 58 mm, 36 lines | 347 / 389 | 887 / 1225 | 411 |
| report A4, 2 pages | 351 / 398 | 822 / 937 | 521 |
| ticket 80 mm | 328 / 635 | 1000 / 1855 | 438 |
| ticket 58 mm | 315 / 408 | 782 / 881 | 416 |

Plan a PDF worker for about 0.5 GB per Gotenberg container. One container gave about 2.5–3 PDFs per second one at a time and about 5–6 per second with 5 in flight (a round of 5 finished in about 0.8–1.0 s), so concurrency helps up to a point; more throughput then needs more containers. The p95 values vary between runs on this shared machine (an earlier run with n = 20 had receipt 58 mm at 530 / 1013 ms); no second machine was measured (CI dispatch skipped, OD-43).

## Search (criteria 9–11)
- **Quality** (`.verify/s3/search-quality.json`): every rule variant found 25/25 on both tables. Variants outside the rules, measured only: the family name without `ال` 25/25; given name and family name only 25/25, with 17 other patients ranked above the intended one over the 25 tries; two letters swapped 25/25; one letter missing 25/25 (trigram similarity ≥ 0.3).
- **False matches added by OD-40** (`od40-merges.test.ts`, `.verify/s3/od40-merges.json`): on the 50,000 synthetic patients, 48,352 distinct display names gave 48,352 distinct keys. Particle joining and word-final ة/ى folding merged no two different names. The synthetic lists cannot show real-world collisions (for example names that differ only by a final ه/ة), so this stays a pilot-time check on search logs that hold no names.
- **Latency** (`bench:search`, `BENCH_SEARCH_WARMUP=30 BENCH_SEARCH_ITERATIONS=300`, the same settings as the workflow: 300 queries per table after 30 warm-up, inside `withTenant()`):

| Scenario | Table | p50 / p95 (ms) | Plan |
|---|---|---|---|
| `load`: 50 tenants × 1,000 | `patient_a` (stored key) | 7.7 / 9.6 | bitmap scan on the primary key (`tenant_id`), trigram as a filter |
| `load` | `patient_b` (generated key) | 7.7 / 9.1 | same |
| 1 tenant × 50,000 | `patient_a` | 271 / 309 | sequential scan |
| 1 tenant × 50,000 | `patient_b` | 274 / 314 | sequential scan |

- **Why no GIN under RLS:** pg_trgm's `similarity_op` (`%`) is not `LEAKPROOF`, so PostgreSQL may not evaluate it in an index scan ahead of the RLS policy (only leakproof or policy conditions may run first). A manual check on PostgreSQL 18.6 (one table, 50,000 rows, FORCE RLS, a non-owner role) showed a `Seq Scan` before and, after `ALTER FUNCTION similarity_op(text, text) LEAKPROOF`, a `Bitmap Index Scan` with `Index Cond: tenant_id = … AND name_key % …`. The `ALTER` needs a superuser and promises that the function has no input-dependent errors or side effects (timing is never covered). `similarity()` can raise "out of memory" on inputs over about 358 MB, so the flag is only honest with length limits on keys and search input; it applies database-wide and is lost on a plain dump/restore or an extension update. The conditions are listed in OD-42; the decision is not taken here.

## Stored column or generated column (criterion 10)
- **Generated column** (`s3.normalise_name()`, `IMMUTABLE PARALLEL SAFE`): the database always holds the key for the current display name, whatever writes it (imports, fixes in SQL). The cost is a third copy of the rules (TypeScript, Dart, SQL). A change in any copy needs a migration that rewrites the column, and PostgreSQL's `normalize()` follows the server's Unicode version, so an upgrade could shift keys without a code change.
- **Stored column** written by the API (`normaliseName()` in TypeScript): the server and the offline clients share one tested implementation and the vectors cover both. The risk is a write path that forgets or skips the key: `NOT NULL` catches a missing key, nothing catches a stale one.
- **Recommendation: the stored column**, written only through the patient repository, plus a CI test that runs the vectors through every port. Keep `s3.normalise_name()`'s approach as the drift check (the test showed all three ports agree today). A key-version column lets Phase A re-key rows after a rule change without a long table rewrite.

## Risks left
- No physical printer yet (OD-39): Arabic legibility at 58 mm is proven on images, not paper.
- Lam-alef and date order in the PDF text layer: readers get some words reversed when they copy (above).
- PDFium versions disagree on Arabic extraction; viewers outside Chrome 143's era may show reversed words when users search a PDF.
- Search under RLS needs OD-42 before a tenant grows past a few thousand patients.
- OD-20 (digit style) stays open: both styles render and extract correctly.
- `singlePage` drops overflow silently. Phase A keeps the tear-off block and a check that the PDF has one page and ends with the receipt's last line.
