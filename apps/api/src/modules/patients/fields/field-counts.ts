// How many charts hold each field and each choice (spec A-03 criterion 40; slice A-03-06; the
// owner's list, improvement 8): live charts only (active and archived, not merged). Two grouped
// queries in the clinic's transaction, so RLS bounds both; integers only. One field's answer
// (create, edit, archive, restore) counts that field only (review N3).
import { patient, patientField, patientFieldValue, type Tx } from '@shifa/db';
import { sql } from 'drizzle-orm';

export interface ChartCounts {
  /** Charts per field id. */
  fields: ReadonlyMap<string, number>;
  /** Charts per option id (option ids are unique). */
  options: ReadonlyMap<string, number>;
}

/** Every field's counts, or `fieldId`'s only. */
export async function chartCounts(tx: Tx, fieldId?: string): Promise<ChartCounts> {
  const live = sql`p.tenant_id = v.tenant_id and p.id = v.patient_id and p.state <> 'merged'`;
  const only = fieldId === undefined ? sql`true` : sql`v.field_id = ${fieldId}::uuid`;
  const perField = await tx.execute<{ id: string; n: number }>(
    sql`select v.field_id as id, count(*)::int as n
          from ${patientFieldValue} v join ${patient} p on ${live}
         where ${only}
         group by v.field_id`,
  );
  const perOption = await tx.execute<{ id: string; n: number }>(
    sql`select e.id, count(distinct v.patient_id)::int as n
          from ${patientFieldValue} v
          join ${patient} p on ${live}
          join ${patientField} f on f.tenant_id = v.tenant_id and f.id = v.field_id
         cross join lateral jsonb_array_elements_text(
                 case when jsonb_typeof(v.value) = 'array' then v.value
                      else jsonb_build_array(v.value) end) as e(id)
         where f.type in ('single_choice', 'multi_choice') and ${only}
         group by e.id`,
  );
  const map = (rows: { id: string; n: number }[]) => new Map(rows.map((r) => [r.id, r.n]));
  return { fields: map(perField.rows), options: map(perOption.rows) };
}
