// Treating doctors (spec A-03 criterion 10; OD-140; slice A-03-04): doctor members of the clinic,
// by membership id. A member is a doctor while they hold the doctor role in any branch; an active
// doctor is also an active member. A deactivated doctor stays on charts, marked inactive, and is
// not offered or added anew. Read and written in the transaction TenantDb opened (RLS).
import type { TreatingDoctor } from '@shifa/contracts';
import { membership, patientTreatingDoctor, roleAssignment, type Tx } from '@shifa/db';
import { and, asc, eq, exists, inArray, ne } from 'drizzle-orm';
import { ApiError } from '../../platform/errors.ts';

const holdsDoctor = (tx: Tx) =>
  exists(
    tx
      .select({ id: roleAssignment.id })
      .from(roleAssignment)
      .where(
        and(eq(roleAssignment.membershipId, membership.id), eq(roleAssignment.role, 'doctor')),
      ),
  );

/** The clinic's doctor members who were ever bound (not pending), active ones first. */
export async function doctorChoices(tx: Tx): Promise<TreatingDoctor[]> {
  const rows = await tx
    .select({ memberId: membership.id, name: membership.displayName, status: membership.status })
    .from(membership)
    .where(and(ne(membership.status, 'pending'), holdsDoctor(tx)))
    .orderBy(asc(membership.displayName), asc(membership.id));
  return rows
    .map((r) => ({ memberId: r.memberId, name: r.name, active: r.status === 'active' }))
    .sort((a, b) => Number(b.active) - Number(a.active));
}

/** The active doctor members among `ids`. */
async function activeDoctors(tx: Tx, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await tx
    .select({ id: membership.id })
    .from(membership)
    .where(and(inArray(membership.id, [...ids]), eq(membership.status, 'active'), holdsDoctor(tx)));
  return new Set(rows.map((r) => r.id));
}

/** The member behind `userId` when they are an active doctor of the clinic, else null. */
export async function registeringDoctor(tx: Tx, userId: string): Promise<string | null> {
  const [row] = await tx
    .select({ id: membership.id })
    .from(membership)
    .where(and(eq(membership.userId, userId), eq(membership.status, 'active'), holdsDoctor(tx)));
  return row?.id ?? null;
}

/** A chart's treating doctors with their names, inactive ones marked. */
export async function treatingDoctorsOf(tx: Tx, chartId: string): Promise<TreatingDoctor[]> {
  const rows = await tx
    .select({
      memberId: membership.id,
      name: membership.displayName,
      status: membership.status,
      doctor: holdsDoctor(tx),
    })
    .from(patientTreatingDoctor)
    .innerJoin(membership, eq(membership.id, patientTreatingDoctor.memberId))
    .where(eq(patientTreatingDoctor.patientId, chartId))
    .orderBy(asc(membership.displayName), asc(membership.id));
  return rows.map((r) => ({
    memberId: r.memberId,
    name: r.name,
    active: r.status === 'active' && r.doctor === true,
  }));
}

/** The ids on a chart now. */
async function currentIds(tx: Tx, chartId: string): Promise<Set<string>> {
  const rows = await tx
    .select({ id: patientTreatingDoctor.memberId })
    .from(patientTreatingDoctor)
    .where(eq(patientTreatingDoctor.patientId, chartId));
  return new Set(rows.map((r) => r.id));
}

export interface DoctorChange {
  added: string[];
  removed: string[];
}

/**
 * Sets the chart's list to `ids` (deduplicated). A new id must be an active doctor member of the
 * clinic (400 `doctor_not_member`); an id already on the list stays whatever its state. Answers
 * what changed (empty lists: nothing).
 */
export async function setTreatingDoctors(
  tx: Tx,
  scope: { tenantId: string; userId: string },
  chartId: string,
  ids: readonly string[],
): Promise<DoctorChange> {
  const wanted = [...new Set(ids)];
  const now = await currentIds(tx, chartId);
  const added = wanted.filter((id) => !now.has(id));
  const removed = [...now].filter((id) => !wanted.includes(id));
  const doctors = await activeDoctors(tx, added);
  if (added.some((id) => !doctors.has(id))) throw new ApiError(400, 'doctor_not_member');
  if (removed.length > 0) {
    await tx
      .delete(patientTreatingDoctor)
      .where(
        and(
          eq(patientTreatingDoctor.patientId, chartId),
          inArray(patientTreatingDoctor.memberId, removed),
        ),
      );
  }
  if (added.length > 0) {
    await tx.insert(patientTreatingDoctor).values(
      added.map((memberId) => ({
        tenantId: scope.tenantId,
        patientId: chartId,
        memberId,
        addedBy: scope.userId,
      })),
    );
  }
  return { added: added.sort(), removed: removed.sort() };
}
