// The search paths of `POST /patients/search` (spec A-03 criteria 4, 5, 21, 24; ADR-0052), each one
// query in the transaction TenantDb opened, so RLS bounds every row to the clinic:
// - a file number or previous number, exact; a merged chart leads to the chart it was merged into;
// - a phone, exact (E.164) or by its last 7+ digits (`*_phone_tail`, equality, then the suffix);
// - a name: every typed word equal to a stored token (`(tenant_id, token)` index), the charts
//   that hold all of them ranked by whole-word matches, then pg_trgm similarity of the stored
//   key to the typed key, then file number.
// Every comparison an index serves is an equality (texteq, int4eq, uuid_eq: leakproof), so RLS
// never stops the planner from using it (OD-42).
import { lookupToken, patientDisplayName } from '@shifa/contracts';
import { patient, type Tx } from '@shifa/db';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';

export type ChartRow = typeof patient.$inferSelect;
type State = ChartRow['state'];

/** How many rows each path reads: one more than the 20 shown, so `truncated` can be told. */
export const PER_PATH = 21;
/** A merge chain is followed at most this far (A-03-08 merges into active charts only). */
const MERGE_HOPS = 5;

/** The chart a merged chart leads to, in the states searched; null when there is none. */
async function keptChart(tx: Tx, row: ChartRow, states: readonly State[]) {
  let current: ChartRow | undefined = row;
  for (let hop = 0; current?.state === 'merged' && hop < MERGE_HOPS; hop += 1) {
    const next: string | null = current.mergedIntoId;
    if (!next) return null;
    [current] = await tx.select().from(patient).where(eq(patient.id, next));
  }
  return current && states.includes(current.state) ? current : null;
}

export interface NumberHit {
  row: ChartRow;
  /** The merged chart's number that led here, else null. */
  mergedFileNumber: number | null;
}

/** A chart by its file number (any state); a merged one answers its kept chart. */
export async function byFileNumber(tx: Tx, n: number, states: readonly State[]) {
  const [row] = await tx.select().from(patient).where(eq(patient.fileNumber, n));
  return row ? numberHit(tx, row, states) : null;
}

/** A chart by its previous (paper) number, trimmed, exactly. */
export async function byPreviousNumber(tx: Tx, previous: string, states: readonly State[]) {
  const [row] = await tx.select().from(patient).where(eq(patient.previousFileNumber, previous));
  return row ? numberHit(tx, row, states) : null;
}

async function numberHit(tx: Tx, row: ChartRow, states: readonly State[]) {
  const kept = await keptChart(tx, row, states);
  if (!kept) return null;
  return { row: kept, mergedFileNumber: kept.id === row.id ? null : row.fileNumber };
}

/** Charts holding this phone as contact or second phone. */
export function byPhone(tx: Tx, e164: string, states: readonly State[]) {
  const tail = e164.slice(-7);
  return tx
    .select()
    .from(patient)
    .where(
      and(
        inArray(patient.state, [...states]),
        or(
          and(eq(patient.contactPhoneTail, tail), eq(patient.contactPhone, e164)),
          and(eq(patient.secondPhoneTail, tail), eq(patient.secondPhone, e164)),
        ),
      ),
    )
    .orderBy(asc(patient.fileNumber))
    .limit(PER_PATH);
}

/** Charts whose contact or second phone ends with `digits` (7 or more). */
export function byPhoneTail(tx: Tx, digits: string, states: readonly State[]) {
  const tail = digits.slice(-7);
  const ends = (column: typeof patient.contactPhone | typeof patient.secondPhone) =>
    sql`right(${column}, ${digits.length}) = ${digits}`;
  return tx
    .select()
    .from(patient)
    .where(
      and(
        inArray(patient.state, [...states]),
        or(
          and(eq(patient.contactPhoneTail, tail), ends(patient.contactPhone)),
          and(eq(patient.secondPhoneTail, tail), ends(patient.secondPhone)),
        ),
      ),
    )
    .orderBy(asc(patient.fileNumber))
    .limit(PER_PATH);
}

export interface NameHit {
  row: ChartRow;
  /** For each typed word, in order, the parts (0–2) it matched. */
  wordParts: number[][];
}

/**
 * Charts whose tokens hold every word of `words` (key words, two letters or more), best first.
 * `key` is the typed term's key, for the trigram rank.
 */
export async function byName(
  tx: Tx,
  words: readonly string[],
  key: string,
  states: readonly State[],
): Promise<NameHit[]> {
  const { rows } = await tx.execute<{ id: string; word_parts: number[][] }>(
    nameQuery(words, key, states),
  );
  if (rows.length === 0) return [];
  const charts = await tx
    .select()
    .from(patient)
    .where(
      inArray(
        patient.id,
        rows.map((r) => r.id),
      ),
    );
  const byId = new Map(charts.map((c) => [c.id, c]));
  return rows.flatMap((r) => {
    const row = byId.get(r.id);
    return row ? [{ row, wordParts: r.word_parts }] : [];
  });
}

/** The name query (exported for the plan check of the benchmark). */
export function nameQuery(words: readonly string[], key: string, states: readonly State[]) {
  const typed = sql.join(
    words.map((w, i) => sql`(${i}::int, ${lookupToken(w)}::text)`),
    sql`, `,
  );
  const stateList = sql.join(
    states.map((s) => sql`${s}`),
    sql`, `,
  );
  return sql`
    with words(ord, token) as (values ${typed}),
    hits as (
      select t.patient_id, w.ord, max(case when t.whole then 2 else 1 end) as quality,
             array_agg(distinct t.part order by t.part) as parts
      from words w
      join patient_name_token t on t.token = w.token
      group by t.patient_id, w.ord
    ),
    matched as (
      select patient_id, sum(quality) as score,
             json_agg(parts order by ord) as word_parts
      from hits
      group by patient_id
      having count(*) = ${words.length}
    )
    select p.id, m.word_parts
    from matched m
    join patient p on p.id = m.patient_id
    where p.state in (${stateList})
    order by m.score desc, coalesce(similarity(p.name_key, ${key}), 0) desc, p.file_number asc
    limit ${PER_PATH}`;
}

/** The display name of a chart row. */
export const displayNameOf = (row: ChartRow) => patientDisplayName(row);
