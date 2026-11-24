# @shifa/e2e

Playwright journeys against the real backend (slice A-01-06): the built API on a `@shifa/db` harness database, and `vite preview` of the built `apps/clinic-web` and `apps/admin-web` with `/api` proxied to it.

## Layout
- `support/global-setup.ts` starts `scripts/backend.ts` with plain Node (Playwright's loader cannot start the API) and hands the URLs and the seed to the workers through their environment; closing the backend's stdin stops it all.
- `scripts/backend.ts` — harness container under a DB test slot, `startApi()` from `apps/api/scripts/api-process.ts`, both previews, then `scripts/seed.ts` (super admin through `seedSuperAdmin()`, two clinics with owners through `createClinic()`; synthetic names and phones from `@shifa/testing`). Its one stdout line (READY) carries the URLs and the one-time tokens: keep stdout a pipe to the parent.
- `support/page.ts` — API calls as a `fetch` run in the page (same origin, the cookie lands in the browser's jar); `expireSession()` is the only raw database access.
- Clinic web runs on `localhost`, admin web on `127.0.0.1`: cookies ignore ports, so two hosts keep two jars.

## Rules
- Synthetic data only. Never log a setup token, a password or a seed value; never write them to a file. One accepted exception: with `E2E_TRACE=1` (CI) a failed journey's trace keeps `page.evaluate` arguments and cookies of the throwaway backend, uploaded for 7 days.
- Journeys run serially and in order: the setup links are one-time, and (d) signs in with the password (b) set. Running one journey alone with `--grep` fails for that reason.
- Service workers are blocked except in `tests/offline-shell.spec.ts`.
- A journey checks what a person sees (headings, `data-testid` hooks of the placeholder pages); A-01-07 replaces the pages, keep the hooks or update the journeys with them.

## Commands
- `pnpm exec turbo run build --filter=@shifa/e2e...` then `pnpm --filter @shifa/e2e e2e` (Docker and Chromium: `pnpm --filter @shifa/e2e exec playwright install chromium`).
- `E2E_TRACE=1` keeps a trace of each failed journey in `test-results/`.
- To look at the apps by hand on the real backend: `tail -f /dev/null | node e2e/scripts/backend.ts` (stdin must stay open).
