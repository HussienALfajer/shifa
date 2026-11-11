# Roadmap

Status: Living document — the single source of project status · Last updated: 2026-11-11 · Owner: product owner

Release 1 is built in phases. Each phase is split into slices (one slice = one session = one small PR, see [development-workflow](process/development-workflow.md)). Slice details and hand-over notes live in [docs/slices](slices/README.md); this file only tracks phases and slice status.

Rough estimate for a team of 4–5 developers working with Claude Code: pilot after Phases A + B in about 6 months, full Release 1 in about 10–12 months. Treat it as a planning guess, not a commitment.

## Phase overview

| Phase | Content | Exit criteria | Status |
|---|---|---|---|
| 0.1 Re-documentation | Archive research, write product, domain, ADR, compliance and process docs | Owner reviewed the docs | Done 2026-11-08; owner reviewed and approved 2026-11-08 |
| 0.2 Foundation (harness) | Repo, tooling, quality gates, Claude Code setup, CI — no features | Checklist below all green | In progress (0.2-01 to 0.2-07b done) |
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
- [x] Protected `main` (PR required, linear history, no force push, admins included), squash-only merges, auto-delete of merged branches, GitHub secret scanning and push protection — 2026-11-08. Branch naming: `<type>/<phase>-<nn>-<name>`.
- [ ] Development environment in WSL2 (sandbox support, Linux parity, line endings). Line endings done (`.gitattributes`, `.editorconfig`, Biome `lf`); the owner installs Ubuntu and the repository moves into WSL in slice 0.2-09a.
- [x] Monorepo skeleton (pnpm + Turborepo + Flutter via FVM) per [architecture overview](architecture/overview.md). pnpm + Turborepo done in 0.2-01; Flutter 3.47.9 via FVM and the pub workspace in 0.2-04.
- [x] Strict TypeScript, type-aware ESLint (incl. no-floating-promises), Biome for formatting (chosen 2026-11-08), `very_good_analysis` for Dart, file-length limits. TypeScript side done in 0.2-01 (TypeScript 6.0 until typescript-eslint supports 7); Dart (`very_good_analysis`, 400-line Dart limit) in 0.2-04.
- [x] `verify` command in two modes: fast (affected packages, cached) and full (PR/CI); short summary output, full logs on disk — 0.2-01 (extended per toolchain as slices land).
- [x] Test guard (one test run at a time), per-worker test databases (Testcontainers), fixed clock helpers. Clock helpers in 0.2-01 (`packages/testing`); DB harness, guard and `packages/db` (`withTenant`, roles, baseline migration) in 0.2-05.
- [x] Architecture tests: module boundaries, route permission matrix, RLS policy present on every tenant table, cross-tenant isolation suite run as the app's non-owner role. Route permission matrix done in 0.2-06c; RLS presence check, table classification and isolation suite in 0.2-06b; module boundaries in 0.2-06d.
- [ ] Drift checks: OpenAPI vs code, generated TS/Dart clients, migrations, design tokens, translations. Runner (`check-drift`, `drift` step of `verify`) and migration drift done in 0.2-07a; OpenAPI drift done in 0.2-07b; TS and Dart client drift (with a size budget) in 0.2-07c; translation drift (typed keys, Flutter ARB) and the ICU/plural/error-code checks in 0.2-07d; the design-token check registers with the 0.2-07a runner in the first Phase 0.4 slice, when `packages/tokens` exists.
- [x] Synthetic multi-clinic data generator ([data handling](compliance/data-handling.md)). Primitives in 0.2-08a; `generateDataset` with `minimal`/`demo`/`load` presets in 0.2-08b. Dental charts, fractures, PROM answers and DICOM join with Phases B–D; insert helpers land with each Phase A table.
- [x] CI: pinned actions, secret scanning, dependency audit, 24-hour minimum package age, boot check of built apps, PR size budget, instruction-size budget. All but the boot check done in 0.2-02; the API boot check (`verify:full` build + boot steps) in 0.2-06a; later apps add theirs when they land.
- [ ] Claude Code setup: root and per-package CLAUDE.md, `.claude/rules`, settings and permissions, hooks, reviewer/checker/security agents, skills (see [development-workflow](process/development-workflow.md)). Root CLAUDE.md, settings, deny rules, hooks, agents, process skills and the patient-data rule done in 0.2-03; per-package CLAUDE.md files, path rules and the domain skills (`/db-migration`, `/rls-policy`, `/add-endpoint`, `/ui-component`, `/flutter-screen`) land with the slices that create those packages (0.2-04 to 0.2-07; `packages/db/CLAUDE.md`, `.claude/rules/db.md` and `/db-migration` done in 0.2-05; `apps/api/CLAUDE.md` and `.claude/rules/api.md` in 0.2-06a; `/add-endpoint` in 0.2-06c; `/rls-policy` in 0.2-06b); `/release` with the first deployment.
- [ ] Observability skeleton (OpenTelemetry, GlitchTip), backup scripts (pgBackRest) and a restore drill.

## Phase 0.2 slices

| Slice | Title | Risk tier | Status |
|---|---|---|---|
| 0.2-01 | Repository settings, TypeScript monorepo skeleton, Biome + ESLint, `verify`, instruction budgets | T1 | Done (#1) |
| 0.2-02 | CI: pinned actions, gitleaks, dependency audit, workflow lint, PR size budget, required checks on `main` | T0 | Done (#2) |
| 0.2-03 | Claude Code setup: root CLAUDE.md, settings and deny rules, hooks, agents, process skills, patient-data rule | T0 | Done (#3, #4) |
| 0.2-04 | Flutter via FVM, pub workspace, `very_good_analysis`, Dart in `verify` | T1 | Done (#7) |
| 0.2-05 | Database test harness: Postgres via Testcontainers, per-worker databases, test guard, `packages/db` with Drizzle and `withTenant` ([slice](slices/0.2-05-db-test-harness.md)) | T0 | Done |
| 0.2-06a | API skeleton (NestJS + Fastify), health, sanitised error logging, CI boot check of the built app ([slice](slices/0.2-06a-api-skeleton.md)) | T0 | Done (#10) |
| 0.2-06b | RLS presence check and cross-tenant isolation suite as `shifa_app`; `/rls-policy` ([slice](slices/0.2-06b-rls-isolation-suite.md)); independent of 0.2-06a | T0 | Done (#14) |
| 0.2-06c | Fail-closed route permissions, route permission matrix test; `/add-endpoint` ([slice](slices/0.2-06c-api-access-and-boundaries.md)); after 0.2-06a | T0 | Done (#12) |
| 0.2-06d | API module boundaries: lint rule + compiler-API architecture test ([slice](slices/0.2-06d-module-boundaries.md)); parallel with 0.2-06c | T1 | Done (#13) |
| 0.2-07a | Drift-check runner (`check-drift`, in `verify`) and migration drift ([slice](slices/0.2-07a-drift-runner-and-migrations.md)) | T1 | Done (#16) |
| 0.2-07b | `packages/contracts` (named Zod schemas, error catalogue), `@Contract` validation and start-up check, committed OpenAPI 3.1 ([slice](slices/0.2-07b-contracts-and-openapi.md)); after 0.2-07a | T1 | Done (#17) |
| 0.2-07c | Generated TS (`openapi-typescript`) and Dart (`swagger_parser`) clients, fixtures, size budget ([slice](slices/0.2-07c-generated-clients.md)); after 0.2-07b | T1 | Done |
| 0.2-07d | `packages/i18n` shared translation source, ARB generation, ICU/plural/error-code checks ([slice](slices/0.2-07d-i18n-source-and-checks.md)); after 0.2-07b and 0.2-07c | T1 | Done (#22) |
| 0.2-08a | Synthetic data primitives: seeded random, ids, Syrian names, synthetic phones, money ([slice](slices/0.2-08a-synthetic-primitives.md), [spec](specs/foundation/0.2-08-synthetic-data-generator.md)) | T1 | Done (#25) |
| 0.2-08b | Synthetic dataset: tenancy model, `minimal`/`demo`/`load` presets, integrity checks ([slice](slices/0.2-08b-synthetic-dataset-and-presets.md)); after 0.2-08a | T1 | In review |
| 0.2-09a | WSL2 move: Ubuntu 26.04 setup guide, `pnpm env:check`, sandbox proof; Windows stays as fallback ([slice](slices/0.2-09a-wsl2-move.md), [spec](specs/foundation/0.2-09a-wsl2-move.md)) | T0 | Planned |
| 0.2-09b | Observability skeleton: OpenTelemetry, GlitchTip, local Grafana stack, telemetry leak test ([spec](specs/foundation/0.2-09b-observability-skeleton.md)); after 0.2-09a | T0 | Spec approved |
| 0.2-09c | pgBackRest on Garage, PITR scripts, weekly CI restore drill ([spec](specs/foundation/0.2-09c-backups-and-restore-drill.md)); after 0.2-09a | T0 | Spec approved |

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
