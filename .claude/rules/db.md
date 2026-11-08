---
paths:
  - "packages/db/**"
  - "**/migrations/**"
---

# Database schema and migrations

- PostgreSQL 18, Drizzle schema in `packages/db/src/schema/`; migrations generated into `packages/db/migrations/<timestamp>_<name>/` with `/db-migration`. `snapshot.json` is generated: never edit it.
- A merged migration is never edited; add a new one. Changes are expand → migrate → contract: add nullable/new first, backfill, switch readers, drop in a later release. Destructive steps (drop, rename, type narrowing) need an approved plan.
- Every tenant-scoped table: `tenant_id uuid not null` (and `branch_id` where relevant) as the leading column of every index and of composite unique and foreign keys; `ENABLE` and `FORCE ROW LEVEL SECURITY`; a policy `USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())`.
- Tables are owned by `shifa_owner`; `shifa_app` gets DML through default privileges and never owns objects. Never grant `BYPASSRLS`, superuser or ownership to `shifa_app`.
- Roles live in `packages/db/sql/roles.sql` (cluster-level, idempotent), not in migrations.
- Unique and foreign-key checks ignore RLS: include `tenant_id` in them so they cannot reveal other tenants' rows.
- No real patient data in seeds, fixtures or migrations (`docs/compliance/data-handling.md`).
- Every table in `public` is listed in `packages/db/src/schema/classification.ts` (tenant, global or system); every tenant table has an isolation case in `packages/db/test/isolation/cases/`. Use `/rls-policy`; the RLS presence test and isolation suite enforce both.
