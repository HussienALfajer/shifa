// Place counts across clinics (A-02 criterion 24; ADR-0051): how many non-archived branches hold a
// city or area, in how many clinics, with how many doctors. place_counts() (SECURITY DEFINER) reads
// each clinic under its own tenant policies and returns integers only, by the place's position in
// the array; this helper maps them back to the ids the platform already holds. Every clinic is
// passed from `tenant` in the same statement (shifa_platform lists clinics, never their rows).
import { sql } from 'drizzle-orm';
import { assertUuid } from './context.ts';
import type { PlatformTx } from './platform.ts';

export interface PlaceCounts {
  branchCount: number;
  clinicCount: number;
  doctorCount: number;
}

export const NO_PLACE_COUNTS: PlaceCounts = { branchCount: 0, clinicCount: 0, doctorCount: 0 };

/** The counts of each place in `ids` (all of one kind), by id; runs in a place action only. */
export async function placeCounts(
  tx: PlatformTx,
  kind: 'city' | 'area',
  ids: readonly string[],
): Promise<Map<string, PlaceCounts>> {
  const out = new Map<string, PlaceCounts>();
  if (ids.length === 0) return out;
  for (const id of ids) assertUuid('placeId', id);
  const places = `{${ids.join(',')}}`;
  const { rows } = await tx.execute<{
    ord: number;
    branches: number;
    clinics: number;
    doctors: number;
  }>(sql`select ord, branches, clinics, doctors
           from place_counts(${kind}, ${places}::uuid[], array(select id from tenant))`);
  for (const row of rows) {
    const id = ids[row.ord - 1];
    if (id === undefined) continue;
    out.set(id, {
      branchCount: row.branches,
      clinicCount: row.clinics,
      doctorCount: row.doctors,
    });
  }
  return out;
}
