# Orthopedics Module

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-08, RN-13, RN-14, RN-11

Purpose: specifies the full orthopedic specialty pack approved for Release 1 — body/skeleton chart, region examinations, spine, fractures and casts, injections, procedures and surgery, outcome measures (PROMs), rehabilitation and reports. Build phase: **Phase C**. It builds on [clinical records](clinical-records.md) and [imaging](imaging.md).

Related decisions: ADR-0009 (specialty packs), ADR-0011 (design system), ADR-0019 (imaging), ADR-0024 (licensed clinical content gated per tenant). Open questions: OD-04 (licences: PROMs, AO/OTA), OD-17 (clinical sign-off). See [open decisions](../open-decisions.md).

Design drivers: documentation consumes ~58% of an orthopedic surgeon's clinic day, so speed ("normal except…", one-tap protocols) beats exhaustive forms; laterality is the most common surgical-listing error, so site/side/level must have a single source of truth. [RN-08 §1], [RN-13 §11]

## Body and skeleton chart

- ORT-01 Interactive chart with anterior/posterior full skeleton and body silhouette, built from licence-clean assets (public-domain Wikimedia skeleton art or commissioned); dermatome overlays only from a licence-clean source (Later). [RN-13 §1]
- ORT-02 Zoom panels: hand (digits, joints), foot (rays, joints), spine (C1–S1 and sacrum).
- ORT-03 Explicit laterality chips (Right / Left / Bilateral / Midline) on every selection; no implicit side.
- ORT-04 Tapping a site opens the matching region exam template.
- ORT-05 Pain drawing with 5–6 symptom types (ache, sharp, burning, numbness, pins-and-needles, other) distinguished by colour and pattern; point vs radiating marks; intensity per mark.
- ORT-06 One chart snapshot per visit; side-by-side comparison of two visits.
- ORT-07 Ransford-style pain-drawing scoring: Later.

## Site, side and level — single source of truth

- ORT-08 Every clinical object that refers to anatomy (diagnosis, booking, consent, procedure, op note, imaging tag, injection, orthosis) stores a `SiteRef` value (site, side, digit/ray/level qualifiers) rather than free text.
- ORT-09 A `SiteRef` entered once (e.g. at diagnosis) propagates by default to booking, consent, op note and imaging requests; any later mismatch in side or level raises a blocking warning that requires an explicit reason.
- ORT-10 Printed consent, booking and op note show side and level prominently in words (e.g. "LEFT knee", "L4–L5").

## Region examination templates

- ORT-11 Eight region templates: knee, shoulder, cervical spine, lumbar spine, hip, ankle/foot, hand/wrist, elbow. [RN-08 §2]
- ORT-12 Common skeleton per region: side (mandatory), inspection chips + free text, palpation/tenderness pick-list per region, effusion grade (knee), active/passive ROM in degrees per standard movement with the normal range displayed, power MRC 0–5 (optional ±), neurovascular status with one-tap "NV intact" (mandatory on trauma and cast visits).
- ORT-13 3–8 high-yield special tests per region recorded as positive / negative / equivocal / not done, plus "add other test" (lists per [RN-08 §2], e.g. knee: Lachman, anterior/posterior drawer, McMurray, joint-line tenderness, varus/valgus stress, patellar apprehension, effusion tests).
- ORT-14 "Normal except…" macro fills a normal exam and lets the doctor change only abnormal findings.
- ORT-15 Visit types: new complaint, follow-up, fracture follow-up, post-op, procedure-only, report-only.
- ORT-16 Extended test lists, ROM trend charts and a per-doctor template editor: Later.

## Spine

- ORT-17 Level-based neuro grid per side: motor (MRC) by myotome, light touch and pin-prick by dermatome, reflexes. [RN-13 §4]
- ORT-18 Red-flag checklist (saddle anaesthesia, sphincter disturbance, progressive deficit, fever, cancer history, significant trauma, …) with an alert banner on any positive answer.
- ORT-19 Myelopathy signs panel (e.g. Hoffmann, gait, hand clumsiness).
- ORT-20 Cobb angle values (from imaging measurements) tracked with a trend chart.

## Fractures, casts and trauma clinic

- ORT-21 Fracture episode: bone/segment via `SiteRef`, open/closed, displacement, mechanism, injury date, status. [RN-08 §4]
- ORT-22 Gustilo–Anderson classification is mandatory for open fractures; Tscherne available for closed-fracture soft-tissue grading.
- ORT-23 Eponymous classification pickers with self-authored definitions and drawings: Salter-Harris, Garden, Weber, Neer, Schatzker, Frykman, Mason (definitions reviewed under OD-17). [RN-13 §2]
- ORT-24 AO/OTA code field with syntax validation only (no AO text or illustrations) in the base product.
- ORT-25 AO/OTA guided picker with official wording and illustrations, enabled per tenant once AO Foundation/OTA permission exists. (Gated: licence, OD-04) Paediatric PCCF and AO Spine classifications are separately permissioned. (Gated: licence, OD-04)
- ORT-26 Immobilisation record: type (cast, splint, boot, brace), `SiteRef`, applied / review / planned removal / removed dates, checks performed.
- ORT-27 Weight-bearing status per visit and union status per visit; RUST/mRUST calculator for tibial shaft union.
- ORT-28 Daily fracture-clinic list and cast-clinic queue generated from due follow-ups; reminders for cast removal, follow-up X-ray and suture removal through the messaging layer.
- ORT-29 Complications checklist (infection, non-union, malunion, compartment-syndrome signs, …) with onset date, severity, management.
- ORT-30 VTE assessment field: risk tool, score, prophylaxis agent/dose/duration or reason none (tool selection with advisors, OD-17).

## Injections and in-clinic procedures

- ORT-31 Procedure notes for joint injection (steroid, hyaluronic acid, PRP), aspiration, cast application/removal, dressing and suture removal: `SiteRef`, approach, drug, dose, local anaesthetic, batch/lot and expiry, aspirate description, consent reference. [RN-08 §5]
- ORT-32 Injection log with cumulative counters per site over the last 12 months and configurable interval warnings (common practice: 3–4 steroid injections per joint per year, ≥3 months apart). [RN-13 §10]
- ORT-33 Each procedure is a priced line on the visit invoice; printable Arabic aftercare sheets per procedure.
- ORT-34 PRP course tracking and consumables inventory: Later.

## Surgery

- ORT-35 Surgery booking: procedure, `SiteRef`, levels, hospital, date, anaesthesia type, implants (free text in booking), fee and deposit, status. [RN-08 §7]
- ORT-36 Pre-operative readiness checklist (labs, imaging, consent, fasting, anticoagulant plan, …).
- ORT-37 Procedure-specific Arabic consent templates; printed, signed and uploaded or signed on tablet.
- ORT-38 Procedure-specific operative-note templates (ORIF, arthroscopy, TKA/THA, carpal tunnel release, …): tourniquet, antibiotics, estimated blood loss, findings, implants, complications. [RN-13 §8]
- ORT-39 Implant log per procedure: component role, manufacturer, brand, REF, lot, size, GTIN/UDI, expiry, fixation, cement lot; barcode scanning from the device camera. [RN-13 §5]
- ORT-40 Post-operative protocol templates (phases with day offsets, weight-bearing, ROM limits, brace settings, exercises, review dates) that auto-create follow-up appointments.
- ORT-41 Surgeon logbook generated automatically from procedures and the surgeon's role.
- ORT-42 Arthroplasty follow-up schedule template and registry-style data capture.
- ORT-43 UDI scanning against registries, hospital OR integration and digital templating (TraumaCad/mediCAD): Later.

## Outcome measures (PROMs)

- ORT-44 PROM engine: instrument definitions with version, language, scoring algorithm; administration on tablet in clinic or via patient link; scores stored with time-point and charted over time. [RN-13 §3]
- ORT-45 Each instrument is enabled per tenant only when a matching licence record exists (`TenantInstrumentLicence`); unlicensed instruments are hidden. (ADR-0024)
- ORT-46 Launch set (after written confirmation of free use, OD-04): pain NRS/VAS, SPADI, FAAM, ASES, KOOS JR, HOOS JR, IKDC; plus an "external score" field to record a paper questionnaire total.
- ORT-47 Licensed set enabled as contracts close: Oxford Knee/Hip/Shoulder/Elbow (validated Arabic OKS exists), QuickDASH (Arabic and Turkish exist; commercial licence CAD 1,250 first year + fees), ODI 2.1a (Arabic), KOOS/HOOS, EQ-5D-5L (Arabic), NDI. (Gated: licence, OD-04)
- ORT-48 AOFAS is excluded (its owner recommends against use).
- ORT-49 PROMIS CAT, scheduled remote PROM programmes with reminders and registry exports: Later.

## Rehabilitation, orthoses and sports

- ORT-50 Physiotherapy referral letter (Arabic) with diagnosis, restrictions and goals. [RN-08 §8]
- ORT-51 Own Arabic home-exercise library (original illustrations; video via QR link) linked to post-op protocols; printable or sent as PDF.
- ORT-52 Orthosis/brace order form: device, `SiteRef`, size, settings, wear schedule, supplier, review date.
- ORT-53 Sports injury episode with a return-to-sport milestone checklist.
- ORT-54 Physitrack/Medbridge integration: Later.

## Diagnoses, prescriptions and reports

- ORT-55 Orthopedic diagnosis list in Arabic/English mapped to WHO ICD-10 with a separate side field (knee OA, low back pain, disc herniation, fractures, frozen shoulder, carpal tunnel, …); codes verified against the official browser before release. [RN-08 §9]
- ORT-56 Prescription templates by drug class (NSAIDs, PPIs, muscle relaxants, vitamin D/calcium, VTE prophylaxis) with local brands (OD-10).
- ORT-57 Report templates: sick leave, medical report, injury report, fitness certificate, referral letter — auto-filled, immutable once issued. [RN-08 §10]
- ORT-58 Saved plan bundles per diagnosis (e.g. "knee OA conservative": Rx + exercise sheet + follow-up 6 weeks).

## Imaging (module-specific view)

- ORT-59 Imaging tagged by modality, region, side and study date appears on the episode timeline; serial X-ray side-by-side comparison. [RN-08 §6]
- ORT-60 Measurements stored as structured data from the viewer (length, angle, Cobb, HKA, hallux valgus angle and IMA, leg-length discrepancy) with calibration status; see [imaging](imaging.md).

## Later (explicitly deferred)

Interactive anatomical atlas, AI scribe/ambient listening, AI-assisted AO/OTA suggestion from reports, union-time and complication analytics per surgeon, registry exports, digital templating integration.

## Key entities

- `AnatomicalSite` — reference list of sites (region, structure, laterality-applicable, display names, SVG path id).
- `SiteRef` — value object: site + side + digit/ray/level qualifiers; used everywhere.
- `OrthoEpisode` — trauma / elective / spine / sports / arthroplasty / paediatric episode linking encounters.
- `BodyChartSnapshot`, `PainMarker` — per-visit drawing and marks.
- `RegionExam`, `SpecialTestResult`, `NeuroLevelFinding`, `RedFlagScreen`, `MyelopathySign`.
- `FractureDiagnosis`, `ClassificationSystem`, `ClassificationCode`, `ClassificationAssignment`.
- `Immobilisation`, `UnionAssessment`, `Complication`, `VTEAssessment`.
- `Injection`, `ProcedureRecord`, `Consent`, `SurgeryBooking`, `OperativeNote`, `ImplantUsage`, `PostOpProtocol`, `SurgeonLogbookEntry`.
- `PROMInstrument`, `TenantInstrumentLicence`, `PROMAdministration`.
- `ExerciseItem`, `ExercisePrescription`, `OrthosisOrder`, `ReturnToSportAssessment`.

## Verification notes

- Laterality: tests create a diagnosis on the LEFT knee and attempt a RIGHT-side consent/op note — the API rejects without an explicit override reason; printed documents show side in words.
- Licence gating: with no `TenantInstrumentLicence`, licensed PROMs and the AO guided picker are absent from API responses and UI; adding a licence record enables them without a deploy.
- Scoring: each PROM scoring algorithm tested against published worked examples; injection counters tested across the 12-month window boundary.
- Classification content: self-authored definitions carry reviewer and date (OD-17); no AO text/illustration assets exist in the repository without a licence record.
- Usability: scripted tasks with 3–5 local orthopedic surgeons (knee exam "normal except", fracture follow-up with cast removal booking, injection with counter warning) measured for time and errors.
- Tenant isolation: episode, procedure, PROM and implant-log queries return zero rows across tenants under the application role.
