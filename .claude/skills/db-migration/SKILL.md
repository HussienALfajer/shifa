---
name: db-migration
description: Generate and review a Drizzle migration in packages/db (expand → migrate → contract, FORCE RLS on tenant tables). Use whenever the database schema changes.
argument-hint: "<short_snake_case_name>"
---

Create the migration: $ARGUMENTS

1. Read `.claude/rules/db.md` and `packages/db/CLAUDE.md`. Confirm Docker is running (`docker version`).
2. Change the schema in `packages/db/src/schema/` (or, for SQL Drizzle cannot express, such as policies, functions or extensions, plan a custom migration).
3. Generate from `packages/db`: `pnpm exec drizzle-kit generate --name <name>` (add `--custom` for hand-written SQL). Never edit `snapshot.json` or a migration that is already on `main`.
4. Review the SQL in `migrations/<timestamp>_<name>/migration.sql` line by line and refuse to continue if it:
   - drops or renames a table or column, narrows a type, or adds `NOT NULL` to a populated column without a default — unless the slice plan has an approved expand → migrate → contract plan for it; stop and ask the owner otherwise;
   - creates a tenant table without `tenant_id` leading its indexes and keys, or without `ENABLE` + `FORCE ROW LEVEL SECURITY` and a policy on `current_tenant_id()`;
   - grants anything to `shifa_app` beyond what default privileges give, or changes ownership;
   - locks a large table for long (`ALTER TABLE ... SET NOT NULL`, non-concurrent index on existing data): note it in the slice file.
   Add `--> statement-breakpoint` between statements of custom migrations.
5. A new table in `public`: follow `/rls-policy` (classification entry in `src/schema/classification.ts`, policies, isolation case in `test/isolation/cases/`). The RLS presence test and the isolation suite fail until it is done.
6. Run `pnpm verify`. The harness applies all migrations to a fresh template, so a broken migration fails there.
7. Record in the slice file: the migration name, whether it is expand, migrate or contract, and the rollback note.
