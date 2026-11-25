// Writes shared by the team's service and its corrections (A-01b criteria 2–7, 12): plain
// functions on a `tx` from TenantDb (the clinic's RLS applies). Audit rows carry ids and enum
// words only, never a name or a phone.
import { NotFoundException } from '@nestjs/common';
import type { RoleScopeInput } from '@shifa/contracts';
import {
  type AuditEventName,
  auditEvent,
  branch,
  membership,
  roleAssignment,
  setupLink,
  type Tx,
} from '@shifa/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { RequestScope } from '../../access/index.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { activeOwners } from './members.read.ts';

export type MembershipRow = typeof membership.$inferSelect;
export type AuditData = Record<string, string | number | boolean | null>;

/**
 * Serialises the clinic's owner changes (review 1): two owners demoting or deactivating each
 * other at once would both see two owners under READ COMMITTED. Transaction-scoped, so safe
 * behind PgBouncer.
 */
export async function lockOwners(tx: Tx): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('shifa.owners:' || current_tenant_id()::text, 0))`,
  );
}

/** Two writes of one phone in a clinic at once: the second waits, then sees the first (409). */
export async function lockMemberPhone(tx: Tx, phoneE164: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('shifa.member-phone:' || current_tenant_id()::text || ${phoneE164}, 0))`,
  );
}

/** The clinic's only active owner is this member. */
export async function isLastOwner(tx: Tx, row: MembershipRow): Promise<boolean> {
  const owners = await activeOwners(tx);
  return owners.length === 1 && owners[0] === row.id;
}

const roleKey = (r: RoleScopeInput) => `${r.role}:${r.branchId ?? ''}`;

/** The member's current assignments (read before an edit replaces them). */
export async function heldRoles(tx: Tx, membershipId: string): Promise<RoleScopeInput[]> {
  return tx
    .select({ role: roleAssignment.role, branchId: roleAssignment.branchId })
    .from(roleAssignment)
    .where(eq(roleAssignment.membershipId, membershipId));
}

/**
 * Distinct assignments; owners tenant-wide; branches of this clinic (else 400) and active (else
 * 409 `branch_archived`). An assignment in an archived branch that is in `held` (the member's
 * own, kept for a restore, OD-105) passes, so an edit can send it back (OD-107); a new one, even
 * another role in the same archived branch, is refused.
 */
export async function validRoles(
  tx: Tx,
  input: readonly RoleScopeInput[],
  { allowEmpty = false, held = [] as readonly RoleScopeInput[] } = {},
): Promise<RoleScopeInput[]> {
  if (input.length === 0 && !allowEmpty) {
    throw new RequestValidationError([{ path: 'body.roles', code: 'too_small' }]);
  }
  const seen = new Map<string, RoleScopeInput>();
  for (const r of input) seen.set(roleKey(r), r);
  const roles = [...seen.values()];
  const ownerInBranch = roles.findIndex((r) => r.role === 'owner' && r.branchId !== null);
  if (ownerInBranch >= 0) {
    throw new RequestValidationError([{ path: 'body.roles', code: 'invalid_value' }]);
  }
  const branchIds = [...new Set(roles.flatMap((r) => (r.branchId ? [r.branchId] : [])))];
  if (branchIds.length > 0) {
    const found = await tx
      .select({ id: branch.id, archivedAt: branch.archivedAt })
      .from(branch)
      .where(inArray(branch.id, branchIds))
      // An archive at the same time waits for this write (it locks the branch for update), so
      // it never lands between the check and the new assignment.
      .for('share');
    if (found.length !== branchIds.length) {
      throw new RequestValidationError([{ path: 'body.roles', code: 'invalid_value' }]);
    }
    // An archived branch leaves the role picker (A-01b criterion 9); a held one stays (OD-107).
    const archived = new Set(found.filter((b) => b.archivedAt !== null).map((b) => b.id));
    const kept = new Set(held.map(roleKey));
    const fresh = roles.some(
      (r) => r.branchId && archived.has(r.branchId) && !kept.has(roleKey(r)),
    );
    if (fresh) throw new ApiError(409, 'branch_archived');
  }
  return roles;
}

export async function writeRoles(
  tx: Tx,
  tenantId: string,
  membershipId: string,
  roles: readonly RoleScopeInput[],
): Promise<void> {
  if (roles.length === 0) return;
  await tx
    .insert(roleAssignment)
    .values(roles.map((r) => ({ tenantId, membershipId, role: r.role, branchId: r.branchId })));
}

export async function setStatus(
  tx: Tx,
  id: string,
  status: MembershipRow['status'],
): Promise<MembershipRow> {
  const [row] = await tx
    .update(membership)
    .set({ status, updatedAt: new Date() })
    .where(eq(membership.id, id))
    .returning();
  if (!row) throw new NotFoundException();
  return row;
}

/** The member's unused links stop working. */
export async function replaceLinks(tx: Tx, membershipId: string): Promise<void> {
  await tx
    .update(setupLink)
    .set({ replacedAt: new Date() })
    .where(
      and(
        eq(setupLink.membershipId, membershipId),
        isNull(setupLink.usedAt),
        isNull(setupLink.replacedAt),
      ),
    );
}

/** One row in the clinic: actor, member, request; `data` only ids and enum words, never a phone. */
export async function audit(
  tx: Tx,
  scope: RequestScope,
  event: AuditEventName,
  targetId: string,
  requestId: string,
  data: AuditData = {},
): Promise<void> {
  await tx.insert(auditEvent).values({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    targetId,
    event,
    requestId,
    data,
  });
}
