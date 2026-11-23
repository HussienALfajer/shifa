// The clinic's team (A-01b criteria 2–7, 12; OD-76, OD-78, OD-86). Every call runs in the scope
// the guard checked (TenantDb) and writes its audit rows in the same transaction. Work on the
// person (sessions, password) runs on the auth path inside that transaction: a failure there
// rolls back the change and its row here; the auth step commits with its own audit row.
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AddMemberRequest,
  type MemberAdded,
  type MemberDetail,
  type MemberLinkIssued,
  type MemberList,
  normalisePhone,
  type RoleScopeInput,
  type UpdateMemberRequest,
} from '@shifa/contracts';
import {
  type AuditEventName,
  auditEvent,
  branch,
  membership,
  permissionOverride,
  roleAssignment,
  setupLink,
  type Tx,
} from '@shifa/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  PERMISSION_CATALOGUE,
  PermissionCatalogue,
  PRODUCTION_GRANTS,
  type RequestScope,
  TenantDb,
} from '../../access/index.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { MemberAccounts } from '../identity/index.ts';
import { activeOwners, findMember, listMembers, memberDetail } from './members.read.ts';

type MembershipRow = typeof membership.$inferSelect;
type AuditData = Record<string, string | number | boolean | null>;

const lastOwner = () => new ApiError(409, 'last_owner');

@Injectable()
export class TeamService {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(MemberAccounts) private readonly accounts: MemberAccounts,
    @Inject(PERMISSION_CATALOGUE) private readonly catalogue: PermissionCatalogue,
  ) {}

  list(scope: RequestScope): Promise<MemberList> {
    return this.tenants.run(scope, async (tx) => ({ members: await listMembers(tx) }));
  }

  detail(scope: RequestScope, id: string): Promise<MemberDetail> {
    return this.tenants.run(scope, async (tx) => this.#detail(tx, await this.#member(tx, id)));
  }

  async add(scope: RequestScope, input: AddMemberRequest, requestId: string): Promise<MemberAdded> {
    const phone = normalisePhone(input.phone);
    if (!phone.ok)
      throw new RequestValidationError([{ path: 'body.phone', code: 'invalid_format' }]);
    // An account: an invitation to accept; none: a setup link. The owner sees the same (OD-76).
    const purpose = (await this.accounts.hasAccount(phone.e164)) ? 'invitation' : 'member_setup';
    const link = this.accounts.newLink();
    return this.tenants.run(scope, async (tx) => {
      const roles = await validRoles(tx, input.roles);
      const [taken] = await tx
        .select({ id: membership.id })
        .from(membership)
        .where(eq(membership.phoneE164, phone.e164));
      if (taken) throw new ApiError(409, 'phone_in_team');
      const [row] = await tx
        .insert(membership)
        .values({
          tenantId: scope.tenantId,
          phoneE164: phone.e164,
          displayName: input.name.trim(),
          status: 'pending',
        })
        .returning();
      if (!row) throw new Error('membership not written');
      await writeRoles(tx, scope.tenantId, row.id, roles);
      await tx.insert(setupLink).values({
        tenantId: scope.tenantId,
        membershipId: row.id,
        purpose,
        tokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
      });
      await audit(tx, scope, 'member.added', row.id, requestId);
      return { member: await this.#detail(tx, row), link: link.issued };
    });
  }

  update(
    scope: RequestScope,
    id: string,
    input: UpdateMemberRequest,
    requestId: string,
  ): Promise<MemberDetail> {
    return this.tenants.run(scope, async (tx) => {
      const row = await this.#member(tx, id);
      if (input.permissions) this.#checkSwitches(input.permissions.map((p) => p.key));
      if (input.roles) {
        const roles = await validRoles(tx, input.roles, { allowEmpty: true });
        const stillOwner = roles.some((r) => r.role === 'owner');
        if (!stillOwner && (await isLastOwner(tx, row))) throw lastOwner();
        await tx.delete(roleAssignment).where(eq(roleAssignment.membershipId, row.id));
        await writeRoles(tx, scope.tenantId, row.id, roles);
        await audit(tx, scope, 'member.roles_changed', row.id, requestId);
        // No role left: the member holds nothing here; their sessions here end (criterion 4).
        if (roles.length === 0) await this.#endSessions(row, scope, requestId);
      }
      for (const { key, granted } of input.permissions ?? []) {
        await tx
          .delete(permissionOverride)
          .where(and(eq(permissionOverride.membershipId, row.id), eq(permissionOverride.key, key)));
        if (granted !== null) {
          await tx
            .insert(permissionOverride)
            .values({ tenantId: scope.tenantId, membershipId: row.id, key, granted });
        }
        await audit(tx, scope, 'member.permissions_changed', row.id, requestId, { key, granted });
      }
      return this.#detail(tx, row);
    });
  }

  deactivate(scope: RequestScope, id: string, requestId: string): Promise<MemberDetail> {
    return this.tenants.run(scope, async (tx) => {
      const row = await this.#member(tx, id);
      if (row.status === 'deactivated') throw new ConflictException();
      if (await isLastOwner(tx, row)) throw lastOwner();
      const changed = await setStatus(tx, row.id, 'deactivated');
      await replaceLinks(tx, row.id);
      await audit(tx, scope, 'member.deactivated', row.id, requestId);
      await this.#endSessions(row, scope, requestId);
      return this.#detail(tx, changed);
    });
  }

  reactivate(scope: RequestScope, id: string, requestId: string): Promise<MemberDetail> {
    return this.tenants.run(scope, async (tx) => {
      const row = await this.#member(tx, id);
      if (row.status !== 'deactivated') throw new ConflictException();
      const changed = await setStatus(tx, row.id, row.userId ? 'active' : 'pending');
      await audit(tx, scope, 'member.reactivated', row.id, requestId);
      return this.#detail(tx, changed);
    });
  }

  /**
   * Staff recovery (criterion 3, OD-86): a pending member gets a new link (the earlier one
   * stops); a member with an account gets a link that resets the password, which ends every
   * session, but only when the account works in this clinic alone. A shared account: its
   * sessions here end and 409 `account_shared` (the super admin resets it).
   */
  async newLink(scope: RequestScope, id: string, requestId: string): Promise<MemberLinkIssued> {
    const row = await this.tenants.run(scope, (tx) => this.#member(tx, id));
    const by = { actorId: scope.userId, requestId };
    if (row.userId && (await this.accounts.isShared(row.userId, scope.tenantId))) {
      await this.accounts.endSessionsInClinic(row.userId, scope.tenantId, by);
      throw new ApiError(409, 'account_shared');
    }
    const purpose =
      row.userId || !(await this.accounts.hasAccount(row.phoneE164))
        ? 'member_setup'
        : 'invitation';
    const link = this.accounts.newLink();
    return this.tenants.run(scope, async (tx) => {
      await replaceLinks(tx, row.id);
      await tx.insert(setupLink).values({
        tenantId: scope.tenantId,
        membershipId: row.id,
        purpose,
        tokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
      });
      await audit(tx, scope, 'member.link_issued', row.id, requestId);
      if (row.userId) await this.accounts.resetPassword(row.userId, by);
      return link.issued;
    });
  }

  #checkSwitches(keys: string[]): void {
    keys.forEach((key, i) => {
      if (!this.catalogue.has(key)) {
        throw new RequestValidationError([
          { path: `body.permissions.${String(i)}.key`, code: 'invalid_value' },
        ]);
      }
      if (!this.catalogue.isSensitive(key)) throw new ApiError(400, 'permission_not_sensitive');
    });
  }

  async #member(tx: Tx, id: string): Promise<MembershipRow> {
    const row = await findMember(tx, id);
    if (!row) throw new NotFoundException();
    return row;
  }

  #detail(tx: Tx, row: MembershipRow): Promise<MemberDetail> {
    return memberDetail(tx, row, { catalogue: this.catalogue, grants: PRODUCTION_GRANTS });
  }

  async #endSessions(row: MembershipRow, scope: RequestScope, requestId: string): Promise<void> {
    if (!row.userId) return;
    await this.accounts.endSessionsInClinic(row.userId, scope.tenantId, {
      actorId: scope.userId,
      requestId,
    });
  }
}

/** The clinic's only active owner is this member. */
async function isLastOwner(tx: Tx, row: MembershipRow): Promise<boolean> {
  const owners = await activeOwners(tx);
  return owners.length === 1 && owners[0] === row.id;
}

/** Distinct assignments; owners tenant-wide; branches active and of this clinic → else 400. */
async function validRoles(
  tx: Tx,
  input: readonly RoleScopeInput[],
  { allowEmpty = false } = {},
): Promise<RoleScopeInput[]> {
  if (input.length === 0 && !allowEmpty) {
    throw new RequestValidationError([{ path: 'body.roles', code: 'too_small' }]);
  }
  const seen = new Map<string, RoleScopeInput>();
  for (const r of input) seen.set(`${r.role}:${r.branchId ?? ''}`, r);
  const roles = [...seen.values()];
  const ownerInBranch = roles.findIndex((r) => r.role === 'owner' && r.branchId !== null);
  if (ownerInBranch >= 0) {
    throw new RequestValidationError([{ path: 'body.roles', code: 'invalid_value' }]);
  }
  const branchIds = [...new Set(roles.flatMap((r) => (r.branchId ? [r.branchId] : [])))];
  if (branchIds.length > 0) {
    const found = await tx
      .select({ id: branch.id })
      .from(branch)
      .where(and(inArray(branch.id, branchIds), isNull(branch.archivedAt)));
    if (found.length !== branchIds.length) {
      throw new RequestValidationError([{ path: 'body.roles', code: 'invalid_value' }]);
    }
  }
  return roles;
}

async function writeRoles(
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

async function setStatus(
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
async function replaceLinks(tx: Tx, membershipId: string): Promise<void> {
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
async function audit(
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
