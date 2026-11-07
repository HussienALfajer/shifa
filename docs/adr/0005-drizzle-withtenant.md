# ADR-0005: Data access with Drizzle and a withTenant() transaction wrapper

Status: Accepted · Date: 2026-11-08 · Deciders: product owner (with Claude)

## Context
RLS context must be set inside an explicit transaction on every request and job ([ADR-0004](0004-postgresql-pooled-tenancy-rls.md)). The ORM must make that hard to forget. As of 2026-11-08, Drizzle 1.0 is still a release candidate; Prisma 7's RLS path conflicts with `$transaction`, and Prisma 8's native `@@rls` is also pre-release [RN-16 §3].

## Decision
- Drizzle ORM with schema-as-code and Drizzle migrations, pinned to an exact version (RC caveat recorded; upgrades go through a small ADR or changelog entry).
- All tenant-scoped access goes through `withTenant(ctx, async (tx) => …)`, which opens a transaction, sets `app.tenant_id`, `app.branch_id`, `app.user_id` with `set_config(…, true)`, and passes a `tx` handle. Raw pool access outside the wrapper is blocked by lint.
- Platform-level (cross-tenant) operations use a separate, explicitly named admin path with its own role and audit, never the tenant wrapper.
- Complex reporting SQL may use Kysely or SQL template literals, but only inside the wrapper.
- Migrations follow expand-then-contract; destructive changes need an approved plan (skill `/db-migration`).

## Consequences
+ Explicit `tx` handles make tenant context visible in every query path and easy to test.
+ Schema in TypeScript is shared with Zod contracts and tests.
− Exposure to RC churn until Drizzle 1.0 ships; mitigated by pinning and tests.

## Alternatives considered
- Prisma 7/8: mature tooling, but RLS + transaction handling was awkward at decision time [RN-16 §3].
- Kysely only: excellent query builder, no schema/migration story of its own.
- TypeORM 1.0 / MikroORM: heavier abstractions, less explicit transaction control.

## Sources
[RN-16 §3, §17], [RN-05 §1]
