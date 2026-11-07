# Release 1 scope

Status: Approved by owner (2026-11-07/08) · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-07, RN-08, RN-09, RN-10, RN-11, RN-12, RN-13, RN-14, RN-15

This is the approved feature list for Release 1, one line per capability. Detailed, testable requirements live in the domain documents linked from each section; this file only says *what is in*. Anything not listed here is out of Release 1 (see the end). Build order is in [roadmap.md](../roadmap.md).

## 1. Platform and super admin — [platform-and-configuration](../domain/platform-and-configuration.md) · Phase A

- Clinic accounts of three kinds (solo doctor, multi-doctor, multi-branch) on one model; status (trial, active, suspended); subscription end date set manually.
- Doctor verification (ID, certificate, practice licence) with a verified badge; unverified doctors are not public.
- Specialty assignment per doctor (general, dental, orthopedics), which enables the matching template pack.
- Per-clinic feature toggles and numeric limits (doctors, branches, custom fields); the mechanism for doctor-specific features.
- Support access to a clinic: read-only by default, time-boxed, reason required, audited.
- Reference data: drug catalogue, diagnosis lists, default dental and orthopedic catalogues, consent and report templates, cities and areas (Aleppo neighbourhoods, Azaz).
- User/phone reset, per-clinic usage metrics, WhatsApp session health, announcement banner, platform audit log, mandatory MFA for super admins.

## 2. Clinic system core — Phase A

**Accounts, branches, users** — [platform-and-configuration](../domain/platform-and-configuration.md)
- Basic multi-branch: hours, price lists, cash boxes, rooms/chairs per branch; patients shared across a clinic's branches.
- Roles: owner/admin, doctor, receptionist, assistant, accountant; receptionists don't see clinical notes by default; doctors see "my patients" or all.
- One doctor account working in several clinics with a clinic switcher.

**Patients** — [clinical-records](../domain/clinical-records.md)
- Fast registration (name, phone, age/DOB, sex), auto file number, Arabic-normalised search, duplicate warning.
- Several patients under one phone (family); one-screen patient summary; Excel import.

**Appointments and queue** — [scheduling-queue](../domain/scheduling-queue.md)
- Working hours per doctor per branch, exceptions, appointment types.
- Two booking modes per doctor/shift: time slots or queue numbers.
- One daily queue merging walk-ins, phone, app and web bookings, with statuses; emergency priority; next-patient.
- Database-level double-booking prevention; online booking rules; booking requests; bulk delay notice.
- Thermal queue ticket with QR; waiting-room TV screen; one-tap follow-up booking; no-show counter.

**Voice calling** — [voice-calling](../domain/voice-calling.md)
- Chime + number + room in a Syrian Arabic voice (Turkish optional for Azaz); number-only by default, first-name mode optional with per-patient opt-out.
- Works offline from pre-generated voice packs; next / recall / call specific / no-show / skip; doctor can call from their room.
- Visual flash, last-5-calls strip, no overlapping audio, volume schedule, display status and test sound, call log; "go to room 2" push to the patient app.

**General clinical template** — [clinical-records](../domain/clinical-records.md)
- Structured visit note, vitals, diagnoses (curated list mapped to ICD-10), history (allergies, chronic diseases, medications, surgeries), attachments.
- Saved plan bundles per doctor; sign and lock with addenda.
- Prescriptions from a Syrian drug catalogue with favourites and templates, allergy/pregnancy banner, A5 letterhead printing, sharing to the patient app.
- Medical reports: sick leave, medical report, referral letter, issued copies immutable.

**Billing in three currencies** — [billing-multicurrency](../domain/billing-multicurrency.md)
- New SYP, TRY, USD; clinic base currency locked; clinic-managed receive/give rates with history and guards.
- Per-service price in its own currency; invoice in the pricing currency; mixed-currency payment on one receipt with change and SYP rounding.
- Partial payments, deposits, installments, refunds and discounts with permission; void instead of delete.
- Per-cashier, per-currency cash sessions and daily close; expenses; Arabic receipts showing rates; doctor commission statement; SYP display mode.

**Messaging and verification (no SMS)** — [messaging-and-verification](../domain/messaging-and-verification.md)
- Push + in-app inbox as primary channel; each clinic links its own WhatsApp Business number (self-hosted gateway) as secondary channel.
- Confirmation, day-before reminder, delay notice, follow-up reminder; opt-in/opt-out; throttling and automatic pause on warnings; manual send queue as fallback.
- Phone verification by the patient sending a code to the platform's WhatsApp; reception QR verification as fallback.

**Reports** — in the domain documents
- Daily cash close per currency; revenue and collections by doctor, branch and period in a chosen currency; balances and due installments; appointments, no-shows, new patients; doctor commission; follow-up due lists; Excel and PDF export.

**Settings and customisation** — [platform-and-configuration](../domain/platform-and-configuration.md)
- Clinic profile and branding (logo, letterhead, stamp, signature); print templates with fixed layout options.
- Custom fields on the patient file (up to 20, fixed types, role visibility, core fields protected).
- Editable WhatsApp message texts with placeholders; public clinic/doctor page on a platform subdomain with QR.

**Offline operation** — [scheduling-queue](../domain/scheduling-queue.md)
- Reception keeps today's queue: register walk-ins, take cash, print tickets and receipts offline; sync on reconnect; printable day list.

## 3. Dental module (full) — [dental](../domain/dental.md) · Phase B

- Professional odontogram: anatomical and geometric views, FDI permanent/primary/mixed, tooth-first selection, separate findings vs planned palettes, clear missing vs extracted, multi-select, bridge wizard, arch/quadrant/sextant items, filters, chart-as-of-date, PDF print.
- Full periodontal chart (BPE, 6-site with auto CAL, BOP, mobility, furcation…), fast keypad entry, indices, exam comparison, AAP/EFP 2017 staging/grading assistant, patient perio report.
- Orthodontics: initial records, photo series, per-visit wire/elastic/bracket log, aligner stages with attachments and IPR, retention, manual cephalometric tracing (Steiner + partial McNamara/Downs).
- Endodontics per canal; implants with traceability, ISQ, grafts and an implant passport.
- Paediatric, oral surgery, prosthodontics with lab linkage, cosmetic shade/photo records, TMJ and BEWE screening.
- Treatment plans with phases, prices, acceptance and installments; tenant-editable catalogue (no CDT); lab cases; dental history alerts; Arabic consents with tablet signature; dental prescriptions.
- Auto-generated notes from charted procedures, recall system, CAMBRA caries risk, Arabic handouts, dental KPIs.

## 4. Orthopedics module (full) — [orthopedics](../domain/orthopedics.md) · Phase C

- Interactive skeleton/body chart with hand, foot and spine zoom panels, laterality chips, pain drawing by symptom type, per-visit snapshots.
- One source of truth for site/side/level propagated to diagnosis, booking, consent, op note and imaging, with mismatch warnings.
- Eight region exam templates; spine neuro grid, red flags, myelopathy signs, Cobb trend.
- Fractures: open/closed, Gustilo-Anderson, Tscherne, eponymous classifications, AO/OTA code field; full AO/OTA picker once licensed; fracture and cast clinics; RUST; complications; VTE assessment.
- Outcome questionnaires (PROMs) engine with per-clinic licence gating: free instruments at launch, licensed ones (Oxford, QuickDASH, ODI, KOOS/HOOS, EQ-5D, NDI) once signed (OD-04).
- Injection log with per-joint counters; procedure-specific op notes and consents; post-op protocols; implant log with barcode; surgeon logbook.
- Arabic home-exercise library, orthosis orders, sports return-to-play checklist, orthopedic reports.

## 5. Medical imaging — [imaging](../domain/imaging.md) · Phase D

- Web DICOM viewer (2D, CT/CBCT MPR, prior comparison) with length, angle, Cobb, HKA, hallux valgus and leg-length tools, calibration, measurements stored as data.
- DICOM and patient-CD upload from the browser with resumable uploads; phone photos of films.
- Dental mounts (FMX, bitewing, paediatric) with tooth tagging and per-tooth image history; orthopedic serial comparison.
- Temporary share links; audit of every view.
- For clinics with X-ray devices: clinic edge box (store and forward) and a Windows capture bridge for intraoral sensors and cameras.

## 6. Patient app (Android) and public booking pages — [patient-app](../domain/patient-app.md) · Phase A

- Login with WhatsApp reverse verification; family profiles; search by specialty, city/area and name with verified badges.
- Doctor page with fees in currencies; book a slot or take a queue number; live queue position, "turn is near" and "you are called" pushes.
- Reminders with confirm/cancel/reschedule within clinic rules; delay notices; my appointments.
- My medical file: items released by clinics plus self-reported basics; notifications inbox; battery-optimisation guide; consent/privacy screen.
- Public booking web pages reachable by link or QR without installing (also serves iPhone users).

## 7. Security and integrity (all phases)

- Tenant isolation enforced in the database; audit log of clinical and financial changes and of every record view.
- Auto-logout; MFA for clinic owners (optional for others); encryption in transit and at rest; daily encrypted off-site backups with tested restore; full data export per clinic.

## Not in Release 1

Other specialties · custom domains · clinic-facing template/form builder · doctor-specific custom features (mechanism ships, no modules built) · voice charting · AI (imaging, scribe, ceph landmarks) · CBCT implant planning, STL viewer, smile design · DC/TMD full protocol · arthroplasty digital templating · telemedicine · online payments and wallets · public reviews (OD-15) · medication reminders · lab/radiology test orders · inventory · payroll · insurance · waitlist and recurring appointments · cross-clinic record sharing · iOS app · Turkish UI (OD-16).
