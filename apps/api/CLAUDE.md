# @shifa/api

NestJS 12 on Fastify, one modular monolith (ADR-0003). Rules for code here: `.claude/rules/api.md`.

## Layout
- `src/main.ts` bootstrap only: config → logger → `createDb()` + startup check → `createApp()` → signals.
- `src/app.ts` adapter (body limit 1 MB, request timeout 30 s, `trustProxy` off, request ids, routing errors → envelope), global filter, hooks. Tests use the same `createAdapter()` + `configureApp()`.
- `src/config/env.ts` Zod config (`.env.example`): `DATABASE_URL`, `API_*`, `LOG_LEVEL`, `OTEL_*`, `SENTRY_*`, `NODE_ENV`; `loadIdentityConfig()`: `DATABASE_URL_AUTH`, `DATABASE_URL_PLATFORM`, `BETTER_AUTH_SECRET`, `AUTH_HMAC_KEY`. Errors name the key, never the value.
- `src/platform/` database module (`SHIFA_DB` token, pool closed at shutdown), logging, errors.
- `src/modules/<context>/` one folder per bounded context; others import only its `index.ts`. `src/platform/` and `src/access/` never import a module (lint `shifa/module-boundaries` and `test/architecture/module-imports.test.ts`, which also fails on a comment silencing the rule).

## Access (fail-closed)
- `src/access/`: permission keys, roles and grants, `Principal` (with `platformAdmin` and `mfa`) + `PrincipalSchema` (AuthPort contract, `auth.port.ts`) + `hasPermission()` + `mfaBlock()`, `@Public()` / `@SignedIn()` / `@RequirePermission(key)` / `@PlatformAdmin()`, `@BeforeMfa()` (with `@SignedIn()`), `@CurrentPrincipal()`; `AUTH_PORT` is `BetterAuthAdapter`.
- `src/modules/identity/` also holds setup links, our TOTP (ADR-0045) and the super-admin seed (`pnpm --filter @shifa/api seed:super-admin --phone … --name …`; refuses `NODE_ENV=production` without `--allow-production`). `src/modules/platform/`: the `@PlatformAdmin` clinics API on `createPlatformDb()` (`DATABASE_URL_PLATFORM`), every call audited; setup links point to `CLINIC_WEB_URL`.
- Global `AccessGuard`: not exactly one annotation → 500; anonymous → 401 (`session_expired` for a lapsed session); missing key → 403. Denials log route template and handler only.
- `src/modules/identity/` (ADR-0044): Better Auth via `auth.api.*` only, on `createAuthDb()`; sign-in, sessions (idle and 12 h limits on the injected `CLOCK`), throttle, audit. Request metadata only through `@ClientRequest()`; `platform/request-guard.ts` refuses cross-site or non-JSON unsafe requests.
- `AccessCheck` at bootstrap: a handler without exactly one annotation stops the start.
- Tests: `test/access/probe.ts` holds test keys, grants and a header-driven `AuthPort` (`buildTestApp({ auth, grants })`). `test/architecture/route-matrix.expected.ts` is the reviewed route × role matrix.

## Contracts (ADR-0013)
- `src/platform/contract/`: `@Contract(c)`; `ContractCheck` stops the start on a missing or mismatched contract, unnamed schema, undeclared path parameter, `@Body`/`@Query` without schema, `@Req`/`@RawBody`/unknown own decorators, `@Version`, duplicate operationId; `ContractValidationInterceptor` (after the guard) validates params, query, body → 400 `validation_failed` with `details: [{ path, code }]`, logging issue codes only.
- `openapi.ts` builds the OpenAPI 3.1 document (`z.toJSONSchema`, components by id, `x-public` / `x-signed-in` / `x-permission`); `scripts/generate-openapi.ts` writes `packages/contracts/generated/openapi.json` through the `openapi` drift check (bundled by `tsdown.openapi.config.ts`). No Swagger UI.
- Test-only routes use `testContract(method, path)` from `test/support.ts`.

## Logging and errors
- Log through pino (`request.log` in a request). Lines carry the route template, never the URL; never bodies, query strings, headers or patient data; log record IDs.
- Throw Nest `HttpException`s; the global filter answers `{ error: { code, message } }` with a fixed message per status (catalogue in `@shifa/contracts`). Anything else becomes 500 `internal_error`.
- Log errors with `describeError(err)`: database errors keep `sqlstate`, `constraint`, `table`, `column` only.
- Telemetry (PLT-52): `scrub.ts` allowlists; errors via `reportError()`.

## Commands
- `pnpm --filter @shifa/api test` (Docker for the `db` project), `build` (tsdown → `dist/main.js`), `boot-check` (after `build`; also in `verify:full`).
- Run locally: `DATABASE_URL=postgres://shifa_app:…@localhost:5432/shifa pnpm start`.

## Build
Decorators need metadata, which Node type stripping cannot run, so tsdown bundles `src/` and the `@shifa/*` packages; npm packages stay external and must be in this package's `dependencies` (hence `pg`, used only through `@shifa/db`).
