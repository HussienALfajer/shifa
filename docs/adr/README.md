# Architecture Decision Records

Status: Living index · Last updated: 2026-11-08 · Owner: product owner
Sources: [ADR-0001](0001-record-architecture-decisions.md)

Purpose: this folder holds every decision that shapes Shifa's architecture, product structure or way of working. Research in `docs/research/archive/` is evidence; these files are the decisions. Where the two disagree, the ADR wins.

## Rules
- One decision per file, named `NNNN-kebab-title.md`, numbered in order.
- **Accepted** ADRs are never rewritten. Only the status line may change (`Superseded by ADR-NNNN`). To change a decision, write a new ADR that supersedes the old one and link both ways.
- **Proposed** ADRs may be edited until accepted; each names the open decision that blocks it (see [open decisions](../open-decisions.md)).
- Keep each ADR short (about 3 KB at most). Cite research as `[RN-xx §n]` (ID map in [research index](../research/README.md)).
- Code and docs must follow Accepted ADRs; a PR that contradicts one must add a superseding ADR first.

## Template
```markdown
# ADR-NNNN: <Title>

Status: Proposed | Accepted | Superseded by ADR-NNNN · Date: YYYY-MM-DD · Deciders: ...

## Context
What forces are at play; facts with citations.

## Decision
What we will do, stated precisely.

## Consequences
+ positive effects
− negative effects / costs / risks

## Alternatives considered
- Option: why not chosen.

## Sources
[RN-xx §n], links
```

## Index
| # | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-monorepo-pnpm-turborepo.md) | Monorepo with pnpm workspaces + Turborepo; TypeScript and Flutter in one repo | Accepted |
| [0003](0003-nestjs-modular-monolith.md) | Backend: NestJS 12 modular monolith with bounded contexts and a transactional outbox | Accepted |
| [0004](0004-postgresql-pooled-tenancy-rls.md) | PostgreSQL 18, pooled multi-tenancy, FORCE RLS, tenant routing table | Accepted |
| [0005](0005-drizzle-withtenant.md) | Data access with Drizzle and a withTenant() transaction wrapper | Accepted |
| [0006](0006-one-organisation-model.md) | One organisation model; global practitioner and patient identities | Accepted |
| [0007](0007-configuration-layers.md) | Entitlements, feature flags and cascading settings; per-doctor features as gated modules | Accepted |
| [0008](0008-custom-fields.md) | Custom fields: definitions registry + JSONB with fixed limits | Accepted |
| [0009](0009-clinical-templates-specialty-packs.md) | Versioned clinical templates + specialty packs; Release 1 = general, dental, orthopedics | Accepted |
| [0010](0010-web-apps-stack.md) | Web apps: React 19 + Vite + TanStack Router SPA/PWA; Next.js 16 for booking pages | Accepted |
| [0011](0011-design-system-base-ui.md) | Custom design system on Base UI with DTCG tokens shared with Flutter | Accepted |
| [0012](0012-flutter-patient-app.md) | Patient app in Flutter (official MVVM + Riverpod 3) | Accepted |
| [0013](0013-api-contract-openapi-zod.md) | REST + OpenAPI 3.1 from named Zod schemas; generated TS and Dart clients | Accepted |
| [0014](0014-offline-sync-engine.md) | Offline reception and patient app; sync engine chosen by spike | Proposed (OD-05) |
| [0015](0015-realtime-centrifugo.md) | Realtime with Centrifugo fed from the outbox | Accepted |
| [0016](0016-identity-better-auth-reverse-whatsapp.md) | Better Auth; reverse WhatsApp phone verification; no SMS | Accepted |
| [0017](0017-notifications-push-whatsapp.md) | Push + in-app inbox primary; WhatsApp via self-hosted WAHA secondary | Accepted |
| [0018](0018-money-three-currencies.md) | Money: SYP/TRY/USD, minor units, clinic rates, mixed-currency receipts, cash sessions | Accepted |
| [0019](0019-imaging-orthanc-ohif.md) | Imaging: unmodified Orthanc per tenant behind our gateway; OHIF viewer | Accepted |
| [0020](0020-voice-calling-voice-packs.md) | Voice calling with pre-generated TTS voice packs played locally | Accepted |
| [0021](0021-supporting-services.md) | Garage, Valkey, Gotenberg, ExcelJS, Postgres Arabic search | Accepted |
| [0022](0022-deployment-portable-hosting.md) | Docker Compose + Kamal on portable hosting; location pending legal opinion | Proposed (OD-01) |
| [0023](0023-no-real-patient-data-in-dev.md) | No real patient data in development or AI-agent environments | Accepted |
| [0024](0024-licensed-clinical-content-gating.md) | Licensed clinical content gated per tenant until licences are signed | Accepted |
| [0025](0025-development-methodology-claude-code.md) | Development methodology: Claude Code, harness-first, risk tiers | Accepted (bypass rule superseded by 0027) |
| [0026](0026-public-repository.md) | Public GitHub repository; private notes stay local | Accepted |
| [0027](0027-owner-chooses-permission-mode.md) | The owner chooses the Claude Code permission mode; `bypassPermissions` allowed | Accepted |
