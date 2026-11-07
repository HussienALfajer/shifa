# Roadmap

Status: Living document — the single source of project status · Last updated: 2026-11-08 · Owner: product owner

Release 1 is built in phases. Each phase is split into slices (one slice = one session = one small PR, see [development-workflow](process/development-workflow.md)). Slice details and hand-over notes live in [docs/slices](slices/README.md); this file only tracks phases and slice status.

Rough estimate for a team of 4–5 developers working with Claude Code: pilot after Phases A + B in about 6 months, full Release 1 in about 10–12 months. Treat it as a planning guess, not a commitment.

## Phase overview

| Phase | Content | Exit criteria | Status |
|---|---|---|---|
| 0.1 Re-documentation | Archive research, write product, domain, ADR, compliance and process docs | Owner reviewed the docs | Done 2026-11-08; published to the public repository (ADR-0026); awaiting owner review |
| 0.2 Foundation (harness) | Repo, tooling, quality gates, Claude Code setup, CI — no features | Checklist below all green | Not started |
| 0.3 Spikes | Prove risky technology choices with throwaway code | Each spike has a written result and an ADR update | Not started |
| 0.4 Design system foundations | Tokens pipeline, base components, Flutter theme from the same tokens | Storybook with core components, visual and a11y tests in CI | Not started |
| A Core platform | Super admin, tenancy, patients, scheduling and queue, voice calling, billing in three currencies, general clinical template, prescriptions, reports, messaging, patient app, public booking pages, offline reception | 10 pilot clinics run a full day without paper; phase audit passed | Not started |
| B Dental | Full dental module | Pilot dental clinics use charting, perio, plans and installments daily; advisor sign-off (OD-17) | Not started |
| — Pilot gate | Closed pilot with dental and general clinics after A + B | 4 weeks of daily use; findings triaged | — |
| C Orthopedics | Full orthopedics module, PROM engine, licensed content when signed | Advisor sign-off; laterality safety tests green | Not started |
| D Imaging | DICOM archive, viewer, uploads, dental mounts, edge box, capture bridge | Real pan/CBCT upload tested on Aleppo links (OD-18) | Not started |
| Release 1 | A–D complete, dual audit, MoH approval path progressed (OD-02) | Owner go decision | — |

## Phase 0.2 — foundation checklist

Nothing in Phase A starts before every item is done.

- [x] Git repository: public on GitHub at `HussienALfajer/shifa`, created 2026-11-08 ([ADR-0026](adr/0026-public-repository.md)).
- [ ] Protected `main`, branch naming, auto-delete of merged branches, secret scanning and push protection.
- [ ] Development environment in WSL2 (sandbox support, Linux parity, line endings).
- [ ] Monorepo skeleton (pnpm + Turborepo + Flutter via FVM) per [architecture overview](architecture/overview.md).
- [ ] Strict TypeScript, type-aware ESLint (incl. no-floating-promises), Biome or Prettier, `very_good_analysis` for Dart, file-length limits.
- [ ] `verify` command in two modes: fast (affected packages, cached) and full (PR/CI); short summary output, full logs on disk.
- [ ] Test guard (one test run at a time), per-worker test databases (Testcontainers), fixed clock helpers.
- [ ] Architecture tests: module boundaries, route permission matrix, RLS policy present on every tenant table, cross-tenant isolation suite run as the app's non-owner role.
- [ ] Drift checks: OpenAPI vs code, generated TS/Dart clients, migrations, design tokens, translations.
- [ ] Synthetic multi-clinic data generator ([data handling](compliance/data-handling.md)).
- [ ] CI: pinned actions, secret scanning, dependency audit, 24-hour minimum package age, boot check of built apps, PR size budget, instruction-size budget.
- [ ] Claude Code setup: root and per-package CLAUDE.md, `.claude/rules`, settings and permissions, hooks, reviewer/checker/security agents, skills (see [development-workflow](process/development-workflow.md)).
- [ ] Observability skeleton (OpenTelemetry, GlitchTip), backup scripts (pgBackRest) and a restore drill.

## Phase 0.3 — spikes

| Spike | Question | Result goes to |
|---|---|---|
| S1 Offline sync | PowerSync vs custom outbox under real network cuts, for queue, appointments and cash | ADR-0014, OD-05 |
| S2 Tenant isolation | Drizzle + RLS + PgBouncer transaction mode; leak tests | ADR-0004/0005 |
| S3 Arabic output | Arabic PDF (Gotenberg), thermal receipt rendering, Arabic name search normaliser | ADR-0021 |
| S4 Imaging | Garage + Orthanc + OHIF; upload a real CBCT over an Aleppo-like link | ADR-0019, OD-18 |
| S5 WhatsApp | WAHA (GOWS) with linked numbers, throttling, opt-in, reverse verification | ADR-0016/0017, OD-12 |
| S6 Voice | Listening test: Azure ar-SY vs Google vs SILMA with 5 receptionists; kiosk autoplay on cheap Android TV boxes | ADR-0020, OD-11 |
| S7 Push | FCM delivery on common Android phones in Aleppo and Azaz | ADR-0017 |
| S8 Charts | Figma prototypes of odontogram, perio entry and skeleton chart tested with 3–5 doctors | dental, orthopedics docs |

## Phase A slices

Slice list is created at the start of the phase with the `/slice-plan` skill and recorded here.

| Slice | Title | Risk tier | Status |
|---|---|---|---|
| — | (to be planned) | — | — |

## After Release 1 (candidates)

Other specialties (paediatrics, OB/GYN first), custom domains, clinic template builder, doctor-specific modules, cross-clinic sharing with consent, telemedicine (audio first), online payments and wallets, public reviews (OD-15), Turkish UI (OD-16), iOS app, medication reminders, lab and radiology orders, inventory, AI (dictation, imaging second opinion), FHIR R4 API.
