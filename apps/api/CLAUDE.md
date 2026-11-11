# @shifa/api

NestJS 12 on Fastify, one modular monolith (ADR-0003). Rules for code here: `.claude/rules/api.md`.

## Layout
- `src/main.ts` bootstrap only: config → logger → `createDb()` + startup check → `createApp()` → signals.
- `src/app.ts` adapter (body limit 1 MB, request timeout 30 s, `trustProxy` off, request ids, routing errors → envelope), global filter, hooks. Tests use the same `createAdapter()` + `configureApp()`.
- `src/config/env.ts` Zod config: `DATABASE_URL` (shifa_app), `API_PORT` (3000), `API_HOST` (127.0.0.1), `LOG_LEVEL` (info), `OTEL_*` (`.env.example`). Errors name the key, never the value.
- `src/platform/` database module (`SHIFA_DB` token, pool closed at shutdown), logging, errors.
- `src/modules/<context>/` one folder per bounded context; others import only its `index.ts`. `src/platform/` and `src/access/` never import a module. Enforced by lint (`shifa/module-boundaries`, `tooling/eslint-config/rules/`) and by `test/architecture/module-imports.test.ts`, which also fails on any comment silencing the rule.

## Access (fail-closed)
- `src/access/`: permission keys (empty until Phase A), PLT-42 roles with empty grants, `Principal` + `hasPermission()` (same tenant; tenant-wide or exact-branch role; `platform_admin` never counts for tenant work), `@Public()` / `@RequirePermission(key)`, `AUTH_PORT` (production `NoAuthAdapter` authenticates nobody → every protected route 401).
- Global `AccessGuard`: no annotation → 500; anonymous → 401 `unauthorized`; missing key → 403 `forbidden`. Denials are logged with route template and handler only.
- `AccessCheck` runs at bootstrap and lists every handler with no or both annotations; the app does not start.
- Tests: `test/access/probe.ts` holds test keys, grants and a header-driven `AuthPort` (`buildTestApp({ auth, grants })`). `test/architecture/route-matrix.expected.ts` is the reviewed route × role matrix.

## Contracts (ADR-0013)
- `src/platform/contract/`: `@Contract(c)`; `ContractCheck` at bootstrap (no contract, method/path/success-status mismatch, unnamed schema, undeclared path parameter, `@Body`/`@Query` without its schema, `@Req`/`@RawBody`/own param decorators, `@Version`, duplicate operationId → no start); global `ContractValidationInterceptor` (after the guard) validates params, query, body and replaces them with the parsed values; failures → 400 `validation_failed` with `details: [{ path, code }]` (undeclared keys as `*`), logged with route template and issue codes only.
- `openapi.ts` builds the OpenAPI 3.1 document (`z.toJSONSchema`, components by id, `x-public` / `x-permission`); `scripts/generate-openapi.ts` writes `packages/contracts/generated/openapi.json` through the `openapi` drift check (bundled by `tsdown.openapi.config.ts`). No Swagger UI.
- Test-only routes use `testContract(method, path)` from `test/support.ts`.

## Logging and errors
- Log through pino (`request.log` in a request, else the app logger). Request lines carry the route template (`/patients/:id`), never the URL. Never log bodies, query strings, headers or patient data; log record IDs.
- Throw Nest `HttpException`s; the global filter answers `{ error: { code, message } }` with a fixed message per status (catalogue in `@shifa/contracts`). Anything else becomes 500 `internal_error`.
- Log errors with `describeError(err)`: database errors keep `sqlstate`, `constraint`, `table`, `column` only.
- Telemetry (PLT-52): attributes pass the `src/telemetry/scrub.ts` allowlists; keep the leak test green.

## Commands
- `pnpm --filter @shifa/api test` (Docker for the `db` project), `build` (tsdown → `dist/main.js`), `boot-check` (after `build`; also in `verify:full`).
- Run locally: `DATABASE_URL=postgres://shifa_app:…@localhost:5432/shifa pnpm start`.

## Build
Decorators need metadata, which Node type stripping cannot run, so tsdown bundles `src/` and the `@shifa/*` workspace packages; npm packages stay external and must be listed in this package's `dependencies` (that is why `pg` is here, though code imports it only through `@shifa/db`).
