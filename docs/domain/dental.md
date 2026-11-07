# Dental Module

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-07, RN-12, RN-14, RN-09, RN-02, RN-11

Purpose: specifies the full dental specialty pack approved for Release 1 — chart, periodontics, orthodontics, endodontics, implants, paediatric, oral surgery, prosthodontics, cosmetic, recall, risk, treatment plans, lab cases and dental reporting. Build phase: **Phase B** (after the core platform in Phase A). It builds on [clinical records](clinical-records.md) and [imaging](imaging.md); money flows follow the billing domain doc (three currencies, installments).

Related decisions: ADR-0009 (specialty packs), ADR-0011 (design system), ADR-0013 (API contract), ADR-0019 (imaging). Open questions: OD-08 (commission/installment norms), OD-10 (drug catalogue), OD-17 (clinical sign-off). See [open decisions](../open-decisions.md).

Dentistry is the largest specialty on the leading Syrian directory (~290 of ~667 listings) and no local competitor advertises clinical depth (perio, ortho, endo); depth plus usability is the differentiator. [RN-02], [RN-11 §1], [RN-12 §Q10]

## Odontogram (dental chart)

Usability evidence: new users completed only 43% of charting tasks correctly in legacy products; failures came from procedure-first selection, mixed "existing" and "planned" palettes, missing-vs-extracted confusion and wrong-tooth counting. Rules below address each. [RN-12 §Q1]

- DEN-01 FDI (ISO 3950) notation only: permanent 11–48, primary 51–85; per-patient dentition mode permanent / primary / mixed. Universal/Palmer display: Later. [RN-07 §2]
- DEN-02 Anatomical SVG rendering with buccal + root view and occlusal five-surface view; a compact geometric view toggle.
- DEN-03 Tooth-first interaction: select tooth (or teeth) then action; multi-select by drag, Ctrl/Shift; long-press context menu; typing an FDI number jumps to that tooth.
- DEN-04 Two separate palettes: "Findings / Existing" (base layer) and "Planned treatment" (proposed layer); never mixed in one toolbar.
- DEN-05 Missing and Extracted are distinct items with distinct symbols; missing teeth are dimmed or hidden to prevent wrong-tooth charting.
- DEN-06 Surfaces stored canonically {M, O, D, B, L, V}; I/F/P aliases resolved by tooth position. [RN-07 §2]
- DEN-07 Six statuses with fixed, non-customisable colours: planned, completed (this clinic), existing (this clinic), existing (other clinic), referred, condition.
- DEN-08 Seed set of findings and procedures (~15 core items): caries, fracture, missing, root remnant, periapical lesion, mobility, watch; fillings by material and surfaces, RCT, post & core, crown (material), bridge, veneer, implant, implant crown, extraction, sealant, denture (per arch), scaling (mouth level).
- DEN-09 Bridge wizard (abutments, pontics, cantilever) and grouped prostheses (dentures, splints) stored as one linked group.
- DEN-10 Items at mouth, arch, quadrant and sextant level; supernumerary teeth supported.
- DEN-11 Favourites bar per user with numeric hotkeys; undo for the last actions.
- DEN-12 View filters: base / proposed / completed / all; time slider "chart as of date".
- DEN-13 Per-tooth history drawer: date, dentist, status, item, note, linked images.
- DEN-14 Print/PDF snapshot of the chart with legend; snapshot saved to the patient's images.
- DEN-15 Tablet-sized tap targets; chart usable on a 10-inch tablet chairside.
- DEN-16 Voice charting (Arabic/English): Later. [RN-12 §Q11]

## Periodontics

- DEN-17 BPE screening per sextant (0–4, * for furcation). [RN-12 §Q2]
- DEN-18 Full six-site chart per tooth: probing depth, gingival margin (±), CAL computed automatically, bleeding on probing, suppuration, plaque, calculus; per tooth mobility (Miller), furcation per entrance (Glickman or Hamp, clinic setting), MGJ/keratinised tissue width; skip and implant flags.
- DEN-19 Fast entry: configurable auto-advance path, triplet entry mode, values ≥10 supported, on-screen keypad for tablets, red highlighting above configurable thresholds, previous exam shown as ghost values, copy last exam.
- DEN-20 Indices: sites ≥4 mm and ≥6 mm, BOP %, O'Leary plaque %; exam-to-exam comparison with deltas and trend charts.
- DEN-21 AAP/EFP 2017 staging & grading assistant suggests stage/grade/extent from chart data and bone-loss inputs; clinician confirms; stored with evidence fields. [RN-12 §Q2]
- DEN-22 Patient-friendly Arabic perio report (printable / shareable).

## Diagnosis, examination and notes

- DEN-23 Structured comprehensive exam: extraoral, intraoral soft tissues, occlusion, TMJ screen.
- DEN-24 Per-tooth diagnosis pick-lists: caries, pulpal and periapical (AAE terminology), periodontal; optional ICD-10 mapping.
- DEN-25 Procedure notes auto-generated in Arabic/English from charted items using per-procedure templates; doctor edits, signs, locks; addenda after signing.
- DEN-26 Dental medical-history questionnaire (~20 items, versioned) generates alert chips: anticoagulants/antiplatelets, bisphosphonates/antiresorptives, diabetes, pregnancy, allergies, cardiac conditions. [RN-07 §6]
- DEN-27 5–6 Arabic consent templates (extraction, RCT, implant, orthodontics, whitening, general) signed on tablet; stored as signed PDF with template version.

## Treatment plans and money

- DEN-28 Multiple plans per patient, phased; each item snapshots its price and currency at plan time; item- and plan-level discounts (permission-controlled). [RN-07 §3]
- DEN-29 Plan statuses: draft, presented, accepted, partial, declined, completed; per-item accept/decline; acceptance captured by signature or explicit staff confirmation.
- DEN-30 Printable Arabic quote with optional "rate guaranteed until" date for foreign-currency items.
- DEN-31 Completing a planned item creates the chart entry and the charge in one action.
- DEN-32 Installment schedules linked to a plan: down payment, dated installments, overdue alerts on patient header and reports. [RN-07 §3], [RN-09]
- DEN-33 Tenant-editable internal procedure catalogue (~50 seeded items; Arabic/English names, category, treatment area, chart symbol, lab-required flag, default duration, price per currency). CDT codes are not used (ADA licence is US-only). [RN-07 §3]
- DEN-34 Per-dentist commission rule hook: basis (production or collections), percentage, lab-cost deduction mode; monthly statement (shared billing engine). Advanced rules (per category, assistants, visiting specialists): Later. [RN-07 §9]

## Lab cases

- DEN-35 Lab suppliers per tenant; lab case with teeth, work type, material, shade (VITA), instructions, sent/due/received/fitted dates, status, cost and currency. [RN-07 §4]
- DEN-36 Fitting appointment shows a warning when the case is not received; overdue cases appear on dashboard lists.
- DEN-37 Payables per lab and lab cost per case feed commission calculations. Lab price lists, remakes and lab statements: Later.

## Orthodontics

- DEN-38 Initial ortho exam form: Angle class (molar/canine, per side), overjet, overbite, crowding/spacing per arch, midlines, crossbites, profile, habits. [RN-12 §Q3]
- DEN-39 Standard ortho photo series template (extraoral and intraoral views) with before/after comparison.
- DEN-40 Per-visit ortho log: wire per arch (size/material), elastics, brackets/bands set via prescription, notes, compliance; "copy last visit".
- DEN-41 Aligner tracking: brand, upper/lower stage counts, current stage, dispense log, refinements; attachment map and IPR chart per contact (planned stage, done date).
- DEN-42 Retention record (retainer type, arch, teeth range, dates) and months-in-treatment counter; ortho contract uses DEN-32 installments.
- DEN-43 Cephalometric analysis with manual landmark placement on an uploaded ceph, calibration, Steiner analysis (+ partial McNamara/Downs) with norms version, progress superimposition. AI auto-landmarking: Later.

## Endodontics

- DEN-44 Per-canal table: canal name (MB, MB2, DB, P, …), reference point, estimated/electronic/radiographic/final working length, master apical file size and taper, file system, irrigants, medicament, obturation technique, sealer, status. [RN-12 §Q4]
- DEN-45 Pulp/periapical test table (cold, EPT, percussion, palpation) with results per tooth; AAE diagnosis pick-lists.

## Implants

- DEN-46 Implant placement record: site, product brand/REF/LOT/UDI, diameter × length, insertion torque, bone quality, guide used, healing component, loading protocol. [RN-12 §Q5]
- DEN-47 Repeatable stability measurements (ISQ, torque) over time; graft/membrane records (type, brand, LOT, volume); restorative components (abutment REF/LOT, torque, retention type, crown material).
- DEN-48 Bilingual implant passport (PDF with QR) generated for the patient; implant registry report by LOT.

## Paediatric, surgery, prosthodontics, cosmetic, TMJ

- DEN-49 Paediatric: primary/mixed charting, Frankl behaviour score per visit, sealants, fluoride varnish, stainless steel crowns, space maintainers as chartable items. [RN-12 §Q6]
- DEN-50 Oral surgery: extraction note (technique, sutures, complications) with Arabic post-op instructions handout.
- DEN-51 Prosthodontics: crown/bridge/denture stage tracking (prep, impression, try-in, fit) with shade and material, linked to lab cases.
- DEN-52 Cosmetic: shade records with photos and before/after sets. Digital smile design: Later.
- DEN-53 TMJ screening form and BEWE erosive-wear screen. Full DC/TMD protocol: Later.

## Recall, risk and patient education

- DEN-54 Recall types (prophylaxis, perio maintenance, child, ortho retention, implant maintenance, endo review) with intervals, created automatically from completed procedures; due lists and reminders through the messaging layer. [RN-12 §Q7]
- DEN-55 Caries risk assessment (CAMBRA, age 6+) stored with level and shown on the patient header.
- DEN-56 Arabic oral-hygiene and post-procedure handouts, auto-suggested by procedure, printable or sent via app/WhatsApp.

## Dental imaging (module-specific view)

- DEN-57 Images tagged with tooth numbers appear in the per-tooth history and a tooth-centric image timeline.
- DEN-58 FMX, bitewing and paediatric mounts with manual tooth tagging, brightness/contrast, side-by-side compare and measurement — provided by [imaging](imaging.md) (IMG requirements). CBCT and intraoral-scan (STL) viewing: Later.
- DEN-59 AI radiograph analysis (caries, bone level): Later. [RN-14 §7]

## Dental reports and KPIs

- DEN-60 Day-one reports: production and collections per dentist, treatment-plan acceptance, outstanding balances and installments due, lab cases and payables, appointments and no-shows, commission statement. [RN-07 §8]
- DEN-61 Extended KPIs: plan funnel (presented → accepted → scheduled → completed), unscheduled treatment list, hygiene re-appointment %, recall effectiveness, perio stage distribution, lab turnaround and remakes, implant registry by LOT. [RN-12 §Q9]

## Offline

- DEN-62 Chairside charting tolerates short connection loss: entries are queued locally and synced; conflicting edits on the same tooth are surfaced, not silently overwritten (exact engine per offline ADR / spike).

## Key entities

- `PatientDentition` — tooth presence/eruption state over time.
- `ChartItem` — event-sourced finding/procedure on teeth/surfaces/area with layer, status, material, dates, provider, links.
- `ChartGroup` — bridge/denture/splint units with roles.
- `PerioExam`, `PerioSiteMeasurement`, `PerioToothMeasurement`, `BPEScore`, `PerioClassification`.
- `TreatmentPlan`, `TreatmentPlanItem`, `InstallmentSchedule`, `Installment`.
- `ProcedureCatalogItem`, `PriceListEntry` (per currency).
- `LabSupplier`, `LabCase`, `LabPayment`.
- `OrthoCase`, `OrthoVisit`, `OrthoHardware`, `AlignerSeries`, `AlignerDispense`, `AttachmentPlan`, `IPRPlan`, `Retainer`, `CephAnalysis`.
- `EndoCase`, `Canal`, `EndoTest`.
- `ImplantPlacement`, `StabilityMeasurement`, `GraftMaterial`, `ImplantRestoration`, `ImplantPassport`.
- `RiskAssessment`, `RecallType`, `PatientRecall`, `Handout`, `ShadeRecord`, `ClinicalPhotoSet`.

## Verification notes

- Chart logic is a pure TypeScript package with unit tests: surface alias resolution per tooth, dentition mode transitions, bridge group integrity, status transitions, "as of date" reconstruction from events.
- Perio: CAL = PD + GM sign convention tests; index calculations (BOP %, O'Leary %) against hand-computed fixtures; staging assistant fixtures from published examples (reviewed by the advisor, OD-17).
- Usability: Figma prototype then coded chart tested with 3–5 local dentists on scripted tasks (record missing vs extracted, chart MOD composite, plan a 3-unit bridge, enter a full perio chart); target task success well above the 43% legacy baseline.
- Money: completing a plan item produces exactly one charge in the snapshotted currency; installment schedule totals equal accepted plan totals after discounts.
- Visual regression: chart rendering snapshots in RTL layout for permanent, primary and mixed dentitions.
- Tenant isolation: chart, perio, lab and ortho queries return zero rows across tenants under the application role.
