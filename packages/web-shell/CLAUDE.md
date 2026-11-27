# @shifa/web-shell

What `apps/clinic-web` and `apps/admin-web` share (slice A-01-06), so neither duplicates session code.

## Layout
- `src/client.ts` — `createShellClient()`: the typed client on the app's own `/api`; each 401 `unauthorized` or `session_expired` (not a failed sign-in) emits `session-ended` with its code and the server's `reason` (`idle`, `absolute`, `ended`); other 401 codes answer the request; nothing retries.
- `src/session.ts` — the `['session']` query (a 401 is "signed out", never cached), `watchFocus()`, `signOut()` (announces to the other tabs, `src/tabs.ts`, which ask the server before leaving).
- `src/guard.ts` — `decideRoute()`, the one decision of every route's `beforeLoad` (MFA owed → `/mfa`; clinic web without a clinic → `/choose`); `src/router.tsx` builds the routes and the mid-session rule (401 with a known session → cache cleared → `/sign-in?reason=`).
- The router drops every cached query but the session when the person, session, clinic or branch changes, and goes home; it keeps them through the rotation after the second factor (`isMfaRotation`).
- `src/idle-timer.ts` (pure, fake-clock tests, the server's clock) and `src/use-idle.tsx`: `IdleBoundary` at the root runs it for every page and draws `src/idle-dialog.tsx` (warning, countdown, continue, sign out; never for the 12-hour limit, which has `SessionEndsNotice`); pages read `useIdleView()`.
- `src/auth/` — the signed-out screens (A-01-07): `auth-layout.tsx`, `sign-in.tsx`, `sign-in-notice.tsx` (`?reason=`), `setup-link.tsx` (`/setup`, the token from the fragment, removed at once, sent in bodies only), `mfa.tsx` (challenge or enrolment, then `recovery-codes.tsx`), `lock.ts`, `me.ts` (GET /me), `codes-left-notice.tsx`.
- `src/chooser/` — `/choose` on clinic web: clinics, branch step, invitations listed only, no-clinic page; `use-clinic-switch.ts` (POST /me/switch, the session re-read, every refusal mapped).
- `src/account/` — clinic web's My account and the owner's clinic setting (A-01-10): `reenrol-dialog.tsx` moves TOTP to a new phone (OD-98; no rotation, OD-101); `codes-once.tsx` and `totp-key.tsx` are shared by the dialogs.
- `src/team/` — `/team`, owner only (A-01-08): the page, one drawer to add or edit (asks before closing an unsent link), account actions; reads in `data.ts`; tests use `test/team-support.ts`.
- `src/admin/` — admin web's clinics (A-01-10 checkpoint 3): `clinics-page.tsx` (its home, `/`), `create-clinic-page.tsx` (`/clinics/new`), `clinic-page.tsx` and `owner-card.tsx` (`/clinics/$id`), `link-shown.tsx` (the owner's link once; a `useBlocker` asks before leaving uncopied, never for `/sign-in`), reads keyed `['platform', …]` in `data.ts`. `test/setup-layout.ts` gives the DataTable scroll box a size in happy-dom. Since A-02-09 also `flags/` (`/flags`), `announcements/` (`/announcements`) and `places/` (`/places`), with what they share (the clinic picker, the page's note) in `a02.tsx`; tests use `test/a02-admin-support.ts`.
- `src/pages.tsx` — `shellPages`; home, about and admin web are placeholders until A-01-08 and A-01-10 (ADR-0040, ADR-0042). `src/text.ts` — `useText()`, `useErrorText()`. `useSignOut()` for every «خروج».
- Never put a setup token, a TOTP key or URI, or a recovery code in a URL, storage, the query cache or a log.
- Page tests render the real shell in happy-dom (`test/render.tsx`, the fake API's `answers` and `bodies` in `test/support.ts`).
- `src/vite/` — `shellViteConfig()` (the `/api` proxy, the `production` export condition), the hand-written service worker (app shell only, ADR-0010), `buildForCheck()`.

## Rules
- One origin per app: never call the API on another origin, never add CORS here (backlog: origin allowlist first).
- Product screens here only from an approved drawing (ADR-0040), shared by both apps. Texts come from `@shifa/i18n` (`common`); controls from `@shifa/ui` (a raw `<button>` fails lint here and in apps).
- The service worker never answers `/api`, never stores a response at runtime.
- Tenant queries put `tenantId` first in their key (`['clinic', tenantId, …]`). Nothing but the person's own activity may refresh the session in the background (`refetchOnReconnect: false`).
