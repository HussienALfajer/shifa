// Branches (A-01b criteria 4, 9, 12; PLT-03, PLT-04). Every call runs in the scope the guard
// checked (TenantDb) and writes its audit row in the same transaction. Archiving locks the
// clinic's active branches, so two archives at once cannot leave none; members left without an
// active branch in their roles hold nothing here any more, and their sessions in this clinic end
// through identity (as deactivation does). Creating or restoring a branch stays within the
// clinic's branch limit (A-02 criterion 4, 409 `limit_reached`).
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ArchiveBranchPreview,
  type Branch,
  type BranchList,
  type CreateBranchRequest,
  normalisePhone,
  type UpdateBranchRequest,
} from '@shifa/contracts';
import {
  type AuditEventName,
  auditEvent,
  branch,
  membership,
  roleAssignment,
  type Tx,
} from '@shifa/db';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { ClinicLimits } from '../entitlements/index.ts';
import { MemberAccounts } from '../identity/index.ts';

type BranchRow = typeof branch.$inferSelect;

const archivedError = () => new ApiError(409, 'branch_archived');

@Injectable()
export class BranchesService {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(MemberAccounts) private readonly accounts: MemberAccounts,
    @Inject(ClinicLimits) private readonly limits: ClinicLimits,
  ) {}

  list(scope: RequestScope): Promise<BranchList> {
    return this.tenants.run(scope, async (tx) => {
      const rows = await tx.select().from(branch).orderBy(asc(branch.createdAt), asc(branch.id));
      const counts = await memberCounts(tx);
      const view = (row: BranchRow) => toBranch(row, counts.get(row.id) ?? 0);
      return {
        active: rows.filter((r) => r.archivedAt === null).map(view),
        archived: rows.filter((r) => r.archivedAt !== null).map(view),
      };
    });
  }

  create(scope: RequestScope, input: CreateBranchRequest, requestId: string): Promise<Branch> {
    const phone = phoneOf(input.phone);
    return this.tenants.run(scope, async (tx) => {
      // A-02 criterion 4: within the branch limit, under the clinic's limits lock.
      await this.limits.lock(tx);
      await this.limits.assertRoom(tx, scope.tenantId, 'limits.branches');
      const [row] = await tx
        .insert(branch)
        .values({
          tenantId: scope.tenantId,
          name: input.name.trim(),
          address: input.address?.trim() ?? null,
          phone: phone ?? null,
        })
        .returning();
      if (!row) throw new Error('branch not written');
      await audit(tx, scope, 'branch.created', row.id, requestId);
      return toBranch(row, 0);
    });
  }

  update(
    scope: RequestScope,
    id: string,
    input: UpdateBranchRequest,
    requestId: string,
  ): Promise<Branch> {
    const phone = phoneOf(input.phone);
    return this.tenants.run(scope, async (tx) => {
      const current = await find(tx, id, { lock: true });
      if (current.archivedAt) throw archivedError();
      // Nothing given: nothing changes and nothing is audited.
      const nothing = [input.name, input.address, input.phone].every((v) => v === undefined);
      if (nothing) return toBranch(current, (await memberCounts(tx)).get(current.id) ?? 0);
      const [row] = await tx
        .update(branch)
        .set({
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.address === undefined ? {} : { address: input.address?.trim() ?? null }),
          ...(phone === undefined ? {} : { phone }),
          updatedAt: new Date(),
        })
        .where(eq(branch.id, id))
        .returning();
      if (!row) throw new NotFoundException();
      await audit(tx, scope, 'branch.renamed', row.id, requestId, {
        name: input.name !== undefined,
        address: input.address !== undefined,
        phone: input.phone !== undefined,
      });
      return toBranch(row, (await memberCounts(tx)).get(row.id) ?? 0);
    });
  }

  preview(scope: RequestScope, id: string): Promise<ArchiveBranchPreview> {
    return this.tenants.run(scope, async (tx) => {
      const row = await find(tx, id);
      if (row.archivedAt) throw archivedError();
      const active = await activeBranchIds(tx, { lock: false });
      const members = await strandedBy(tx, id);
      return {
        lastBranch: active.length === 1 && active[0] === id,
        members: members.map((m) => ({ id: m.id, name: m.name })),
      };
    });
  }

  /**
   * OD-105: the branch returns to switchers and role pickers, which read `archived_at`; its role
   * assignments were never deleted, so they stand again. Sessions the archive ended stay ended.
   */
  restore(scope: RequestScope, id: string, requestId: string): Promise<Branch> {
    return this.tenants.run(scope, async (tx) => {
      // The limits lock before the branch's row lock (the order every add of the clinic takes).
      await this.limits.lock(tx);
      const current = await find(tx, id, { lock: true });
      if (!current.archivedAt) throw new ApiError(409, 'branch_not_archived');
      await this.limits.assertRoom(tx, scope.tenantId, 'limits.branches');
      const [row] = await tx
        .update(branch)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(branch.id, id))
        .returning();
      if (!row) throw new NotFoundException();
      await audit(tx, scope, 'branch.restored', row.id, requestId);
      return toBranch(row, (await memberCounts(tx)).get(row.id) ?? 0);
    });
  }

  async archive(scope: RequestScope, id: string, requestId: string): Promise<Branch> {
    const by = { actorId: scope.userId, requestId };
    return this.tenants.run(scope, async (tx) => {
      // Locks every active branch of the clinic: concurrent archives wait for this one.
      const active = await activeBranchIds(tx, { lock: true });
      const current = await find(tx, id);
      if (current.archivedAt) throw archivedError();
      if (active.length === 1 && active[0] === id) throw new ApiError(409, 'last_branch');
      const stranded = await strandedBy(tx, id);
      const [row] = await tx
        .update(branch)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(branch.id, id), isNull(branch.archivedAt)))
        .returning();
      if (!row) throw new ConflictException();
      await audit(tx, scope, 'branch.archived', row.id, requestId, {
        sessionsEnded: stranded.length,
      });
      // Each auth step commits on its own: a failure here rolls back the archive and its row,
      // but sessions already ended stay ended (fails safe; the owner can archive again).
      for (const member of stranded) {
        if (member.userId)
          await this.accounts.endSessionsInClinic(member.userId, scope.tenantId, by);
      }
      return toBranch(row, (await memberCounts(tx)).get(row.id) ?? 0);
    });
  }
}

/** `undefined`: not given; `null`: cleared; else E.164 (400 on body.phone when invalid). */
function phoneOf(input: string | null | undefined): string | null | undefined {
  if (input === undefined || input === null) return input;
  const phone = normalisePhone(input);
  if (!phone.ok) throw new RequestValidationError([{ path: 'body.phone', code: 'invalid_format' }]);
  return phone.e164;
}

async function find(tx: Tx, id: string, { lock = false } = {}): Promise<BranchRow> {
  const query = tx.select().from(branch).where(eq(branch.id, id));
  const [row] = lock ? await query.for('update') : await query;
  if (!row) throw new NotFoundException();
  return row;
}

async function activeBranchIds(tx: Tx, { lock }: { lock: boolean }): Promise<string[]> {
  const query = tx
    .select({ id: branch.id })
    .from(branch)
    .where(isNull(branch.archivedAt))
    .orderBy(asc(branch.id));
  const rows = lock ? await query.for('update') : await query;
  return rows.map((r) => r.id);
}

/** Active members with a role in `branchId`, no tenant-wide role and no other active branch. */
async function strandedBy(
  tx: Tx,
  branchId: string,
): Promise<{ id: string; name: string; userId: string | null }[]> {
  const { rows } = await tx.execute<{ id: string; name: string; user_id: string | null }>(sql`
    select m.id, m.display_name as name, m.user_id
      from membership m
     where m.status = 'active'
       and exists (select 1 from role_assignment ra
                    where ra.membership_id = m.id and ra.branch_id = ${branchId})
       and not exists (select 1 from role_assignment ra
                         left join branch b on b.tenant_id = ra.tenant_id and b.id = ra.branch_id
                        where ra.membership_id = m.id
                          and (ra.branch_id is null
                               or (ra.branch_id <> ${branchId} and b.archived_at is null)))
     order by m.display_name, m.id`);
  return rows.map((r) => ({ id: r.id, name: r.name, userId: r.user_id }));
}

/** Active members per branch, by their branch-scoped roles. */
async function memberCounts(tx: Tx): Promise<Map<string, number>> {
  const rows = await tx
    .select({
      branchId: roleAssignment.branchId,
      count: sql<number>`count(distinct ${membership.id})::int`,
    })
    .from(roleAssignment)
    .innerJoin(
      membership,
      and(
        eq(membership.tenantId, roleAssignment.tenantId),
        eq(membership.id, roleAssignment.membershipId),
      ),
    )
    .where(and(isNotNull(roleAssignment.branchId), eq(membership.status, 'active')))
    .groupBy(roleAssignment.branchId);
  return new Map(rows.flatMap((r) => (r.branchId ? [[r.branchId, r.count] as const] : [])));
}

function toBranch(row: BranchRow, memberCount: number): Branch {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    memberCount,
  };
}

/** One row in the clinic: actor, branch, request; `data` only booleans and counts. */
async function audit(
  tx: Tx,
  scope: RequestScope,
  event: AuditEventName,
  targetId: string,
  requestId: string,
  data: Record<string, boolean | number> = {},
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
