// Families (spec A-03 criteria 9, 29; OD-138; slice A-03-04): the active charts on one contact
// phone, each with an optional relation to the phone's holder. Read and written in the
// transaction TenantDb opened, so RLS bounds every row to the clinic; every lookup is an equality
// on `(tenant_id, contact_phone)`. A save that decides a relation takes a transaction-level lock
// on the clinic's phone first, so two registrations on a new phone never both become its holder.
import type { FamilyMember, PatientFamily, PatientRelation } from '@shifa/contracts';
import { patient, type Tx } from '@shifa/db';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { type ChartRow, memberOf } from './cards.ts';

/** The active charts on `phone` (E.164) but `excludeId`, by file number. */
async function chartsOn(tx: Tx, phone: string, excludeId: string | null): Promise<ChartRow[]> {
  const where = and(eq(patient.contactPhone, phone), eq(patient.state, 'active'));
  return tx
    .select()
    .from(patient)
    .where(excludeId === null ? where : and(where, ne(patient.id, excludeId)))
    .orderBy(asc(patient.fileNumber));
}

/** The holder (the first chart marked `holder`) and the others (contract `POST /patients/family`). */
export async function familyOn(
  tx: Tx,
  phone: string,
  excludeId: string | null,
): Promise<PatientFamily> {
  const charts = await chartsOn(tx, phone, excludeId);
  const holder = charts.find((c) => c.relation === 'holder') ?? null;
  return {
    holder: holder ? memberOf(holder) : null,
    members: charts.filter((c) => c !== holder).map(memberOf),
  };
}

/** A chart's family for its summary: the other active charts on its phone, holder first. */
export async function familyOf(tx: Tx, row: ChartRow): Promise<FamilyMember[]> {
  const { holder, members } = await familyOn(tx, row.contactPhone, row.id);
  return holder ? [holder, ...members] : members;
}

/** Active charts per contact phone (search results' `familySize`). */
export async function familySizes(tx: Tx, phones: readonly string[]): Promise<Map<string, number>> {
  const distinct = [...new Set(phones)];
  if (distinct.length === 0) return new Map();
  const rows = await tx
    .select({ phone: patient.contactPhone, count: sql<number>`count(*)::int` })
    .from(patient)
    .where(and(inArray(patient.contactPhone, distinct), eq(patient.state, 'active')))
    .groupBy(patient.contactPhone);
  return new Map(rows.map((r) => [r.phone, r.count]));
}

const relationRefused = () =>
  new RequestValidationError([{ path: 'body.relation', code: 'invalid_value' }]);

export interface RelationChoice {
  /** The relation sent: absent, cleared (null) or a value. */
  readonly requested: PatientRelation | null | undefined;
  /** The chart's relation before an edit; undefined on registration. */
  readonly current?: PatientRelation | null;
  /** True when the chart's phone is the one asked about already (an edit that kept it). */
  readonly samePhone: boolean;
}

/**
 * The relation a save stores on `phone` (criteria 9, 29), after locking the clinic's phone:
 * - a phone with no other active chart: the chart is its holder (another relation is refused);
 * - a phone with a family: the relation sent (`holder` refused while it has one); none sent
 *   keeps an edit's relation when the phone did not change, else none.
 */
export async function relationOn(
  tx: Tx,
  tenantId: string,
  phone: string,
  selfId: string,
  choice: RelationChoice,
): Promise<PatientRelation | null> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`patient-family:${tenantId}:${phone}`}, 0))`,
  );
  const others = await chartsOn(tx, phone, selfId);
  const { requested } = choice;
  if (others.length === 0) {
    if (requested !== undefined && requested !== null && requested !== 'holder') {
      throw relationRefused();
    }
    return 'holder';
  }
  if (requested !== undefined) {
    if (requested === 'holder' && others.some((c) => c.relation === 'holder')) {
      throw relationRefused();
    }
    return requested;
  }
  return choice.samePhone ? (choice.current ?? null) : null;
}
