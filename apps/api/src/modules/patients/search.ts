// The search paths of `POST /patients/search` (spec A-03 criteria 4, 5, 21, 24; ADR-0052), each one
// query in the transaction TenantDb opened, so RLS bounds every row to the clinic:
// - a file number or previous number, exact; a merged chart leads to the chart it was merged into;
// - a phone, exact (E.164) or by its last 7+ digits (`*_phone_tail`, equality, then the suffix);
// - a name: `name-search.ts`.
// Every comparison an index serves is an equality (texteq, int4eq, uuid_eq: leakproof), so RLS
// never stops the planner from using it (OD-42).
import { patientDisplayName } from '@shifa/contracts';
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

/** Arabic-Indic and Persian digits as ASCII. */
export const asciiDigits = (text: string) =>
  text.replace(/[\u{0660}-\u{0669}\u{06F0}-\u{06F9}]/gu, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });

/** ASCII digits as Arabic-Indic. */
const arabicDigits = (text: string) =>
  text.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

/**
 * A chart by its previous (paper) number, trimmed, as typed or in either digit system (the
 * number is stored as it was typed).
 */
export async function byPreviousNumber(tx: Tx, previous: string, states: readonly State[]) {
  const ascii = asciiDigits(previous);
  const spellings = [...new Set([previous, ascii, arabicDigits(ascii)])];
  const [row] = await tx
    .select()
    .from(patient)
    .where(inArray(patient.previousFileNumber, spellings))
    .orderBy(asc(patient.fileNumber))
    .limit(1);
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

/** The display name of a chart row. */
export const displayNameOf = (row: ChartRow) => patientDisplayName(row);
