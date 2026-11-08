---
paths:
  - "apps/api/**"
---

# API code (NestJS + Fastify)

- No `console.*` (lint enforces it). Log with pino: `request.log` inside a request, the app logger elsewhere. Never log request bodies, query strings, headers, tokens or patient data.
- Errors go through the global filter (`src/platform/errors.ts`): throw Nest `HttpException`s, never write an error response by hand, never put user input in an error message.
- Log any caught error as `{ err: describeError(err) }`. Never log a database error's `message`, `detail`, `hint` or `where`: they can echo values.
- Database access only through `@shifa/db`: inject `SHIFA_DB` and use `withTenant()` (or `withPlatformAdmin(reason, …)` for platform work). No raw drivers, no second `createDb()`.
- Every new runtime npm import must also be in `apps/api/package.json` `dependencies` (the bundle resolves externals from there).
- Inject with explicit tokens (`@Inject(Service)`), not by type alone.
- New feature code lives in `src/modules/<context>/` with an `index.ts` public surface; import other modules only through their `index.ts`. `src/platform/` and `src/access/` never import a module. Never disable `shifa/module-boundaries`: the architecture test fails on it.
- Every route handler carries exactly one of `@RequirePermission(key)` (default) or `@Public()` from `src/access/index.ts`; the app refuses to start otherwise. Every route has a row in `test/architecture/route-matrix.expected.ts`. Use `/add-endpoint`.
- Never grant permissions outside `src/access/roles.ts`, never read the principal from headers yourself, and never add test permission keys to `src/`.
- Config keys are added to `src/config/env.ts` (Zod) with a test; read `process.env` nowhere else.
