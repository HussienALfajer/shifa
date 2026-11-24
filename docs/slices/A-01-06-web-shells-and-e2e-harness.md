# A-01-06 Web shells and the real-backend end-to-end harness

Status: In review · Tier: T1 · Branch: `feat/A-01-06-web-shells-and-e2e-harness`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) and [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) verification rows "Flows" and "Screens" (the harness they need); A-01a criterion 9 on the client side (idle warning one minute before, 401 → sign-in) · Requirements: none new · Decisions: ADR-0002, ADR-0010, ADR-0039, ADR-0042, ADR-0044

After [A-01-05](A-01-05-branches-and-switcher.md) (merged). Re-planned on 2026-11-24 against the merged A-01-01 to A-01-05 code. Changes no schema and no contract.

## Goal
`apps/clinic-web` and `apps/admin-web` exist as signed-out-safe shells with routing, Arabic RTL, light and dark, the typed API client and session handling; Playwright runs journeys against the built API and a real database, locally and in CI. No product screen is drawn or coded here: every page is a placeholder that A-01-07 and A-01-08 replace.

## What the merged code gives and lacks
- API routes sit at the root (`/auth/session`, `/auth/sign-in`, `/platform/clinics`, `/me/clinics`), no global prefix. `GET /auth/session` is `@SignedIn() @BeforeMfa()` and returns `SessionView` (`platformAdmin`, `mfa`, `mfaRequired`, `tenantId`, `idleMinutes`, `idleExpiresAt`, `absoluteExpiresAt`), so the shell learns from one call what the session still needs.
- The cookie is `__Host-shifa.sid` (Secure, no Domain); the request guard admits unsafe requests only as JSON with `Sec-Fetch-Site: same-origin` or absent (A-01-02). So each app and its `/api` must share one origin; the backlog's origin allowlist and CORS stay unneeded while that holds.
- Setup links point to `CLINIC_WEB_URL` (default `http://localhost:5173`) at `/setup#<token>`, the super admin's link too.
- `@shifa/api-client-ts` is a bare `openapi-fetch` client with `credentials: 'include'`; no 401 handling.
- `@shifa/i18n` has the Arabic sources (`common`, `errors`), the checks and the key types, but no runtime: nothing initialises i18next.
- `@shifa/ui` has `ThemeProvider`, `DirectionProvider` and density; `@shifa/testing` has the synthetic generator; `@shifa/db` has `createClinic()` and the harness (container, roles, migrations); `apps/api/scripts/api-process.ts` starts the built API and waits for `/health/ready`; `seedSuperAdmin()` creates the super admin and its link.
- `@playwright/test` 1.65.1, React 19.3.1 and Vite 8.3.8 are already in the lockfile (packages/ui). New pins: TanStack Router and its Vite plugin, TanStack Query, i18next with ICU and react-i18next, the PWA plugin (`vite-plugin-pwa` or Serwist, whichever is maintained on the day; exact pins, 24-hour rule).

## Plan

### Checkpoint 1: shared shell package and the two apps
1. **Contracts, database, API, Flutter** — none.
2. **`packages/web-shell`** (new, shared by both apps so neither duplicates session code):
   - `createShellClient(baseUrl = '/api')`: the typed client plus a middleware that turns any 401 into one `session-ended` event with its code (`session_expired`, `unauthenticated`, or another) and never retries.
   - `useSession()` on TanStack Query (`['session']`, no retry on 401, refetch on focus); `signOut()`.
   - Route guard for TanStack Router (`beforeLoad`): no session → `/sign-in?reason=<code>`; a session on a signed-out route → `/`; `mfaRequired` or `mfa: 'pending'` → `/mfa` placeholder (A-01-07 draws it); admin-web refuses a session without `platformAdmin` (signs out, `reason=not_admin`), clinic-web sends a `platformAdmin` session to a placeholder that names admin web. Mid-session 401 → the event → clear the query cache → sign-in with the reason.
   - `idle-timer.ts`, pure (input: `idleExpiresAt`, `absoluteExpiresAt`, now, last activity; output: `active` | `warning(secondsLeft)` | `expired`): warning at the idle limit − 60 s; user activity (pointer, key, at most once a minute) refreshes `GET /auth/session`, which moves `idleExpiresAt`; the absolute limit never moves; at expiry the shell signs out and goes to sign-in with `reason=idle`. Tabs share the state through `BroadcastChannel`, so activity in one tab keeps the others. A-01-07 draws the warning; here the hook exposes the state and a placeholder shows it.
   - `ShellProviders`: QueryClient, i18n, `DirectionProvider` (`dir="rtl"`, `lang="ar"`), `ThemeProvider` (light, dark, system, kept in `localStorage`), density.
3. **`@shifa/i18n` runtime** — `@shifa/i18n/runtime`: one i18next instance with ICU (Arabic plural forms), Arabic default, namespaces from `src/locales`; shell texts (placeholders, reasons, About) added to `common.json` and pass the existing parity and ICU checks.
4. **Apps** (`apps/clinic-web` on port 5173, `apps/admin-web` on 5174): React 19, Vite, TanStack Router file routes; routes `/sign-in`, `/mfa`, `/`, `/about` (clinic-web also `/setup`, which keeps the fragment and does not send it anywhere yet); placeholders say who is signed in («مسجّل الدخول باسم …») and the session's state. Vite `server.proxy` and `preview.proxy` map `/api/*` to the API with the prefix removed: the dev and test form of the rule the production proxy will follow at `/release` (one origin per app), written in `docs/architecture/overview.md`.
5. **Service worker** — app shell only (precached build files, navigation fallback to `index.html`), no runtime caching, `/api/*` never served from it (ADR-0010; offline data is A-05). Off in dev; Playwright blocks service workers except in the one test that checks the shell loads from it.

### Checkpoint 2: backlog items due with the first app
- **Production build refuses UI SDK's dev history** (audit 0.4, P-N2): each app builds in production mode with the `production` export condition; a test per app builds it and fails on `ui-sdk.devtools` or `__UI_SDK__` in `dist/`, shown failing first on a planted string (as `packages/ui/test/design-system-bundle.test.ts`).
- **Raw `<button>` refused in app code** (0.4-03): an ESLint rule in `tooling/eslint-config` for `apps/**` refusing `<button>` and `role="button"` on other elements, pointing to `Button` from `@shifa/ui`; RuleTester fixtures; `packages/ui` exempt.
- **Solar icons credited** (OD-65): `/about` in both apps shows "Solar icons by 480 Design, CC BY 4.0" with the licence link, plus the app version.
- **`@shifa/ui` and `@shifa/tokens` off server packages** (audit 0.4, S-3): `packages/ui/test/dependencies.test.ts` refuses `@shifa/db`, `@shifa/api` and `@shifa/api-client-*` in their dependencies (`@shifa/contracts` allowed), and a case that `apps/api` and `packages/db` never depend on `@shifa/ui` or `@shifa/web-shell`.
- Remove the four items from `docs/backlog.md`.

### Checkpoint 3: end-to-end harness and smoke
1. **`e2e/`** workspace package (`@shifa/e2e`): Playwright 1.65.1 (same pin as `packages/ui`), Chromium, `--trace off` by default (`retain-on-failure` only with `E2E_TRACE=1`).
2. **Global setup** (one backend per run): `@shifa/db` harness container (PostgreSQL 18, roles, migrations, a DB test slot lock); the built API through `api-process.ts` (`startApi`, `waitReady`) with the identity keys and `CLINIC_WEB_URL` pointing at the clinic-web preview; `vite preview` of both apps with the proxy pointing at that API's port; teardown stops all of it, also on failure.
3. **Seed** (`e2e/support/seed.ts`): super admin through `seedSuperAdmin()`, two clinics with owners through `createClinic()`; names and phones from `@shifa/testing` only; setup tokens kept in the test process, never logged. Helpers: `consumeSetupLink()`, `signInInPage()` (a `fetch` run in the page, so the cookie lands in the browser's own jar and the request is same-origin).
4. **Smoke journeys:** (a) signed out: `/` on each app → `/sign-in`; (b) the super admin's password is set through the setup-link API, sign-in in the page, admin-web `/` shows the placeholder with the session's MFA state (`none`, enrolment required; the TOTP journey lands with A-01-07); (c) the session is ended through `POST /auth/sessions/end-others` from a second context, or deleted in the database: the next request → `/sign-in?reason=session_expired`; (d) clinic-web refuses to be used as admin web and the reverse.
5. **Risk: `__Host-` over plain HTTP.** Chromium treats `http://localhost` as secure, so the Secure cookie should be kept; if not, the global setup serves the previews over HTTPS with a throwaway certificate and `ignoreHTTPSErrors`. Settle this first in the checkpoint.

### Checkpoint 4: verify and CI wiring, docs
- `scripts/lib/verify-steps.mjs`: a step `e2e` (`pnpm --filter @shifa/e2e test`) that `requires` `build`; in full mode always; in fast mode only when Turborepo's `--affected` reaches `@shifa/e2e` (an app, `packages/web-shell`, `apps/api` or `e2e/` changed), with a `verify-note` line when skipped. A new part `e2e` in `PARTS`; `scripts/test` cases for the graph and the part.
- `ci.yml`: job `verify e2e` (`contents: read`, no secrets, database images pulled, Chromium installed as the `ui` job does, the same accepted risk as backlog S-2) running `verify full --part e2e`; listed in the jobs `verify (full)` waits for, so it blocks the merge (ADR-0033); traces uploaded on failure only.
- Docs: `docs/architecture/overview.md` (one origin per app, the proxy rule), `docs/process/development-workflow.md` or the testing doc (how to run `e2e` locally; needs Docker), `apps/*/CLAUDE.md` and `e2e/CLAUDE.md` short, `CLAUDE.md` Commands line.
- `security-reviewer` on the CI job, the proxy and the client's session handling (T1 slice, infrastructure part), besides the `reviewer` agent.

Tests written first:
- Guard (component tests, mocked client typed from contracts): signed out → `/sign-in`; signed in on `/sign-in` → `/`; `mfaRequired` → `/mfa`; 401 mid-session → `/sign-in?reason=session_expired`, cache cleared; admin-web without `platformAdmin` → signed out, `reason=not_admin`.
- Idle timer (fake clock): `active` until limit − 60 s, `warning(60…1)`, `expired` at the limit; activity refreshes and resets; refresh at most once a minute; the absolute limit wins; a message from another tab resets.
- i18n runtime: Arabic default, an Arabic plural form, every shell key present (existing checks).
- Production build test per app, shown failing on a planted string; lint rule fixtures; dependency cases.
- Service worker: the built `sw.js` has no runtime route and no `/api` entry.
- e2e smoke journeys (a)–(d) against the real backend; verify-steps graph and part tests.

Estimated hand-written lines: ~3,300 (web-shell ~700, two apps ~700, i18n runtime and texts ~150, backlog items ~300, e2e harness and seed ~550, smoke ~150, verify and CI ~250, unit and component tests ~500). Under the 4,000 budget; four checkpoints above.

Plan approved by the owner (2026-11-24) as one slice at tier T1, with `security-reviewer` on the CI job, the proxy and the client's session handling.

## Stopped at
All four checkpoints built; `verify` and the journeys green; reviews and PR next.

## Changes from the plan (built 2026-11-24)
- **Code-based routes, no router plugin.** Both apps have the same five routes, so `@shifa/web-shell` builds them (`buildRouteTree()`); no generated route tree to keep in drift, and `@tanstack/router-plugin` (and its Babel tree) is not pinned. The apps are `main.tsx`, `index.html`, `vite.config.ts` and a stylesheet.
- **Hand-written service worker, no Workbox.** `src/vite/service-worker.ts` emits `sw.js` (about 60 lines): precache at install, navigations network-first with the cached `index.html` as fallback, precached files from the cache, nothing else answered, no runtime `cache.put`. A test runs it in a sandbox. Neither `vite-plugin-pwa` nor Serwist is pinned.
- **Placeholder pages live in the shell** (`src/pages.tsx`), not per app; A-01-07 and A-01-08 pass their own pages to `mountShellApp()`.
- **The `e2e` script is `e2e`, not `test`**: Turborepo's `test` task would otherwise run the journeys inside `typecheck+lint+test` as well.
- **Backend as a plain-Node child.** Playwright's loader could not start the API (`/health/ready` never answered), so `support/global-setup.ts` spawns `scripts/backend.ts` with Node, reads one READY line and stops it by closing its stdin.
- **Two hosts for two cookie jars**: clinic web on `localhost`, admin web on `127.0.0.1` (cookies ignore ports).
- **`__Host-` over plain HTTP settled**: Chromium keeps the Secure cookie on `http://localhost` and `127.0.0.1`; no HTTPS needed.
- **Journey (c) ages the session** instead of ending it: `POST /auth/sessions/end-others` needs a verified MFA (A-01-07), and a deleted session answers `unauthorized`, not `session_expired`. `expireSession()` moves `last_active_at` two hours back, so the API ends it on the next request with `session_expired`, as an idle session ends.
- **Focus watch of our own** (`watchFocus()`): TanStack Query refetches on focus only after a blur; the shell asks again on every `focus` and visible `visibilitychange`.
- **A signed-out answer is never cached**, so the guard asks again after an in-page sign-in; the mid-session rule acts only when a signed-in session was cached.
- **Cross-tab messages are checked** (`isIdleMessage()`): any tab of the origin can post on the channel.
- Web-shell tests run in happy-dom (the router reads `window`; nothing is rendered). One more journey: `tests/offline-shell.spec.ts`, the only one with service workers allowed.
- Two locked tests changed for lint only, with the owner's approval (2026-11-24): `idle-timer.test.ts` lost an unneeded `as IdleMessage`, `router.test.ts` wraps the library's `any` `routeId` in `String()`. No assertion changed.

## Evidence
- `verify` (full): —
- End-to-end smoke: —
- Reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
- The slice touches build and CI: run `pnpm verify:full` before the PR (ADR-0033); Playwright and Docker run in CI if the session is sandboxed (OD-24).
- For A-01-07: the super admin's setup link opens clinic-web (`CLINIC_WEB_URL/setup`), not admin-web; decide in its analysis whether admin-web gets its own link base.
