// Duplicate candidates (spec A-03 criteria 7, 27; OD-139; slice A-03-04), in the transaction
// TenantDb opened, so RLS bounds every row to the clinic. Two rules, each one indexed lookup:
// - the same contact phone (`(tenant_id, contact_phone)`) with a similar given name: the same
//   name key (ADR-0034), so spelling variants match and twins with different given names do not;
// - a similar full name with a birth year within 2 years: every typed word (two or more) a whole
//   word of the chart's name, in any part and order, by intersecting equality scans of the name
//   token index (A-03-03, ADR-0052; texteq is leakproof, OD-42).
// Merged charts are never candidates; archived ones are, marked by their state. Names, phones and
// dates stay in the query parameters: nothing here is logged or audited but chart ids.
import {
  type DuplicateCandidate,
  type DuplicateCheckRequest,
  type DuplicateReason,
  keyWords,
  lookupToken,
  normaliseName,
  normalisePhone,
} from '@shifa/contracts';
import { patient, type Tx } from '@shifa/db';
import { and, asc, eq, inArray, ne, type SQL, sql } from 'drizzle-orm';
import { ApiError } from '../../platform/errors.ts';
import { birthOf } from './birth.ts';
import { type ChartRow, cardOf } from './cards.ts';

/** Candidates answered at most. */
export const MAX_CANDIDATES = 5;
/** Years either side of the typed birth year (criterion 7). */
const YEARS = 2;
/** Charts read on one phone before the given names are compared. */
const ON_PHONE = 50;
/** Words of a full name looked up at most (a name has three parts). */
const MAX_WORDS = 6;

/** A check as the rules read it. */
export interface DuplicateQuery {
  /** The given name's key, or null when not typed. */
  readonly givenKey: string | null;
  /** The full name's distinct key words (two letters or more), for rule 2. */
  readonly words: readonly string[];
  /** E.164, or null when not typed or not yet a valid number. */
  readonly phone: string | null;
  /** The birth year, or null when neither a date nor an age was typed. */
  readonly birthYear: number | null;
  readonly excludeId: string | null;
}

const wordsOf = (key: string) =>
  [...new Set(keyWords(key).filter((w) => /\p{L}/u.test(w) && Array.from(w).length >= 2))].slice(
    0,
    MAX_WORDS,
  );

/** The fields typed so far as the rules read them; `today` is the Damascus day. */
export function duplicateQuery(input: DuplicateCheckRequest, today: string): DuplicateQuery {
  const parts = [input.givenName, input.fatherName, input.familyName].filter(
    (p): p is string => typeof p === 'string',
  );
  const phone = input.contactPhone === undefined ? null : normalisePhone(input.contactPhone);
  const birth = birthOf(input, today);
  const givenKey = input.givenName === undefined ? '' : normaliseName(input.givenName);
  return {
    givenKey: givenKey === '' ? null : givenKey,
    words: wordsOf(normaliseName(parts.join(' '))),
    phone: phone?.ok ? phone.e164 : null,
    birthYear: birth ? Number(birth.birthDate.slice(0, 4)) : null,
    excludeId: input.excludeId ?? null,
  };
}

export interface Candidate {
  row: ChartRow;
  reason: DuplicateReason;
}

const notExcluded = (excludeId: string | null): SQL | undefined =>
  excludeId === null ? undefined : ne(patient.id, excludeId);

/** Rule 1: charts on the phone whose given name has the same key. */
async function onPhone(tx: Tx, q: DuplicateQuery): Promise<ChartRow[]> {
  if (q.phone === null || q.givenKey === null) return [];
  const rows = await tx
    .select()
    .from(patient)
    .where(
      and(eq(patient.contactPhone, q.phone), ne(patient.state, 'merged'), notExcluded(q.excludeId)),
    )
    .orderBy(asc(patient.fileNumber))
    .limit(ON_PHONE);
  return rows.filter((r) => normaliseName(r.givenName) === q.givenKey);
}

/** Rule 2: charts holding every typed word as a whole word, born within YEARS of the year. */
async function byFullName(tx: Tx, q: DuplicateQuery): Promise<ChartRow[]> {
  if (q.words.length < 2 || q.birthYear === null) return [];
  const scans = q.words.map(
    (w) =>
      sql`(select t.patient_id from patient_name_token t where t.token = ${lookupToken(w)} and t.whole)`,
  );
  const from = `${String(q.birthYear - YEARS).padStart(4, '0')}-01-01`;
  const to = `${String(q.birthYear + YEARS).padStart(4, '0')}-12-31`;
  const { rows } = await tx.execute<{ id: string }>(sql`
    select p.id
    from (${sql.join(scans, sql` intersect `)}) f
    join patient p on p.id = f.patient_id
    where p.state <> 'merged'
      and p.birth_date between ${from}::date and ${to}::date
      ${q.excludeId === null ? sql`` : sql`and p.id <> ${q.excludeId}::uuid`}
    order by p.file_number
    limit ${MAX_CANDIDATES}`);
  if (rows.length === 0) return [];
  const charts = await tx
    .select()
    .from(patient)
    .where(
      inArray(
        patient.id,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(patient.fileNumber));
  return charts;
}

/** Both rules' charts, phone matches first, at most MAX_CANDIDATES (exported for the benchmark). */
export async function findCandidates(tx: Tx, q: DuplicateQuery): Promise<Candidate[]> {
  const found: Candidate[] = (await onPhone(tx, q)).map((row) => ({
    row,
    reason: 'same_phone_similar_name',
  }));
  if (found.length < MAX_CANDIDATES) {
    const seen = new Set(found.map((c) => c.row.id));
    for (const row of await byFullName(tx, q)) {
      if (!seen.has(row.id)) found.push({ row, reason: 'similar_name_near_birth_year' });
    }
  }
  return found.slice(0, MAX_CANDIDATES);
}

/** A candidate as the answer shows it (the hidden shape comes with A-03-07). */
export function candidateView(c: Candidate): DuplicateCandidate {
  return { visible: true, fileNumber: c.row.fileNumber, reason: c.reason, card: cardOf(c.row) };
}

/**
 * The server's re-check of a save (criteria 7, 27): any candidate not in `acknowledged` answers
 * 409 `possible_duplicate` with every candidate; else the ids registered anyway (maybe none).
 */
export async function acknowledgedCandidates(
  tx: Tx,
  q: DuplicateQuery,
  acknowledged: readonly string[] | undefined,
): Promise<string[]> {
  const candidates = await findCandidates(tx, q);
  const ok = new Set(acknowledged ?? []);
  if (candidates.some((c) => !ok.has(c.row.id))) {
    throw ApiError.possibleDuplicate(candidates.map(candidateView));
  }
  return candidates.map((c) => c.row.id);
}
