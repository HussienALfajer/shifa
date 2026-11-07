# Product vision

Status: Draft · Last updated: 2026-11-08 · Owner: product owner
Sources: RN-01, RN-02, RN-03, RN-11

Shifa (شفاء) is a multi-tenant platform that lets private clinics in Syria run their day (appointments, walk-in queue, medical records, cash in three currencies) and lets patients book, follow their turn and keep their records on their phone. This document states who it serves, the problem, the bet and the boundaries. Detailed scope is in [scope-release-1.md](scope-release-1.md).

## Market and launch

- First market: Aleppo city and Azaz (northern Aleppo countryside), Syria. Expansion to other Syrian cities later; regional expansion is not a Release 1 goal.
- Clinics: solo doctors with a receptionist, multi-doctor clinics, and multi-branch medical groups. One product serves all three ([ADR-0006](../adr/README.md)).
- Release 1 specialties: a general template for every doctor, plus dentistry and orthopedics. Other specialties come in later releases. The super admin assigns each doctor's specialty.

## Problem

- Clinics run on a receptionist's notebook, phone calls and a paper queue ("نظام الدور"); patients wait for hours without knowing their turn [RN-11 §1].
- Records are on paper; X-rays arrive on films, CDs and phones.
- Money is cash in three currencies (new Syrian pound, Turkish lira, US dollar) with daily-changing rates [RN-09 §1].
- Power and internet cuts are routine [RN-03].
- Existing Syrian apps are booking directories with shallow clinical depth; none serves Azaz; none offers deep dental or orthopedic records [RN-02, RN-11 §1].

## The bet

Win clinics by making the receptionist's day faster than paper, even during outages, and the doctor's documentation faster than a generic EMR, then grow patient adoption through the clinic's own patients.

Differentiators, in order of importance:
1. One engine for appointments and the walk-in queue, with a waiting-room screen and Arabic voice calling that keep working without internet.
2. Professional dental and orthopedic modules at the level of leading international products (charts, perio, orthodontics, fractures, imaging).
3. Cash billing in three currencies with exchange rates, mixed-currency receipts and per-currency cash drawers.
4. A patient app with family profiles, live queue position and records released by the clinic.
5. Built for Syria: Arabic RTL first, Android-first, offline-tolerant, no dependency on SMS.

## Users

| User | Main job in Shifa |
|---|---|
| Receptionist (السكرتيرة) | Register patients fast, run the queue, take bookings, collect cash, print tickets and receipts |
| Doctor | See the patient summary, chart and document fast, prescribe, order follow-ups |
| Clinic owner / admin | Staff, schedules, prices, currencies, reports, settings |
| Accountant | Cash sessions, receipts, balances, doctor commissions |
| Patient (and family) | Find a doctor, book or take a queue number, follow the turn, see records |
| Platform super admin | Onboard clinics, verify doctors, assign specialties, enable features, support |

## Principles

- **The receptionist decides adoption.** Every front-desk flow must beat the paper notebook in speed.
- **One model, adaptive UI.** No separate products for solo and multi-branch clinics.
- **Configuration over customisation.** Clinic-specific needs go through settings, custom fields, templates and entitlement-gated modules, never code forks ([ADR-0007](../adr/README.md)).
- **Clinical safety and integrity.** Signed notes are immutable, every read of a record is audited, laterality and tooth numbers are validated.
- **Privacy by default.** Number-only voice calling by default, consent before sharing records across clinics, no real patient data in development ([ADR-0023](../adr/README.md)).
- **Honest dependencies.** Every external platform (WhatsApp, Google, Azure) sits behind an adapter with a fallback, because access from Syria changes without notice.

## Out of scope for Release 1

Other specialties, custom domains, a template/form builder for clinics, telemedicine, online payments and wallets, public reviews, insurance, lab/radiology test ordering, inventory, payroll, AI features, an iOS app (iPhone users use the web booking page) and a Turkish UI. See [scope-release-1.md](scope-release-1.md) and [roadmap.md](../roadmap.md).

## Business model

Deferred by the owner (OD-07). Research suggests a per-doctor subscription with a free patient app and no per-booking commission [RN-01, RN-02]; licence costs for clinical content (OD-04) must be reflected when pricing is set.
