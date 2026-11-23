# A-01-02 Better Auth sign-in and sessions

Status: Planned · Tier: T0 · Branch: `feat/A-01-02-better-auth-sign-in-and-sessions`
Spec: [A-01a](../specs/platform/A-01a-clinic-owner-sign-in.md) criteria 6–10, 14 (sign-in, lockout and session events), 15, 16; [A-01b](../specs/platform/A-01b-team-roles-branches-switcher.md) criterion 13 (matrix asserts the Better Auth adapter) · Requirements: PLT-10, PLT-47, PLT-48 · Decisions: ADR-0016 (amended here: memberships in our own tables, no organization plugin, as both specs define), OD-77, OD-82

After [A-01-01](A-01-01-data-model-and-rls.md) (merged).

## Goal
A person with an account signs in with phone and password and gets a server-side session that expires on idle and after 12 h; brute force is throttled; every identity event is audited; the API guard gets a real principal from Better Auth instead of `NoAuthAdapter`.

## Plan
### Checkpoint 1 — Better Auth gate
In `apps/api/test/identity/better-auth.gate.test.ts`, on the pinned version from A-01-01: the server API (`auth.api.*`) works without its catch-all handler (all routes stay Nest controllers under the guard, criterion 16); phone + password sign-in; Drizzle adapter on the `shifa_auth` pool; extra session fields; a custom cookie name `__Host-shifa.sid`; an injectable clock or a fake `Date` honoured for expiry; two-factor TOTP with backup codes server-side (used in A-01-03). Record each result under "Gate result"; a failing core check stops the slice and goes to the owner with the cost of the alternative.

### Checkpoint 2 — contracts and the identity module
- `@shifa/contracts`: `normalisePhone()` (E.164 for +963 and +90; Arabic-Indic digits, spaces, leading 0; returns a reason when invalid) shared with the web apps; schemas `SignInRequest`, `SessionView`, `SessionList`; error codes `invalid_credentials`, `phone_locked`, `ip_blocked` (both with `until`), `session_expired`.
- `apps/api/src/modules/identity/`: Better Auth instance (scrypt, phone number plugin, sessions in the database, cookie `__Host-`, Secure, HttpOnly, SameSite=Lax, rotated at sign-in), password rules (≥ 10, bundled common-password list with its licence recorded, no phone digits), throttle service on `auth_throttle` (HMAC key `AUTH_HMAC_KEY`; 5 per phone and 30 per IP in 15 min → 15 min lock), equal status and comparable timing for an unknown phone (dummy hash).
- Routes (`/add-endpoint`, `@Public` where anonymous): `POST /auth/sign-in`, `POST /auth/sign-out`, `GET /auth/session`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/sessions/end-others`.
- `env.ts`: `BETTER_AUTH_SECRET`, `AUTH_HMAC_KEY`, `DATABASE_URL_AUTH`, `DATABASE_URL_PLATFORM` (names in `.env.example`, values never logged).

### Checkpoint 3 — adapter, idle and absolute limits
- `BetterAuthAdapter` replaces `NoAuthAdapter`: reads the cookie, loads the session through `withAuth()` (`createAuthDb()`, ADR-0043), applies idle (tenant `idle_minutes`; 15 min for platform admins) and absolute (12 h) limits with the injected clock, touches `last_active_at`, builds the principal (user, active tenant and branch, role assignments from `role_assignment`: `shifa_auth` has no privilege on that table after A-01-01, so read it inside `withTenant()` for the active tenant, or add a reasoned `shifa_auth` policy and grant in this slice's migration), validates it with Zod. The `AuthPort` contract is documented (backlog item): branch belongs to tenant, roles from server-side membership, opaque UUID user id, errors carry no token or phone. Active tenant at sign-in: the only active membership, else none (the chooser comes in A-01-05).
- Audit rows: sign-in success and failure (no phone), phone lock, IP block, session ended (one, all others, idle, absolute).

### Checkpoint 4 — public-route harness (criterion 16)
- Sampling: `remoteParentSampled` no longer follows an untrusted `traceparent`; a client `x-request-id` is logged under a separate key and never exported (generated ids only); a test fails for any raw Fastify route outside Nest's guard; OpenAPI 3.1 meta-schema check in `openapi.test.ts`; the route matrix sends a sample body per POST route and asserts `app.get(AUTH_PORT)` is `BetterAuthAdapter` in the production module.
- Leak test: synthetic phones and passwords through sign-in, failure and lockout: absent from logs, spans, error events and audit rows.

5. **Web, Flutter, end-to-end** — none (screens in A-01-07).

Tests written first: normaliser vectors (6); same status and timing band for unknown phone (6); phone and IP lockouts with a fake clock, 429 with `until` (7); password rules (8); cookie attributes, rotation, idle at the tenant setting and 15 min for platform admins, absolute 12 h, 401 after each (9); list and end sessions → 401 on the next request (10); audit row per event (14); adapter Zod and contract tests (15); sampling, request id, raw route, meta-schema, matrix body and adapter tests (16, A-01b 13); leak test.
Estimated hand-written lines: ~3,800 (gate ~250, contracts ~350, identity module ~1,100, adapter ~350, harness ~400, tests ~1,350).

## Gate result
Not run.

## Stopped at
Not started.

## Evidence
- `verify` (full): —
- Reviewer and security-reviewer findings fixed: —; deferred to backlog: —

## Notes for the next session
Until the reverse proxy exists (`/release`), `trustProxy` stays off and the IP limit keys the socket address; record that in the backlog item on client request ids.
