# @shifa/web-shell

What `apps/clinic-web` and `apps/admin-web` share (slice A-01-06), so neither duplicates session code.

## Layout
- `src/client.ts` — `createShellClient()`: the typed client on the app's own `/api`; every 401 `unauthorized` or `session_expired` (but a failed sign-in) emits one `session-ended` event with its code; any other 401 code answers the request (e.g. `invalid_credentials` on `/auth/password`); nothing retries.
- `src/session.ts` — the `['session']` query (GET /auth/session; a 401 is "signed out", never cached), `watchFocus()`, `signOut()`.
- `src/guard.ts` — `decideRoute()`, the one pure decision of every route's `beforeLoad`; `src/router.tsx` builds the routes and the mid-session rule (401 with a known session → cache cleared → `/sign-in?reason=<code>`).
- `src/idle-timer.ts` (pure, fake-clock tests; `clockOffset()` compares with the server's clock) and `src/use-idle.tsx` (`IdleBoundary` at the router's root runs it once for every page: activity, tick, trailing refresh, `BroadcastChannel`, sign-out with `reason=idle`; pages read `useIdleState()`).
- The router drops every cached query but the session when the person, session or clinic behind the page changes (a switch or sign-in in another tab), and goes home.
- `src/auth/` — the approved signed-out screens (A-01-07): `auth-layout.tsx` (brand panel on desktop, logo above the form on tablets and phones), `sign-in.tsx` (locks with countdown, unreachable with retry and retry on `online`, remembered phone, Caps Lock and Arabic-letter hints), `sign-in-notice.tsx` (`?reason=`: idle with `minutes`, absolute, ended, session_expired, not_admin, signed_out, sign_out_failed).
- `src/auth/` (checkpoint 3): `setup-link.tsx` (`/setup` on both apps: the token from the fragment, removed from history at once, sent in bodies only; view by purpose; the password twice), `mfa.tsx` (`/mfa`: `mfa-challenge.tsx` when the session is `pending`, else `mfa-enrol.tsx` in three steps, then `recovery-codes.tsx` once), `lock.ts` and `lock-callout.tsx` (locks with countdown, shared with sign-in), `setup-view.ts` (the setup person and the codes left, in the query cache only), `me.ts` (GET /me for the name), `codes-left-notice.tsx` (after a recovery-code sign-in).
- The router keeps the page and the cache through the rotation after the second factor (`isMfaRotation`: same person, same clinic or none before, `mfa` becoming `verified`); any other change of person, session or clinic still clears and goes home.
- `src/chooser/` (checkpoint 4): `/choose` on clinic web, where the guard sends a finished session without a clinic: `clinic-chooser.tsx` (GET /me/clinics; clinics, branch step, invitations listed only, no-clinic page), `use-clinic-switch.ts` (POST /me/switch, the session re-read; every refusal mapped), `chooser-cards.tsx` (Card + CardLink), `chooser-text.ts`.
- `src/idle-dialog.tsx` (drawn by `IdleBoundary`): the idle warning with countdown, «متابعة العمل» (`tracker.extend()`), «خروج الآن»; never for the 12-hour limit, which has `SessionEndsNotice` ten minutes before. `useIdleView()` reads it. `src/tabs.ts`: a sign-out (`signOut(…, announce)`, `useSignOut()`) tells the other tabs, which ask the server before leaving.
- `src/pages.tsx` — `shellPages`: sign-in, setup, MFA and the chooser; home, about and admin web still placeholders until A-01-08 replaces them with approved drawings (ADR-0040, ADR-0042). `src/text.ts` — `useText()` (`common`) and `useErrorText()` (`errors`).
- Never put a setup token, a TOTP key or URI, or a recovery code in a URL, storage, the query cache or a log.
- A 401 `session_expired` carries the server's `reason` (`idle`, `absolute`, `ended`; `errorFacts()` in `src/client.ts`); the guard and the mid-session rule put it in `?reason=` instead of the code.
- Page tests render the real shell in happy-dom (`test/render.tsx`, the fake API's `answers` and `bodies` in `test/support.ts`).
- `src/vite/` — `shellViteConfig()` (the `/api` proxy, the `production` export condition for builds), the hand-written service worker (app shell only, ADR-0010) and `buildForCheck()` for the apps' build tests.

## Rules
- One origin per app: never call the API on another origin, never add CORS here (backlog: origin allowlist first).
- Product screens here only from an approved drawing (ADR-0040), shared by both apps. Texts come from `@shifa/i18n` (`common`); controls from `@shifa/ui` (a raw `<button>` fails lint in apps).
- The service worker never answers `/api`, never stores a response at runtime.
- Tenant queries put `tenantId` first in their key (`['clinic', tenantId, …]`). Nothing but the person's own activity may refresh the session in the background (`refetchOnReconnect: false`).
