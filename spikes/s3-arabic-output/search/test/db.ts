// Shared setup for the PostgreSQL tests: the `s3` schema on this worker's database and the
// `load` preset's synthetic patients in both spike tables.
import { readFile } from 'node:fs/promises';
import { ownerDb } from '@shifa/db/testing';
import { DEFAULT_LOAD_PARAMS, type LoadParams } from '@shifa/testing';
import { sql } from 'drizzle-orm';
import { normaliseName } from '../src/normalise.ts';
import { type SeedPatient, syntheticPatients } from '../src/seed.ts';

const SCHEMA = new URL('../sql/schema.sql', import.meta.url);

export async function applySchema(): Promise<void> {
  // No parameters, so pg sends the whole file in one simple-protocol query.
  await ownerDb().execute(sql.raw(await readFile(SCHEMA, 'utf8')));
}

/**
 * Inserts the patients as the owner, tenant by tenant: FORCE RLS holds the owner to the tenant
 * context too, so each tenant's rows go in one transaction with app.tenant_id set. patient_a
 * gets the TypeScript key; patient_b computes its own (generated column).
 */
export async function insertPatients(patients: readonly SeedPatient[]): Promise<void> {
  const byTenant = new Map<string, SeedPatient[]>();
  for (const p of patients) byTenant.set(p.tenantId, [...(byTenant.get(p.tenantId) ?? []), p]);
  for (const [tenantId, rows] of byTenant) {
    await ownerDb().transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      const ids = rows.map((r) => r.id);
      const names = rows.map((r) => r.displayName);
      await tx.execute(sql`insert into s3.patient_a (tenant_id, id, display_name, name_key)
        select ${tenantId}::uuid, id, name, key
          from unnest(${sql.param(ids)}::uuid[], ${sql.param(names)}::text[], ${sql.param(names.map(normaliseName))}::text[]) as t(id, name, key)`);
      await tx.execute(sql`insert into s3.patient_b (tenant_id, id, display_name)
        select ${tenantId}::uuid, id, name from unnest(${sql.param(ids)}::uuid[], ${sql.param(names)}::text[]) as t(id, name)`);
    });
  }
  await ownerDb().execute(sql`analyze s3.patient_a`);
  await ownerDb().execute(sql`analyze s3.patient_b`);
}

/** Empties both spike tables if they exist (between bench scenarios). */
export async function resetS3(): Promise<void> {
  await applySchema();
  await ownerDb().execute(sql`truncate s3.patient_a, s3.patient_b`);
}

/** Applies the schema and seeds the `load` preset (default 50 × 1,000) into both tables. */
export async function seedLoad(load: LoadParams = DEFAULT_LOAD_PARAMS): Promise<SeedPatient[]> {
  await applySchema();
  const patients = syntheticPatients(load);
  await insertPatients(patients);
  return patients;
}
