# A-01-02 Better Auth sign-in and sessions

Status: PR open (reviews done, findings fixed) · Tier: T0 · Branch: `feat/A-01-02-better-auth-sign-in-and-sessions` (built on the cloud session branch `claude/inspiring-cori-1u1itc`, [cloud sessions](../process/cloud-sessions.md) §4)
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
`apps/api/test/identity/better-auth.gate.test.ts`, Better Auth 1.7.27 with `@better-auth/drizzle-adapter` 1.7.27 (both exact), 2026-11-23: **all core checks pass**, 5 of 5 tests.
- `auth.api.*` without the handler: pass. Nothing is mounted; every call is a plain function call from a Nest service.
- Phone + password sign-in (phone-number plugin): pass. Note: the plugin marks `phoneNumber` `input: false`, so `internalAdapter.createUser()` drops it; an `updateUser()` sets it (A-01-03 creates users this way).
- Drizzle adapter on the `shifa_auth` pool: pass, through `scopedAuthAdapter()` (`modules/identity/auth-adapter.ts`): the adapter is built once over a facade that forwards to the current `withAuth()` transaction (AsyncLocalStorage); each adapter call opens its own transaction or joins one. No pool or raw Drizzle handle leaves `@shifa/db`. UUID ids (`generateId: 'uuid'`).
- Extra session fields (`activeTenantId`, `activeBranchId`, `lastActiveAt`) through `additionalFields` and a `session.create.before` hook: pass.
- Cookie `__Host-shifa.sid` with Secure, HttpOnly, SameSite=Lax, Path=/, no Domain: pass (`useSecureCookies: false` so Better Auth adds no `__Secure-` in front, `secure: true` as an attribute).
- Fake `Date` honoured for expiry: pass (12 h). The service uses an injected clock instead and stamps `createdAt`, `lastActiveAt` and `expiresAt` from it in the hook, so Better Auth's own `Date` is not needed for limits.
- TOTP with backup codes server-side: pass: enrol (10 backup codes), verify a code (the session is **rotated**: the pre-MFA cookie stops working), a backup code is single use. Ready for A-01-03.
- Not covered by Better Auth, done by us as planned: equal timing for an unknown phone (the plugin answers at once when no user matches), the throttle, idle limits, audit.

## Stopped at
All four checkpoints built; locked-test edits approved and made; reviewer and security-reviewer findings fixed; `verify` and `verify:full` green; PR open with auto-merge. Next: A-01-03.

## As built (differences from the plan)
- **Access:** a third route annotation `@SignedIn()` (any signed-in person, no permission: the own-session routes); `AccessCheck`, the guard, the route matrix (`signedIn` rows) and OpenAPI (`x-signed-in`, no 403) know it. A-01-03's `@PlatformAdmin()` becomes the fourth. `Principal` gains `sessionId` and a nullable `tenantId` (a person without an active clinic); `PrincipalSchema` (Zod, strict) is the AuthPort contract, documented in `access/auth.port.ts`.
- **Handler inputs:** `@Req()` stays refused. Two known parameter decorators are allowed by the contract check: `@CurrentPrincipal()` (the principal the guard authenticated) and `@ClientRequest()` (generated request id, socket address, user agent, cookies, `setCookie()`).
- **Errors:** `ApiError(status, code, until?)` in the global filter; codes `invalid_credentials`, `phone_locked`, `ip_blocked` (both with `until`), `session_expired` in `@shifa/contracts` with Arabic messages in `@shifa/i18n`.
- **Sessions:** the principal's roles are read inside the active tenant with `withTenant()` (no new grant for `shifa_auth`); no migration in this slice. Idle: the clinic's `idle_minutes`, 15 without an active clinic (super admins have none, and are marked only in A-01-03). A membership deactivated after sign-in drops the clinic and roles from the next request. Expired sessions are deleted and audited (`idle`, `absolute`). Every authenticated request refreshes `last_active_at`, so a client must not poll `GET /auth/session`: it computes the warning from `idleExpiresAt`.
- **Sign-in:** a malformed phone is 400 `validation_failed` on `body.phone` (the client runs the same `normalisePhone()`); an attempt refused while a phone is locked still counts toward the IP's 30 (a locked phone sprayed from one address trips the IP block). A session cookie presented at sign-in is ended (`replaced`). The new session's clinic: the only active membership, and its only branch.
- **Audit:** identity events are null-tenant rows on the auth path: `auth.sign_in`, `auth.sign_in_failed` (`reason`), `auth.locked` (`kind`), `auth.session_ended` (`reason`: `sign_out`, `ended`, `ended_others`, `replaced`, `idle`, `absolute`). `data` is typed per event (allowlist).
- **Password rules** (`checkPasswordRules`, used from A-01-03): bundled list = NCSC top-100k entries of 10+ characters among the first 20,000 (1,784 entries; licence in `common-passwords.LICENSE.md`).
- **Harness:** request ids are always generated (`client_request_id` in local logs only); the sampler ignores a remote parent's flag; `raw-routes.test.ts`; `openapi-meta-schema.test.ts` with the OAS 3.1 schema (one documented substitution for an Ajv `$dynamicRef` bug, `test/contract/fixtures/README.md`); the matrix seeds a person per role and a fresh session per call, sends sample requests (`SAMPLE_REQUESTS`) and asserts `BetterAuthAdapter` in production. `testAuthDb()` now reopens after an app closes it, as `testDb()` does.
- **Config:** `BETTER_AUTH_SECRET`, `AUTH_HMAC_KEY`, `DATABASE_URL_AUTH`, `DATABASE_URL_PLATFORM` through `loadIdentityConfig()` (required by `main.ts`; the platform pool is opened in A-01-03); the boot check passes them from the harness.
- **Decision record:** [ADR-0044](../adr/0044-better-auth-as-library-behind-nest-routes.md) amends ADR-0016 (library behind Nest routes, no organization plugin).

## Locked tests
Two `verify` steps failed on locked tests only. The owner approved both edits on 2026-11-23; no assertion changed:
1. **Real-format phone numbers** (`scripts/test/no-real-phones.test.mjs`, 0.4-10 F2): `phone.test.ts`, `sign-in.test.ts`, `password-rules.test.ts` and `principal-schema.test.ts` use hand-typed numbers such as `+963 944 …`. Proposed: the same vectors on a synthetic, marker-bearing number (`+963 940 012 345`, `+90 532 001 23 45`) in every spelling.
2. **Lint** (`no-unnecessary-type-assertion`, `no-unused-vars`): `res.json() as X` → `res.json<X>()` in `adapter`, `audit`, `sessions` and `sign-in` tests, and an unused destructured name in `openapi-meta-schema.test.ts`.

## Evidence
- Red phase: 13 test files written first and locked; all failed for the right reason (missing identity module and routes, principal not validated, client request id kept, raw route not reported, OpenAPI paths absent).
- `@shifa/api` (Testcontainers, this cloud session): 47 files, 312 tests pass (unit 212 including config; db with identity 42; telemetry with sampling, request-id export and identity leak). `@shifa/contracts` 34, `api-client-ts` 43, `api_client_dart` 40, `@shifa/i18n` 51 pass.
- `node scripts/check-drift.mjs --full`: migrations, openapi, api-client-ts, api-client-dart, i18n, tokens CLEAN.
- Locked-test edits (owner's go): synthetic phones in four tests, `res.json<T>()` in five; assertions unchanged.
- Reviewer findings fixed: **B1** parallel attempts outran the throttle (20 at once → 20 password checks): every attempt now reserves its slot under `SELECT … FOR UPDATE` before any password check (`sign-in-concurrency.test.ts`: 5 per phone, 30 per IP); **B2** a client-chosen trace id decided sampling: remote parents get a server-side random draw (`sampler.test.ts`); **N2** the list hid no idle-dead sessions (`sessions-review.test.ts`); **N4** `@CurrentPrincipal()` on a `@Public` route now stops the app (`contract-check.test.ts`); **N5** a person without a password verifies the dummy hash, a second-factor redirect is refused before the throttle is cleared; **N6** the `replaced` row names the person who signed in; **N7** the password maximum counts UTF-16 units.
- Security-reviewer findings fixed (it confirmed B1, B2 and N5 fixed by re-running its probes): **M1** login CSRF through form posts: every unsafe request with a non-JSON body answers 415 and one whose `Sec-Fetch-Site` is not `same-origin`/`none` answers 403, before routing (`platform/request-guard.ts`, `security-review.test.ts`); **M2** one audit row per refused attempt (unbounded, append-only): only the first refusal of a lock writes a row; **L1** the client still chose the exported trace id: no propagator is installed, an incoming `traceparent` is never read (`tracing.test.ts`, `tracestate-leak.test.ts` updated); **L2** a lock-order deadlock between `reserve()` and `succeeded()`: same order now; **L3** IPv6 clients escaped the IP limit: IPv6 counts by /64, IPv4-mapped as IPv4 (`ip-key.test.ts`, `security-review.test.ts`).
- Deferred to backlog: N1 fixed vs sliding window; N3 sweeper for lapsed sessions and throttle rows; origin allowlist and CORS for the web apps; a sign-in rate limit at the reverse proxy.

## Notes for the next session
- Until the reverse proxy exists (`/release`), `trustProxy` stays off and the IP limit keys the socket address (backlog "Client IP and request ids behind the proxy").
- **A-01-03:** a person with TOTP enrolled gets a second-factor redirect from Better Auth; `SignInService` throws on it today (no route can enrol TOTP yet). Replace the throw with the challenge flow (Better Auth has by then written `2fa-*` verification rows and a `two_factor` cookie). Create users with `internalAdapter.createUser(..., { method: 'admin' })` then `updateUser(id, { phoneNumber })` (gate note). `checkPasswordRules()` is ready for the setup link. `@PlatformAdmin()` becomes the fourth access annotation.
- **Web shells (A-01-06):** unsafe requests must be JSON from the same origin (request guard); serving the web apps from another subdomain needs an origin allowlist with CORS first (backlog).
