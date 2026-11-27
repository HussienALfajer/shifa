# @shifa/api

NestJS 12 on Fastify, one modular monolith (ADR-0003). Rules for code here: `.claude/rules/api.md`.

## Layout
- `src/main.ts` bootstrap only: config → logger → `createDb()` + startup check → `createApp()` → signals.
- `src/app.ts` adapter (body limit 1 MB, request timeout 30 s, `trustProxy` off, request ids, routing errors → envelope), global filter, hooks. Tests use the same `createAdapter()` + `configureApp()`.
- `src/config/env.ts` Zod config (`.env.example`): `DATABASE_URL`, `API_*`, `LOG_LEVEL`, `OTEL_*`, `SENTRY_*`, `NODE_ENV`; `loadIdentityConfig()`: `DATABASE_URL_AUTH|PLATFORM`, `BETTER_AUTH_SECRET`, `AUTH_HMAC_KEY`, `CLINIC_WEB_URL`. Errors name keys only.
- `src/platform/` database module (`SHIFA_DB` token, pool closed at shutdown), logging, errors.
- `src/modules/<context>/` one folder per bounded context; others import only its `index.ts`. `src/platform/` and `src/access/` never import a module (lint `shifa/module-boundaries`; `test/architecture/module-imports.test.ts` also fails on a comment silencing it).

## Access (fail-closed)
- `src/access/`: permission catalogue (`permissions.ts`, sensitive flag; unknown keys stop the start), roles, grants, `Principal`/`PrincipalSchema` (AuthPort contract), `isGranted()` (grants ± sensitive overrides), `mfaBlock()`; the four annotations and `@BeforeMfa`.
- Scope binding: handlers take `@CurrentScope()` and reach tenant data only via `TenantDb.run(scope, fn)`; `linkScope()` only for link-bound routes. `test/architecture/table-access.test.ts`: each module's tables.
- Modules: `identity` (sign-in, links, TOTP, seed, `/me/*` chooser), `platform`, `team`, `branches`, `entitlements`, `settings`. Suspended clinic: 403 `clinic_suspended`.
- `AccessGuard`: not one annotation → 500 (`AccessCheck` stops the start first); anonymous → 401 (`session_expired` when lapsed); MFA gate or missing key → 403. Denials log route template and handler only.
- Identity (ADR-0044): Better Auth via `auth.api.*` on `createAuthDb()`; sessions use the injected `CLOCK`. Request metadata only via `@ClientRequest()`; `platform/request-guard.ts` refuses cross-site or non-JSON unsafe requests.
- Tests: `test/access/probe.ts` has test keys, grants and a header `AuthPort` (`buildTestApp({ auth, grants, permissions })`); `test/architecture/route-matrix.expected.ts` is the reviewed route × role matrix.

## Contracts (ADR-0013)
- `src/platform/contract/`: `@Contract(c)`; `ContractCheck` stops the start on a missing or mismatched contract, unnamed schema, undeclared path parameter, `@Body`/`@Query` without schema, `@Req`/`@RawBody`/unknown own decorators, `@Version`, duplicate operationId; `ContractValidationInterceptor` (after the guard) → 400 `validation_failed` with `details: [{ path, code }]`.
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
Decorators need metadata (no Node type stripping), so tsdown bundles `src/` and `@shifa/*`; npm packages stay external and must be in this package's `dependencies` (hence `pg`).
