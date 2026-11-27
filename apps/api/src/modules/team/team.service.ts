// The clinic's team (A-01b criteria 2–7, 12; OD-76, OD-78, OD-86). Every call runs in the scope
// the guard checked (TenantDb) and writes its audit rows in the same transaction. A doctor role
// added (new member, edit, reactivation) stays within the doctor limit (A-02 criterion 4). Work on the
// person (sessions, password) runs on the auth path inside that transaction: a failure there
// rolls back the change and its row here; the auth step commits with its own audit row.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AddMemberRequest,
  type MemberAdded,
  type MemberDetail,
  type MemberLinkIssued,
  type MemberList,
  normalisePhone,
  type PermissionDefaults,
  type RoleScopeInput,
  type SessionRole,
  type UpdateMemberRequest,
} from '@shifa/contracts';
import { membership, permissionOverride, roleAssignment, setupLink, type Tx } from '@shifa/db';
import { and, eq } from 'drizzle-orm';
import {
  PERMISSION_CATALOGUE,
  PermissionCatalogue,
  PRODUCTION_GRANTS,
  type RequestScope,
  TenantDb,
} from '../../access/index.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { ClinicLimits } from '../entitlements/index.ts';
import { MemberAccounts, type NewMemberLink } from '../identity/index.ts';
import { rename } from './member-corrections.ts';
import { findMember, holdsOwnerRole, listMembers, memberDetail } from './members.read.ts';
import {
  audit,
  heldRoles,
  isLastOwner,
  lockMemberPhone,
  lockOwners,
  type MembershipRow,
  replaceLinks,
  setStatus,
  validRoles,
  writeRoles,
} from './team.writes.ts';

const lastOwner = () => new ApiError(409, 'last_owner');
const ROLES: readonly SessionRole[] = [
  'owner',
  'doctor',
  'assistant',
  'receptionist',
  'accountant',
];

/** Deactivate, a new link and TOTP reset on oneself would lock the owner out (A-01-12). */
function refuseSelf(scope: RequestScope, row: MembershipRow): void {
  if (row.userId !== null && row.userId === scope.userId) throw new ApiError(409, 'self_action');
}

@Injectable()
export class TeamService {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(MemberAccounts) private readonly accounts: MemberAccounts,
    @Inject(PERMISSION_CATALOGUE) private readonly catalogue: PermissionCatalogue,
    @Inject(ClinicLimits) private readonly limits: ClinicLimits,
  ) {}

  list(scope: RequestScope): Promise<MemberList> {
    return this.tenants.run(scope, async (tx) => ({ members: await listMembers(tx, scope) }));
  }

  /** Every sensitive key with the roles that grant it by default (OD-102). */
  permissionDefaults(): PermissionDefaults {
    return {
      keys: this.catalogue.sensitiveKeys().map((key) => ({
        key,
        roles: ROLES.filter((role) => PRODUCTION_GRANTS[role].includes(key)),
      })),
    };
  }

  detail(scope: RequestScope, id: string): Promise<MemberDetail> {
    return this.tenants.run(scope, async (tx) =>
      this.#detail(tx, scope, await this.#member(tx, id)),
    );
  }

  async add(scope: RequestScope, input: AddMemberRequest, requestId: string): Promise<MemberAdded> {
    const phone = normalisePhone(input.phone);
    if (!phone.ok)
      throw new RequestValidationError([{ path: 'body.phone', code: 'invalid_format' }]);
    // Before any write: a refused switch refuses the whole add (OD-102).
    const switches = new Map((input.permissions ?? []).map((p) => [p.key, p.granted]));
    this.#checkSwitches((input.permissions ?? []).map((p) => p.key));
    // An account: an invitation to accept; none: a setup link. The owner sees the same (OD-76).
    const purpose = (await this.accounts.hasAccount(phone.e164)) ? 'invitation' : 'member_setup';
    const link = this.accounts.newLink();
    return this.tenants.run(scope, async (tx) => {
      // A-02 criterion 4: a new doctor within the doctor limit, under the clinic's limits lock.
      const doctor = input.roles.some((r) => r.role === 'doctor');
      if (doctor) await this.limits.lock(tx);
      const { roles } = await validRoles(tx, input.roles);
      if (doctor) await this.limits.assertRoom(tx, scope.tenantId, 'limits.practitioners');
      // Two adds of one phone at once: the second waits, then sees the first (409, never 500).
      await lockMemberPhone(tx, phone.e164);
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
        // An invitation also shows in that person's clinic chooser (OD-90).
        invitedPhone: purpose === 'invitation' ? phone.e164 : null,
      });
      await audit(tx, scope, 'member.added', row.id, requestId);
      await this.#writeSwitches(tx, scope, row.id, roles, switches, requestId);
      return { member: await this.#detail(tx, scope, row), link: link.issued };
    });
  }

  update(
    scope: RequestScope,
    id: string,
    input: UpdateMemberRequest,
    requestId: string,
  ): Promise<MemberDetail> {
    return this.tenants.run(scope, async (tx) => {
      // The owners' lock before any row lock, as deactivate takes them (security review N3).
      if (input.roles) await lockOwners(tx);
      const gainsDoctor = input.roles?.some((r) => r.role === 'doctor') === true;
      if (gainsDoctor) await this.limits.lock(tx);
      let row = await this.#member(tx, id);
      if (input.permissions) this.#checkSwitches(input.permissions.map((p) => p.key));
      if (input.name !== undefined) row = await rename(tx, scope, row, input.name, requestId);
      if (input.roles) {
        const held = await heldRoles(tx, row.id);
        const { roles, live } = await validRoles(tx, input.roles, { allowEmpty: true, held });
        // A doctor role added to a counted member (not deactivated, not a doctor yet).
        const counted = row.status !== 'deactivated' && !held.some((r) => r.role === 'doctor');
        if (gainsDoctor && counted) {
          await this.limits.assertRoom(tx, scope.tenantId, 'limits.practitioners');
        }
        const stillOwner = roles.some((r) => r.role === 'owner');
        if (!stillOwner && (await isLastOwner(tx, row))) throw lastOwner();
        // OD-97: only the owner themselves (or the super admin) removes an owner's role, so a
        // co-owner cannot demote, reset and take over another owner's account (security M1).
        if (!stillOwner && row.userId !== scope.userId && (await holdsOwnerRole(tx, row.id))) {
          throw new ApiError(409, 'owner_role_protected');
        }
        await tx.delete(roleAssignment).where(eq(roleAssignment.membershipId, row.id));
        await writeRoles(tx, scope.tenantId, row.id, roles);
        await audit(tx, scope, 'member.roles_changed', row.id, requestId);
        // No role left, or only roles in archived branches: the member can work nowhere here;
        // their sessions here end (criterion 4), as archiving would have (security review N1).
        if (!live) await this.#endSessions(row, scope, requestId);
      }
      for (const { key, granted } of input.permissions ?? []) {
        if (granted === null) {
          await tx
            .delete(permissionOverride)
            .where(
              and(eq(permissionOverride.membershipId, row.id), eq(permissionOverride.key, key)),
            );
        } else {
          // Upsert: two switches of the same key at once never collide on the unique key.
          await tx
            .insert(permissionOverride)
            .values({ tenantId: scope.tenantId, membershipId: row.id, key, granted })
            .onConflictDoUpdate({
              target: [
                permissionOverride.tenantId,
                permissionOverride.membershipId,
                permissionOverride.key,
              ],
              set: { granted, updatedAt: new Date() },
            });
        }
        await audit(tx, scope, 'member.permissions_changed', row.id, requestId, { key, granted });
      }
      return this.#detail(tx, scope, row);
    });
  }

  deactivate(scope: RequestScope, id: string, requestId: string): Promise<MemberDetail> {
    return this.tenants.run(scope, async (tx) => {
      await lockOwners(tx);
      const row = await this.#member(tx, id);
      refuseSelf(scope, row);
      if (row.status === 'deactivated') throw new ApiError(409, 'member_deactivated');
      if (await isLastOwner(tx, row)) throw lastOwner();
      // Links, then the membership: the order of a link's use and of the phone edit, so two of
      // them at once wait instead of deadlocking (security review L1).
      await replaceLinks(tx, row.id);
      const changed = await setStatus(tx, row.id, 'deactivated');
      await audit(tx, scope, 'member.deactivated', row.id, requestId);
      await this.#endSessions(row, scope, requestId);
      return this.#detail(tx, scope, changed);
    });
  }

  reactivate(scope: RequestScope, id: string, requestId: string): Promise<MemberDetail> {
    return this.tenants.run(scope, async (tx) => {
      await this.limits.lock(tx);
      const row = await this.#member(tx, id);
      if (row.status !== 'deactivated') throw new ApiError(409, 'member_not_deactivated');
      // A reactivated doctor counts again (A-02 criterion 4).
      if ((await heldRoles(tx, row.id)).some((r) => r.role === 'doctor')) {
        await this.limits.assertRoom(tx, scope.tenantId, 'limits.practitioners');
      }
      const changed = await setStatus(tx, row.id, row.userId ? 'active' : 'pending');
      await audit(tx, scope, 'member.reactivated', row.id, requestId);
      return this.#detail(tx, scope, changed);
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
    refuseSelf(scope, row);
    // A deactivated member's link could never be used (the database binds pending members
    // only): reactivate first.
    if (row.status === 'deactivated') throw new ApiError(409, 'member_deactivated');
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
    try {
      return await this.#issueLink(scope, row, purpose, link, requestId);
    } catch (err) {
      // Shared since the check above (a race): the same answer and effect (security review N4).
      if (row.userId && err instanceof ApiError && err.code === 'account_shared') {
        await this.accounts.endSessionsInClinic(row.userId, scope.tenantId, by);
      }
      throw err;
    }
  }

  /**
   * Staff TOTP reset (criterion 3, OD-95): never an owner's (the super admin resets it, A-01a
   * criterion 13: `owner_mfa_platform`, the caller's own included); a member without an account
   * or TOTP → `mfa_not_enrolled`; a shared account → its sessions here end, then
   * `account_shared` (OD-86). Else TOTP gone, every session of the member ended, audited here
   * (`member.mfa_reset`) and on the auth path (`auth.mfa_reset`).
   */
  async resetMfa(scope: RequestScope, id: string, requestId: string): Promise<MemberDetail> {
    const row = await this.tenants.run(scope, async (tx) => {
      const found = await this.#member(tx, id);
      refuseSelf(scope, found);
      if (await holdsOwnerRole(tx, found.id)) throw new ApiError(409, 'owner_mfa_platform');
      return found;
    });
    const userId = row.userId;
    if (!userId || !(await this.accounts.mfaEnrolled(userId))) {
      throw new ApiError(409, 'mfa_not_enrolled');
    }
    const by = { actorId: scope.userId, requestId };
    if (await this.accounts.isShared(userId, scope.tenantId)) {
      await this.accounts.endSessionsInClinic(userId, scope.tenantId, by);
      throw new ApiError(409, 'account_shared');
    }
    try {
      return await this.tenants.run(scope, async (tx) => {
        // Under the owners' lock: a promotion since the first read is seen (security review M1).
        await lockOwners(tx);
        if (await holdsOwnerRole(tx, row.id)) throw new ApiError(409, 'owner_mfa_platform');
        await this.accounts.resetMfa(userId, scope.tenantId, by);
        // After the auth step committed (with `auth.mfa_reset`): only this commit can still fail,
        // leaving the reset without its clinic row (accepted, as for links; review L3).
        await audit(tx, scope, 'member.mfa_reset', row.id, requestId);
        return this.#detail(tx, scope, row);
      });
    } catch (err) {
      // Shared since the check above (a race): the same answer and effect (security review N4).
      if (err instanceof ApiError && err.code === 'account_shared') {
        await this.accounts.endSessionsInClinic(userId, scope.tenantId, by);
      }
      throw err;
    }
  }

  #issueLink(
    scope: RequestScope,
    row: MembershipRow,
    purpose: 'member_setup' | 'invitation',
    link: NewMemberLink,
    requestId: string,
  ): Promise<MemberLinkIssued> {
    const by = { actorId: scope.userId, requestId };
    return this.tenants.run(scope, async (tx) => {
      await replaceLinks(tx, row.id);
      await tx.insert(setupLink).values({
        tenantId: scope.tenantId,
        membershipId: row.id,
        purpose,
        tokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
        invitedPhone: purpose === 'invitation' ? row.phoneE164 : null,
      });
      await audit(tx, scope, 'member.link_issued', row.id, requestId);
      if (row.userId) await this.accounts.resetPassword(row.userId, scope.tenantId, by);
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

  /**
   * Toggles set on add (OD-102): only a switch that differs from the default of `roles` is
   * stored, each audited as on edit.
   */
  async #writeSwitches(
    tx: Tx,
    scope: RequestScope,
    membershipId: string,
    roles: readonly RoleScopeInput[],
    switches: ReadonlyMap<string, boolean>,
    requestId: string,
  ): Promise<void> {
    for (const [key, granted] of switches) {
      const roleDefault = roles.some((r) =>
        PRODUCTION_GRANTS[r.role].some((granting) => granting === key),
      );
      if (granted === roleDefault) continue;
      await tx
        .insert(permissionOverride)
        .values({ tenantId: scope.tenantId, membershipId, key, granted });
      await audit(tx, scope, 'member.permissions_changed', membershipId, requestId, {
        key,
        granted,
      });
    }
  }

  #detail(tx: Tx, scope: RequestScope, row: MembershipRow): Promise<MemberDetail> {
    return memberDetail(tx, row, {
      viewer: scope,
      catalogue: this.catalogue,
      grants: PRODUCTION_GRANTS,
      mfaEnrolled: (userId) => this.accounts.mfaEnrolled(userId),
    });
  }

  async #endSessions(row: MembershipRow, scope: RequestScope, requestId: string): Promise<void> {
    if (!row.userId) return;
    await this.accounts.endSessionsInClinic(row.userId, scope.tenantId, {
      actorId: scope.userId,
      requestId,
    });
  }
}
