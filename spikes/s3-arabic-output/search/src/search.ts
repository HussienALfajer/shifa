// The patient-search query the spike measures: trigram match on the normalised key, best five,
// run by the caller inside withTenant() (the policy picks the tenant; the query names none).
import type { Tx } from '@shifa/db';
import { sql } from 'drizzle-orm';

export const SEARCH_TABLES = ['patient_a', 'patient_b'] as const;
export type SearchTable = (typeof SEARCH_TABLES)[number];

/** pg_trgm's default `similarity_threshold`, recorded for the report. */
export const SIMILARITY_THRESHOLD = 0.3;
export const TOP = 5;

export interface SearchHit {
  tenantId: string;
  id: string;
  score: number;
}

export function searchSql(table: SearchTable, key: string) {
  return sql`select tenant_id as "tenantId", id, similarity(name_key, ${key})::float8 as score
               from ${sql.identifier('s3')}.${sql.identifier(table)}
              where name_key % ${key}
              order by score desc, id
              limit ${TOP}`;
}

export async function searchPatients(
  tx: Tx,
  table: SearchTable,
  key: string,
): Promise<SearchHit[]> {
  const { rows } = await tx.execute<{ tenantId: string; id: string; score: number }>(
    searchSql(table, key),
  );
  return rows;
}
