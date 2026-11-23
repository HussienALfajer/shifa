# A-01-06 Web shells and the real-backend end-to-end harness

Status: Planned · Tier: T1 · Branch: `feat/A-01-06-web-shells-and-e2e-harness`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) and [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) verification rows "Flows" and "Screens" (the harness they need) · Requirements: none new · Decisions: ADR-0002, ADR-0010, ADR-0039, ADR-0042

After [A-01-05](A-01-05-branches-and-switcher.md) (merged); may start in a parallel worktree after A-01-02, since it changes no schema or contract. Added by this plan: no web app exists yet, and both UI batches need one.

## Goal
`apps/clinic-web` and `apps/admin-web` exist as empty, signed-out-safe shells with routing, Arabic RTL, light and dark, the typed API client and session handling; Playwright runs journeys against the real API and database in CI. No product screen is drawn or coded here.

## Plan
1. **Contracts** — none (uses `@shifa/api-client-ts`).
2. **Database** — none.
3. **API** — none; a dev and test proxy serves each app and `/api` on one origin, so the `__Host-` cookie works (same rule the production proxy will follow at `/release`).
4. **Web**
   - Both apps: React 19, Vite, TanStack Router (file routes), TanStack Query, i18next from `@shifa/i18n` (Arabic default, `dir="rtl"`), `@shifa/ui` providers and tokens, theme light / dark / system, density; route guard: `GET /auth/session` → signed-out routes or the app; any 401 → back to sign-in with the reason; placeholder pages only ("signed in as …").
   - Session client: one `useSession()`; the idle timer logic (`idle-timer.ts`, pure, fake-clock tests) that A-01-07 draws the warning for.
   - Backlog items due with the first app: production build refuses UI SDK's dev history (`ui-sdk.devtools`, `__UI_SDK__`) per app; lint refuses raw `<button>` and look-alikes in app code; an About page crediting Solar icons (CC BY 4.0); `@shifa/ui` and `@shifa/tokens` kept off server packages (dependency test).
   - Service worker: app shell only, no data caching (ADR-0010; offline data is A-05).
5. **Flutter** — none.
6. **End-to-end** — `e2e/` workspace: Playwright against `vite preview` + built API + Testcontainers PostgreSQL 18 (migrated, roles from `roles.sql`, synthetic seed: super admin, two clinics from `@shifa/testing`), `--trace off` by default; a smoke journey: seed super admin signs in on admin-web (password step only; TOTP flows land with A-01-07); CI job in `ci.yml` part of `verify (full)`; `verify` fast runs it only when an app, `e2e/` or the API changed.

Tests written first: route guard redirects (signed out → sign-in, 401 mid-session → sign-in); idle-timer unit tests (warning at limit − 60 s, reset on activity, sign-out at the limit); production-build test refusing UI SDK dev history; lint rule test for raw buttons; e2e smoke against the real backend.
Estimated hand-written lines: ~2,800 (two shells ~1,200, session and idle ~350, e2e harness ~650, CI and verify wiring ~200, tests ~400).

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- End-to-end smoke: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
If the shell touches build, boot check or CI, run `pnpm verify:full` before the PR (ADR-0033).
