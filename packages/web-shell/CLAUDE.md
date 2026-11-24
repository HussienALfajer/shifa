# @shifa/web-shell

What `apps/clinic-web` and `apps/admin-web` share (slice A-01-06), so neither duplicates session code.

## Layout
- `src/client.ts` — `createShellClient()`: the typed client on the app's own `/api`; every 401 `unauthorized` or `session_expired` (but a failed sign-in) emits one `session-ended` event with its code; any other 401 code answers the request (e.g. `invalid_credentials` on `/auth/password`); nothing retries.
- `src/session.ts` — the `['session']` query (GET /auth/session; a 401 is "signed out", never cached), `watchFocus()`, `signOut()`.
- `src/guard.ts` — `decideRoute()`, the one pure decision of every route's `beforeLoad`; `src/router.tsx` builds the routes and the mid-session rule (401 with a known session → cache cleared → `/sign-in?reason=<code>`).
- `src/idle-timer.ts` (pure, fake-clock tests; `clockOffset()` compares with the server's clock) and `src/use-idle.tsx` (`IdleBoundary` at the router's root runs it once for every page: activity, tick, trailing refresh, `BroadcastChannel`, sign-out with `reason=idle`; pages read `useIdleState()`).
- The router drops every cached query but the session when the person, session or clinic behind the page changes (a switch or sign-in in another tab), and goes home.
- `src/pages.tsx` — placeholder pages only; A-01-07 and A-01-08 replace them with approved drawings (ADR-0040, ADR-0042).
- `src/vite/` — `shellViteConfig()` (the `/api` proxy, the `production` export condition for builds), the hand-written service worker (app shell only, ADR-0010) and `buildForCheck()` for the apps' build tests.

## Rules
- One origin per app: never call the API on another origin, never add CORS here (backlog: origin allowlist first).
- No product screen here. Texts come from `@shifa/i18n` (`common`); controls from `@shifa/ui` (a raw `<button>` fails lint in apps).
- The service worker never answers `/api`, never stores a response at runtime.
- Tenant queries put `tenantId` first in their key (`['clinic', tenantId, …]`). Nothing but the person's own activity may refresh the session in the background (`refetchOnReconnect: false`).
