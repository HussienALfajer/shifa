# @shifa/e2e

Playwright journeys against the real backend (slice A-01-06): the built API on a `@shifa/db` harness database, and `vite preview` of the built `apps/clinic-web` and `apps/admin-web` with `/api` proxied to it.

## Layout
- `support/global-setup.ts` starts `scripts/backend.ts` with plain Node (Playwright's loader cannot start the API) and hands the URLs and the seed to the workers through their environment; closing the backend's stdin stops it all.
- `scripts/backend.ts` — harness container under a DB test slot, `startApi()` from `apps/api/scripts/api-process.ts`, both previews, then `scripts/seed.ts` (five super admins via `seedSuperAdmin()`, clinics with owners via `createClinic()`; synthetic names and phones from `@shifa/testing`). Its one stdout line (READY) carries the URLs and the one-time tokens: keep stdout a pipe to the parent.
- `support/page.ts` — API calls as a `fetch` run in the page (same origin, the cookie lands in the browser's jar): `callInPage()`, `expectCall()` (a wrong status names the code, never the body); `expireSession()` is the only raw database access.
- `support/screens.ts` — the entry-path steps as a person does them (setup link, enrolment, sign-in, challenge, `tabTo()`); `support/totp.ts` the journeys' own authenticator (waits for an unused 30 s step); `support/axe.ts` axe on a whole page (WCAG 2.2 A/AA and page-level rules).
- `support/look.ts`: axe in light and dark; with `E2E_SHOTS` also screenshots, secrets masked. `tests/account-clinics.spec.ts` (A-01-10), `admin-clinic-tabs.spec.ts` (A-02-08): 3rd and 5th super admin.
- `tests/team-branches.spec.ts` (A-01-08): the fourth super admin's clinics; four journeys in order (add a member, an invitation, the header switcher, deactivation); pages looked at 1280, 768 and 390 px.
- `tests/entry-path.spec.ts` (A-01-07): five journeys sharing browser contexts, in order: (5) the second seeded super admin enrols, then (1)–(4) build on it. `tests/keyboard-axe.spec.ts`: the third seeded owner, keyboard only, axe on each screen. `tests/smoke.spec.ts` (A-01-06) keeps the first super admin and the first two clinics.
- Clinic web runs on `localhost`, admin web on `127.0.0.1`: cookies ignore ports, so two hosts keep two jars.

## Rules
- Synthetic data only. Never log a setup token, a password or a seed value; never write them to a file. Accepted exceptions, throwaway backend and synthetic data only: with `E2E_TRACE=1` (CI) a failed journey's trace keeps `page.evaluate` arguments and cookies, uploaded for 7 days; and Playwright writes `test-results/<test>/error-context.md` for every failure with the page's text (a TOTP key, recovery codes, a setup or member link when a journey fails on those screens; no setting turns a failed matcher's snapshot off), uploaded with the traces. Assert on secrets as booleans, and open token links with `openSecretLink()`, never `page.goto`, so no failure message names them.
- Journeys run serially and in order: the setup links are one-time, and (d) signs in with the password (b) set. Running one journey alone with `--grep` fails for that reason.
- Service workers are blocked except in `tests/offline-shell.spec.ts`.
- A journey checks what a person sees (headings, `data-testid` hooks of the pages); Keep the hooks or update the journeys with them. Sign-in (checkpoint 2) keeps `sign-in-reason` with `data-reason` and adds `sign-in-error` with `data-code`. Checkpoint 3 replaced the `/mfa` placeholder (no more `mfa-state`): enrolment opens on «ثبّت تطبيق المصادقة»; locks there carry `data-testid="lock"` with `data-code`.

## Commands
- `pnpm exec turbo run build --filter=@shifa/e2e...` then `pnpm --filter @shifa/e2e e2e` (Docker and Chromium: `pnpm --filter @shifa/e2e exec playwright install chromium`).
- `E2E_SHOTS=<folder outside the repo; refused inside>` keeps `look()`'s screens for the drawings.
- `E2E_TRACE=1` keeps a trace of each failed journey in `test-results/`.
- To look at the apps by hand on the real backend: `tail -f /dev/null | node e2e/scripts/backend.ts` (stdin must stay open).
