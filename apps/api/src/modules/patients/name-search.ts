// The name paths of `POST /patients/search` (spec A-03 criteria 4, 5, 24; ADR-0052), in the
// transaction TenantDb opened, so RLS bounds every row to the clinic. Every index lookup is an
// equality on `(tenant_id, token, whole, patient_id)` (texteq is leakproof, OD-42).
// - Tokens: the charts holding every typed word, by intersecting each word's index-only scan; one
//   word alone reads its whole-word holders first. At most CANDIDATES charts are ranked (a common
//   start such as «ال» then answers `truncated`): by whole-word matches, then pg_trgm similarity
//   of the stored key to the typed key, then file number.
// - Typo fallback (owner, 2026-11-27): when the tokens find nothing, the candidates are the charts
//   holding every typed word that some chart holds (or, when none does, every word's first three
//   letters); one is kept when each typed word is one of its tokens or has a trigram similarity of
//   SIMILAR or more with one of its whole words («احمر» for «احمد»), and ranked by similarity of
//   the stored key to the typed key.
import { lookupToken } from '@shifa/contracts';
import { patient, type Tx } from '@shifa/db';
import { inArray, type SQL, sql } from 'drizzle-orm';
import type { ChartRow } from './search.ts';

type State = ChartRow['state'];

/** Charts ranked at most, per name query. */
export const CANDIDATES = 1000;
/** Trigram similarity a mistyped word needs with a stored whole word. */
export const SIMILAR = 0.25;
const ROWS = 21;

export interface NameHit {
  row: ChartRow;
  /** For each typed word, in order, the parts (0–2) it matched (empty in the typo fallback). */
  wordParts: number[][];
  /** Found by trigram similarity, not by tokens. */
  fuzzy: boolean;
}

export interface NameHits {
  hits: NameHit[];
  /** More charts held the words than were ranked (the answer says `truncated`). */
  capped: boolean;
}

const list = (items: SQL[]) => sql.join(items, sql`, `);
const statesOf = (states: readonly State[]) => list(states.map((s) => sql`${s}`));

/**
 * The charts holding every one of `tokens` (at most CANDIDATES + 1, so a cut can be told). One
 * token alone: whole-word holders first.
 */
function candidates(tokens: readonly string[]): SQL {
  const [only] = tokens;
  if (tokens.length === 1 && only !== undefined) {
    return sql`(select t.patient_id from patient_name_token t where t.token = ${only}
                order by t.whole desc limit ${CANDIDATES + 1})`;
  }
  const scans = tokens.map(
    (token) => sql`(select t.patient_id from patient_name_token t where t.token = ${token})`,
  );
  return sql`((${sql.join(scans, sql` intersect `)}) limit ${CANDIDATES + 1})`;
}

/** The token query (exported for the benchmark's plan check). */
export function nameQuery(words: readonly string[], key: string, states: readonly State[]): SQL {
  const tokens = words.map(lookupToken);
  const typed = list(tokens.map((t, i) => sql`(${i}::int, ${t}::text)`));
  return sql`
    with words(ord, token) as (values ${typed}),
    found as (select c.patient_id from ${candidates(tokens)} c),
    picked as (select patient_id from found limit ${CANDIDATES}),
    hits as (
      select t.patient_id, w.ord, max(case when t.whole then 2 else 1 end) as quality,
             array_agg(distinct t.part order by t.part) as parts
      from picked c
      join patient_name_token t on t.patient_id = c.patient_id
      join words w on w.token = t.token
      group by t.patient_id, w.ord
    ),
    matched as (
      select patient_id, sum(quality) as score, json_agg(parts order by ord) as word_parts
      from hits
      group by patient_id
      having count(*) = ${words.length}
    )
    select p.id, m.word_parts, (select count(*) from found) > ${CANDIDATES} as capped
    from matched m
    join patient p on p.id = m.patient_id
    where p.state in (${statesOf(states)})
    order by m.score desc, coalesce(similarity(p.name_key, ${key}), 0) desc, p.file_number asc
    limit ${ROWS}`;
}

/** The typo fallback over the charts holding every one of `sources`. */
function fuzzyQuery(
  sources: readonly string[],
  words: readonly string[],
  key: string,
  states: readonly State[],
): SQL {
  const typed = list(words.map((w) => sql`(${lookupToken(w)}::text)`));
  return sql`
    with words(token) as (values ${typed}),
    found as (select c.patient_id from ${candidates(sources)} c),
    picked as (select patient_id from found limit ${CANDIDATES}),
    near as (
      select c.patient_id from picked c
      where not exists (
        select 1 from words w
        where not exists (
          select 1 from patient_name_token t
          where t.patient_id = c.patient_id
            and (t.token = w.token or (t.whole and similarity(t.token, w.token) >= ${SIMILAR}))
        )
      )
    )
    select p.id, (select count(*) from found) > ${CANDIDATES} as capped
    from near n
    join patient p on p.id = n.patient_id
    where p.state in (${statesOf(states)})
    order by coalesce(similarity(p.name_key, ${key}), 0) desc, p.file_number asc
    limit ${ROWS}`;
}

async function chartsOf(tx: Tx, ids: readonly string[]): Promise<Map<string, ChartRow>> {
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select()
    .from(patient)
    .where(inArray(patient.id, [...ids]));
  return new Map(rows.map((r) => [r.id, r]));
}

async function hitsOf(
  tx: Tx,
  rows: readonly { id: string; word_parts?: number[][]; capped: boolean }[],
  fuzzy: boolean,
): Promise<NameHits> {
  const charts = await chartsOf(
    tx,
    rows.map((r) => r.id),
  );
  return {
    hits: rows.flatMap((r) => {
      const row = charts.get(r.id);
      return row ? [{ row, wordParts: r.word_parts ?? [], fuzzy }] : [];
    }),
    capped: rows.some((r) => r.capped),
  };
}

/** Charts whose tokens hold every word of `words` (key words of 2 letters or more), best first. */
export async function byName(
  tx: Tx,
  words: readonly string[],
  key: string,
  states: readonly State[],
): Promise<NameHits> {
  const { rows } = await tx.execute<{ id: string; word_parts: number[][]; capped: boolean }>(
    nameQuery(words, key, states),
  );
  return hitsOf(tx, rows, false);
}

/** The typed tokens some chart of the clinic holds. */
async function heldTokens(tx: Tx, tokens: readonly string[]): Promise<string[]> {
  const typed = list(tokens.map((t) => sql`(${t}::text)`));
  const { rows } = await tx.execute<{ token: string }>(sql`
    select w.token from (values ${typed}) as w(token)
    where exists (select 1 from patient_name_token t where t.token = w.token)`);
  return rows.map((r) => r.token);
}

/** The typo fallback: candidates from the words some chart holds, else from three-letter starts. */
export async function bySimilarName(
  tx: Tx,
  words: readonly string[],
  key: string,
  states: readonly State[],
): Promise<NameHits> {
  const held = await heldTokens(tx, words.map(lookupToken));
  const starts = [...new Set(words.map((w) => Array.from(w).slice(0, 3).join('')))];
  const sources = held.length > 0 ? held : await heldTokens(tx, starts);
  if (sources.length === 0) return { hits: [], capped: false };
  const { rows } = await tx.execute<{ id: string; capped: boolean }>(
    fuzzyQuery(sources, words, key, states),
  );
  return hitsOf(tx, rows, true);
}
