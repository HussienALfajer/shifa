# Architecture Decision Records

Status: Living index · Last updated: 2026-11-11 · Owner: product owner
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
| [0004](0004-postgresql-pooled-tenancy-rls.md) | PostgreSQL 18, pooled multi-tenancy, FORCE RLS, tenant routing table | Accepted (amended by 0030) |
| [0005](0005-drizzle-withtenant.md) | Data access with Drizzle and a withTenant() transaction wrapper | Accepted (amended by 0030, 0043) |
| [0006](0006-one-organisation-model.md) | One organisation model; global practitioner and patient identities | Accepted |
| [0007](0007-configuration-layers.md) | Entitlements, feature flags and cascading settings; per-doctor features as gated modules | Accepted |
| [0008](0008-custom-fields.md) | Custom fields: definitions registry + JSONB with fixed limits | Accepted |
| [0009](0009-clinical-templates-specialty-packs.md) | Versioned clinical templates + specialty packs; Release 1 = general, dental, orthopedics | Accepted |
| [0010](0010-web-apps-stack.md) | Web apps: React 19 + Vite + TanStack Router SPA/PWA; Next.js 16 for booking pages | Accepted |
| [0011](0011-design-system-base-ui.md) | Custom design system on Base UI with DTCG tokens shared with Flutter | Accepted (amended by 0039) |
| [0012](0012-flutter-patient-app.md) | Patient app in Flutter (official MVVM + Riverpod 3) | Accepted |
| [0013](0013-api-contract-openapi-zod.md) | REST + OpenAPI 3.1 from named Zod schemas; generated TS and Dart clients | Accepted |
| [0014](0014-offline-sync-engine.md) | Offline reception and patient app; sync engine chosen by spike | Accepted (engine in 0031) |
| [0015](0015-realtime-centrifugo.md) | Realtime with Centrifugo fed from the outbox | Accepted |
| [0016](0016-identity-better-auth-reverse-whatsapp.md) | Better Auth; reverse WhatsApp phone verification; no SMS | Accepted (amended by 0036, 0044) |
| [0017](0017-notifications-push-whatsapp.md) | Push + in-app inbox primary; WhatsApp via self-hosted WAHA secondary | Accepted (amended by 0036, 0038) |
| [0018](0018-money-three-currencies.md) | Money: SYP/TRY/USD, minor units, clinic rates, mixed-currency receipts, cash sessions | Accepted |
| [0019](0019-imaging-orthanc-ohif.md) | Imaging: unmodified Orthanc per tenant behind our gateway; OHIF viewer | Accepted (amended by 0035) |
| [0020](0020-voice-calling-voice-packs.md) | Voice calling with pre-generated TTS voice packs played locally | Accepted (amended by 0037) |
| [0021](0021-supporting-services.md) | Garage, Valkey, Gotenberg, ExcelJS, Postgres Arabic search | Accepted (amended by 0034) |
| [0022](0022-deployment-portable-hosting.md) | Docker Compose + Kamal on portable hosting; location pending legal opinion | Proposed (OD-01) |
| [0023](0023-no-real-patient-data-in-dev.md) | No real patient data in development or AI-agent environments | Accepted |
| [0024](0024-licensed-clinical-content-gating.md) | Licensed clinical content gated per tenant until licences are signed | Accepted |
| [0025](0025-development-methodology-claude-code.md) | Development methodology: Claude Code, harness-first, risk tiers | Accepted (bypass rule superseded by 0027; PR size cap by 0032) |
| [0026](0026-public-repository.md) | Public GitHub repository; private notes stay local | Accepted |
| [0027](0027-owner-chooses-permission-mode.md) | The owner chooses the Claude Code permission mode; `bypassPermissions` allowed | Accepted (secret rules superseded by 0028) |
| [0028](0028-allow-all-permissions-and-auto-merge.md) | Allow all Claude Code permissions, including secret files; auto-merge every PR | Accepted |
| [0029](0029-backup-targets-and-local-operations-stack.md) | Backup targets (RPO 5 min, RTO 4 h), local-first operations stack, WSL2 primary | Accepted |
| [0030](0030-pgbouncer-transaction-mode-tenant-context.md) | PgBouncer in transaction mode with transaction-scoped tenant context; `server_reset_query_always` and other required settings | Accepted |
| [0031](0031-offline-sync-custom-outbox.md) | Offline sync with a custom outbox (command log, idempotency keys, pull endpoint); decides ADR-0014 | Accepted |
| [0032](0032-slice-size-budget-4000-lines.md) | Slice and PR size budget about 4,000 hand-written lines (CI warns, never fails) | Accepted |
| [0033](0033-pre-pr-fast-verify-ci-full-gate.md) | Before a PR, fast `verify` locally; CI's `verify (full)` is the full gate (full locally only for build/boot, DB harness, drift, CI) | Accepted |
| [0034](0034-arabic-output-and-name-search.md) | Arabic output and name search: Gotenberg 8 settings, Vazirmatn, roll-paper and thermal raster rules, one normaliser with shared vectors, stored key; amends 0021 | Accepted |
| [0035](0035-imaging-storage-upload-and-edge-push.md) | Imaging storage, upload and edge push: Garage bucket and key per tenant, encrypted objects, own chunked resumable upload, Transfers through the gateway with an edge queue; amends 0019 | Accepted |
| [0036](0036-whatsapp-gateway-pacing-and-reverse-verification.md) | WhatsApp gateway, pacing and reverse verification: WAHA GOWS with PostgreSQL storage, one container per role, signed webhooks, `@lid` resolution, acks by message key, pg-boss pacing, admin-confirmed breaker, phrase-bound codes; amends 0016 and 0017 | Accepted |
| [0037](0037-voice-silma-self-hosted.md) | Voice calling with self-hosted SILMA TTS and no cloud vendor; generation, fallback, normalisation and display playback rules; amends 0020 | Accepted |
| [0038](0038-push-send-policy-device-state-and-inbox.md) | Push send policy, device-state reporting, receipts and inbox rule; FCM stays primary on emulator evidence until the real-phone run; amends 0017 | Accepted |
| [0039](0039-ui-sdk-headless-base.md) | UI SDK as the headless base of `packages/ui` with an RTL gate and Base UI fallback; code-first design source, light and dark together; amends 0011 | Accepted |
| [0040](0040-design-first-in-claude-design-code-as-source.md) | Design first in a Claude Design project ("Shifa": design system synced from code, guide, component sheets, screens); code is the source of truth; the owner approves sheets and screens before code; amends 0039 and 0025 | Accepted (amended by 0042) |
| [0041](0041-ui-sdk-skill-not-vendored-agent-bridge-off.md) | The upstream `ui-sdk` skill is not vendored (our `/ui-component` skill holds the guidance); the agent bridge stays off, with the conditions for any later use; amends 0039 | Accepted |
| [0042](0042-screens-drawn-per-ui-batch-with-analysis.md) | Screens: `/spec` writes a screen inventory in words; each UI batch slice draws its screens after the API, with an analysis of API gaps, spec gaps and creative improvements, then the owner approves; amends 0040 | Accepted (amended by 0046 and 0047) |
| [0043](0043-database-roles-auth-and-platform.md) | Two more database roles: `shifa_auth` (identity, setup links, own memberships) and `shifa_platform` (audited super-admin work); privileges keep both off clinic data, role-specific policies need a reason; amends 0005 | Accepted |
| [0044](0044-better-auth-as-library-behind-nest-routes.md) | Better Auth as a library behind Nest routes (no handler, no organization plugin; phone-number and two-factor plugins; adapter on `withAuth()`; `__Host-shifa.sid` sessions with our idle and absolute limits); amends 0016 | Accepted (amended by 0045) |
| [0045](0045-own-totp-and-platform-admins.md) | Own TOTP (last step stored, lock, skew hint) instead of Better Auth's two-factor plugin; MFA state on the session and the `@BeforeMfa` gate; super admins in `platform_admin`, created by the seed only; amends 0044 | Proposed |
| [0046](0046-full-api-use-and-components-drawn-with-screens.md) | Every UI batch uses the whole API it sits on (route, field and error table; gaps and unprofessional answers reported for the owner to add); a missing component is drawn on its own sheet with every state and at once on its screens, approved or changed with them, then built with `/ui-component` and synced; amends 0042 and 0040 | Accepted (amended by 0047, 0048 and 0049) |
| [0047](0047-screens-drawn-before-the-api-with-a-contract.md) | Screens of a spec are drawn in a design slice before the API, with a screen-to-API contract table and improvements costed for the owner; API slices deliver and test the contract; UI code slices come last on the finished API, split by budget; amends 0042 and 0046 | Accepted (amended by 0049) |
| [0048](0048-components-canvas-holds-the-coded-components.md) | The "Shifa Components" canvas (was "Shifa Components (proposals)") holds one sheet per coded component, mounted from the design system's bundle and working in Play, rebuilt after each sync; a "Proposals" page holds component-only sheets until they are coded and synced; amends 0040 and 0046 | Accepted |
| [0049](0049-screens-canvas-shows-the-coded-screens.md) | "Shifa Screens · Clinic web" holds one sheet per coded screen (a desktop and a phone board), each board clinic web itself on a fake server typed from the contracts, any state and server answer in light or dark chosen in Tweaks, working in Play and rebuilt from the code; its four batch pages deleted; screens not yet coded are drawn on a "Proposals" page; amends 0046 and 0047 | Accepted |
