---
name: add-endpoint
description: Add an API route in apps/api (controller in a module, access annotation, route matrix row, contract, isolation case). Use whenever a controller handler is added, removed or its access changes.
argument-hint: "<METHOD /path> <permission key or public>"
---

Add the endpoint: $ARGUMENTS

1. Read `.claude/rules/api.md` and `apps/api/CLAUDE.md`. Find the bounded context in `apps/api/src/modules/<context>/`; create the folder with an `index.ts` if it is new and import it in `AppModule`.
2. Write the handler in that module's controller. Import access decorators only from `src/access/index.ts`.
3. Annotate the handler with exactly one of:
   - `@RequirePermission(key)`: the default. The key must exist in `src/access/permissions.ts`; adding a key or a grant in `src/access/roles.ts` is a T0 change and needs the requirement ID (PLT-46) in the slice.
   - `@Public()`: only for probes and genuinely public pages that carry no patient data (booking pages). The waiting-room display shows patient names, so it is never public (paired device credential, Phase A). Say why in a comment and in the slice file.
   The app refuses to start when a handler has neither or both.
4. Add the route's row to `apps/api/test/architecture/route-matrix.expected.ts`: the expected status class (200/401/403) for anonymous and every role. The matrix test fails on a route without a row, a row without a route, or a changed status, so this row is what reviewers read. Statuses come from `PRODUCTION_GRANTS` plus the test grants, so a grant change in `roles.ts` changes the matrix too.
5. Contract: until 0.2-07 lands `packages/contracts`, describe the request and response in a Zod schema next to the controller with a `TODO(0.2-07)` marker; afterwards, add it to `packages/contracts`.
6. If the handler reads or writes tenant data: go through `withTenant()` with the tenant the guard checked (the principal's active tenant), never one from the path, query or body, and add a cross-tenant isolation case (tenant A cannot read or change tenant B's rows through this route). Use `/rls-policy` for any new tenant table once 0.2-06b has landed.
7. Module boundary: import other modules only through their `index.ts`; lint (`shifa/module-boundaries`) and `test/architecture/module-imports.test.ts` fail otherwise.
8. Run `pnpm verify` and record the route and its matrix row in the slice file.
