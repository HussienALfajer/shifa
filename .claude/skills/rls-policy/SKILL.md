---
name: rls-policy
description: Make a new or changed table in packages/db tenant-safe (tenant_id, ENABLE + FORCE RLS, policies on current_tenant_id(), classification entry, isolation case). Use with /db-migration whenever a table is added to `public`.
argument-hint: "<table_name>"
---

Make the table tenant-safe: $ARGUMENTS

1. Decide its class in `packages/db/src/schema/classification.ts` (every table in `public` is listed exactly once):
   - `tenant`: holds any one tenant's rows (the default; patient, clinic, staff, money data is always tenant);
   - `global`: no tenant data at all, with a `reason`; a global table must not have `tenant_id`;
   - `system`: infrastructure the application never reads for tenant data, with a `reason`.
   If unsure, stop and ask the owner; never classify a table global to avoid RLS.
2. For a `tenant` table, the schema has `tenant_id uuid not null`, every index and composite unique or foreign key leads with `tenant_id` (the primary key may be a plain `id`), and the custom migration (`/db-migration`, `--custom`) adds:

   ```sql
   ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
   --> statement-breakpoint
   ALTER TABLE <t> FORCE ROW LEVEL SECURITY;
   --> statement-breakpoint
   CREATE POLICY <t>_tenant_isolation ON <t>
     USING (tenant_id = current_tenant_id())
     WITH CHECK (tenant_id = current_tenant_id());
   ```
   One `FOR ALL` policy is the default. Per-command policies are allowed only if SELECT, INSERT, UPDATE and DELETE are all covered and each filters on `tenant_id = current_tenant_id()`. Extra conditions are ANDed after the tenant filter (`tenant_id = current_tenant_id() AND ...`), never ORed: no "admin sees all" `OR current_tenant_id() IS NULL`. Foreign keys to tenant tables are composite and lead with `tenant_id` on both sides (`foreign key (tenant_id, patient_id) references patients (tenant_id, id)`, with a unique index on `(tenant_id, id)`); a primary key is a single `uuid` or leads with `tenant_id`. Tables live in `public` only. Views over tenant tables use `WITH (security_invoker = true)`; no materialized views over tenant data. Never grant to `PUBLIC`.
3. Add the isolation case `packages/db/test/isolation/cases/<table>.ts` and list it in `cases/index.ts`:

   ```ts
   export const appointmentsCase = defineIsolationCase({
     table: 'appointments',
     seed: async (tx, tenantId) => { await tx.insert(appointments).values(syntheticAppointment(tenantId)); },
     paths: {
       'list by day': (tx) => tx.select().from(appointments).where(eq(appointments.day, DAY)),
     },
   });
   ```
   `seed` writes at least one row through `tx`, into this table only and without `RETURNING` (it runs as `shifa_app`, and with a foreign tenant inside tenant A and without a tenant context, where it must be refused for this table). Parent rows a seed needs come from a case for the parent table, not from this seed; if that is not possible yet, stop and ask. `paths` lists every read the application does on the table, each returning rows that include `tenant_id`/`tenantId` and at least one of tenant A's rows. Synthetic data only.
4. Run `pnpm verify`. The presence test (`test/architecture/rls-presence.test.ts`) and the isolation suite (`test/isolation/isolation.test.ts`) fail with the table name until steps 1 to 3 are done; do not weaken them.
