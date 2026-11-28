// The chart rows of one clinic (spec A-03 criteria 1–3, 12, 32), read and written in the
// transaction TenantDb opened for the guard's scope. This module is the only writer of `patient`
// and `patient_file_counter` (A-03-03 adds the name tokens to the same write path; A-03-04 the
// family and treating doctors to the summary).
import { createHash } from 'node:crypto';
import type { PatientChart, StaleChange } from '@shifa/contracts';
import { patientDisplayName } from '@shifa/contracts';
import { branch, membership, patient, patientFileCounter, type Tx } from '@shifa/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ApiError } from '../../platform/errors.ts';
import { treatingDoctorsOf } from './doctors.ts';
import { familyOf } from './family.ts';

export type ChartRow = typeof patient.$inferSelect;

export async function findChart(
  tx: Tx,
  id: string,
  { lock = false } = {},
): Promise<ChartRow | undefined> {
  const query = tx.select().from(patient).where(eq(patient.id, id));
  const [row] = lock ? await query.for('update') : await query;
  return row;
}

/**
 * The clinic's next file number (criterion 2): the counter row is created at 1 or moved on by one,
 * and stays locked until the registration commits; a rolled-back registration gives it back.
 */
export async function takeFileNumber(tx: Tx, tenantId: string): Promise<number> {
  const [row] = await tx
    .insert(patientFileCounter)
    .values({ tenantId, next: 2 })
    .onConflictDoUpdate({
      target: patientFileCounter.tenantId,
      set: { next: sql`${patientFileCounter.next} + 1`, updatedAt: sql`now()` },
    })
    .returning({ next: patientFileCounter.next });
  if (!row) throw new Error('file number not taken');
  return row.next - 1;
}

/** The session's branch, or the clinic's only active branch; null when it has several. */
export async function registeringBranch(
  tx: Tx,
  sessionBranch: string | null,
): Promise<string | null> {
  if (sessionBranch !== null) return sessionBranch;
  const rows = await tx
    .select({ id: branch.id })
    .from(branch)
    .where(isNull(branch.archivedAt))
    .limit(2);
  return rows.length === 1 ? (rows[0]?.id ?? null) : null;
}

/** SHA-256 of the registration as parsed, keys sorted: the same body hashes the same. */
export function requestHash(input: Readonly<Record<string, unknown>>): string {
  const entries = Object.keys(input)
    .sort()
    .filter((key) => input[key] !== undefined)
    .map((key) => [key, input[key]]);
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

/** A timestamp after `previous` (ms precision, as the answer shows it), so `stale` sees every save. */
export function nextStamp(now: Date, previous?: Date): Date {
  const at = Math.floor(now.getTime());
  return new Date(previous && at <= previous.getTime() ? previous.getTime() + 1 : at);
}

/** Members' names as the clinic typed them, by user id (absent: not a member here). */
async function namesOf(tx: Tx, userIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({ userId: membership.userId, name: membership.displayName })
    .from(membership)
    .where(inArray(membership.userId, ids));
  return new Map(rows.flatMap((r) => (r.userId ? [[r.userId, r.name] as const] : [])));
}

/** Who saved the chart last and when (409 `stale`). */
export async function staleChange(tx: Tx, row: ChartRow): Promise<StaleChange> {
  const names = await namesOf(tx, [row.updatedBy]);
  return {
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: names.get(row.updatedBy) ?? null,
  };
}

export async function staleError(tx: Tx, row: ChartRow): Promise<ApiError> {
  return ApiError.stale(await staleChange(tx, row));
}

/** The chart's summary, identity part, read in `tx`. */
export async function chartView(tx: Tx, row: ChartRow): Promise<PatientChart> {
  const names = await namesOf(
    tx,
    [row.createdBy, row.updatedBy, row.archivedBy].filter((id): id is string => id !== null),
  );
  const [registered] = row.registeredBranchId
    ? await tx
        .select({ id: branch.id, name: branch.name })
        .from(branch)
        .where(eq(branch.id, row.registeredBranchId))
    : [];
  const [merged] = row.mergedIntoId
    ? await tx
        .select({ id: patient.id, fileNumber: patient.fileNumber })
        .from(patient)
        .where(and(eq(patient.id, row.mergedIntoId)))
    : [];
  return {
    id: row.id,
    displayName: patientDisplayName(row),
    fileNumber: row.fileNumber,
    sex: row.sex,
    birthDate: row.birthDate,
    birthDateEstimated: row.birthDateEstimated,
    contactPhone: row.contactPhone,
    state: row.state,
    givenName: row.givenName,
    fatherName: row.fatherName,
    familyName: row.familyName,
    motherName: row.motherName,
    secondPhone: row.secondPhone,
    previousFileNumber: row.previousFileNumber,
    registeredBranch: registered ?? null,
    createdAt: row.createdAt.toISOString(),
    createdByName: names.get(row.createdBy) ?? null,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: names.get(row.updatedBy) ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    archivedByName: row.archivedBy ? (names.get(row.archivedBy) ?? null) : null,
    mergedInto: merged ?? null,
    relation: row.relation,
    family: await familyOf(tx, row),
    treatingDoctors: await treatingDoctorsOf(tx, row.id),
  };
}

/** A unique violation of `constraint` (the error or its cause; code and constraint only). */
export function violates(err: unknown, constraint: string): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 3; depth += 1) {
    const c = e as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (c.code === '23505' && c.constraint === constraint) return true;
    e = c.cause;
  }
  return false;
}

export const CHART_KEY = 'patient_pkey';
export const PREVIOUS_NUMBER_KEY = 'patient_tenant_id_previous_file_number_key';
