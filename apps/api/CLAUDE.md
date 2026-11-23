# @shifa/api

NestJS 12 on Fastify, one modular monolith (ADR-0003). Rules for code here: `.claude/rules/api.md`.

## Layout
- `src/main.ts` bootstrap only: config → logger → `createDb()` + startup check → `createApp()` → signals.
- `src/app.ts` adapter (body limit 1 MB, request timeout 30 s, `trustProxy` off, request ids, routing errors → envelope), global filter, hooks. Tests use the same `createAdapter()` + `configureApp()`.
- `src/config/env.ts` Zod config (`.env.example`): `DATABASE_URL`, `API_*`, `LOG_LEVEL`, `OTEL_*`, `SENTRY_*`, `NODE_ENV`; `loadIdentityConfig()`: `DATABASE_URL_AUTH|PLATFORM`, `BETTER_AUTH_SECRET`, `AUTH_HMAC_KEY`, `CLINIC_WEB_URL`. Errors name keys only.
- `src/platform/` database module (`SHIFA_DB` token, pool closed at shutdown), logging, errors.
- `src/modules/<context>/` one folder per bounded context; others import only its `index.ts`. `src/platform/` and `src/access/` never import a module (lint `shifa/module-boundaries`; `test/architecture/module-imports.test.ts` also fails on a comment silencing it).

## Access (fail-closed)
- `src/access/`: the permission catalogue (`permissions.ts`, keys with a sensitive flag, injected as `PERMISSION_CATALOGUE`; unknown keys in routes or grants stop the start), roles, grants, `Principal` (+ `platformAdmin`, `mfa`, `overrides`, `ownsClinic`) and `PrincipalSchema` (AuthPort contract), `isGranted()` (role grants ± sensitive overrides), `mfaBlock()`; `@Public` / `@SignedIn` / `@RequirePermission` / `@PlatformAdmin`, `@BeforeMfa` (with `@SignedIn`); `AUTH_PORT` is `BetterAuthAdapter`.
- Scope binding (A-01-04): the guard binds the checked `{ tenantId, branchId, userId }`; handlers take `@CurrentScope()` and reach tenant data only through `TenantDb.run(scope, fn)` (a copied or hand-made scope throws). The one exception is `linkScope()` for link-bound routes (invitations, link pages). `test/architecture/table-access.test.ts` lists each module's own tables and its reads of others' with a reason.
- `modules/team/`: members, roles per clinic or branch, toggles, links (`MemberAccounts` from identity for the person's account), clinic settings. Invitations live in `modules/identity/` (`/invitations/*`).
- `modules/identity/` also: setup links, own TOTP (ADR-0045), `seed:super-admin`. `modules/platform/`: `@PlatformAdmin` clinics API on `createPlatformDb()`, every call audited.
- `AccessGuard`: not one annotation → 500 (`AccessCheck` stops the start first); anonymous → 401 (`session_expired` when lapsed); MFA gate or missing key → 403. Denials log route template and handler only.
- `src/modules/identity/` (ADR-0044): Better Auth via `auth.api.*` only, on `createAuthDb()`; sign-in, sessions (idle and 12 h limits on the injected `CLOCK`), throttle, audit. Request metadata only through `@ClientRequest()`; `platform/request-guard.ts` refuses cross-site or non-JSON unsafe requests.
- Tests: `test/access/probe.ts` holds test keys (`TEST_PERMISSIONS`), grants and a header-driven `AuthPort` (`buildTestApp({ auth, grants, permissions })`). `test/architecture/route-matrix.expected.ts` is the reviewed route × role matrix.

## Contracts (ADR-0013)
- `src/platform/contract/`: `@Contract(c)`; `ContractCheck` stops the start on a missing or mismatched contract, unnamed schema, undeclared path parameter, `@Body`/`@Query` without schema, `@Req`/`@RawBody`/unknown own decorators, `@Version`, duplicate operationId; `ContractValidationInterceptor` (after the guard) validates params, query, body → 400 `validation_failed` with `details: [{ path, code }]`, logging issue codes only.
- `openapi.ts` builds the OpenAPI 3.1 document (components by id, an `x-*` access note per route); `scripts/generate-openapi.ts` writes `packages/contracts/generated/openapi.json` via the `openapi` drift check. No Swagger UI.
- Test-only routes use `testContract(method, path)` from `test/support.ts`.

## Logging and errors
- Log through pino (`request.log` in a request). Lines carry the route template, never the URL; never bodies, query strings, headers or patient data; log record IDs.
- Throw Nest `HttpException`s; the global filter answers `{ error: { code, message } }` with a fixed message per status (catalogue in `@shifa/contracts`). Anything else becomes 500 `internal_error`.
- Log errors with `describeError(err)`: database errors keep `sqlstate`, `constraint`, `table`, `column` only.
- Telemetry (PLT-52): `scrub.ts` allowlists; errors via `reportError()`.

## Commands
- `pnpm --filter @shifa/api test` (Docker for the `db` project), `build` (tsdown → `dist/main.js`), `boot-check` (after `build`; also in `verify:full`).
- Run locally: `pnpm start` with the keys of `.env.example`.

## Build
Decorators need metadata, which Node type stripping cannot run, so tsdown bundles `src/` and the `@shifa/*` packages; npm packages stay external and must be in this package's `dependencies` (hence `pg`, used only through `@shifa/db`).
