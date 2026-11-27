// The super-admin clinic work (A-01a criteria 2, 3, 13): every call is one withPlatformAdmin()
// transaction on the shifa_platform pool with its audit row (lists and views too: support
// access is sensitive). Super admins see a clinic's own fields and its owner card (name,
// status), never clinic data: the platform role holds no SELECT on clinic tables beyond owner
// memberships and roles. Owner actions on the person (sessions, MFA, password) run on the auth
// path inside the platform transaction: a failure there leaves no platform row and no new link;
// the auth step commits with its own audit row, so it stays recorded even if the platform
// commit fails afterwards (two pools, no shared transaction). A-01-11: the owner card's masked
// phone and open link's expiry, the owner's status in the list, 409 for no-op owner actions, and
// a pending owner's phone corrected (OD-99).
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ClinicCreated,
  type ClinicDetail,
  type ClinicList,
  type CreateClinicRequest,
  maskPhone,
  matchesWordStart,
  normalisePhone,
  type OwnerPhoneRequest,
  type SetupLinkIssued,
  type UpdateClinicRequest,
} from '@shifa/contracts';
import {
  type AuditTarget,
  changeOwnerPhone,
  createClinic,
  issueOwnerLink,
  membership,
  ownerLinkExpiry,
  type PlatformAction,
  type PlatformDb,
  type PlatformTx,
  type TenantType,
  tenant,
} from '@shifa/db';
import { and, desc, eq, ne } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { EntitlementsAdmin } from '../entitlements/index.ts';
import { OwnerAccounts } from '../identity/index.ts';
import { clinicActivity } from '../usage/index.ts';
import { PLATFORM_DB } from './tokens.ts';

export type OwnerAction = 'setup-link' | 'reset-mfa' | 'end-sessions';

const OWNER_EVENTS = {
  'setup-link': 'owner.link_issued',
  'reset-mfa': 'owner.mfa_reset',
  'end-sessions': 'owner.sessions_ended',
} as const;

@Injectable()
export class ClinicsService {
  constructor(
    @Inject(PLATFORM_DB) private readonly platformDb: PlatformDb,
    @Inject(OwnerAccounts) private readonly owners: OwnerAccounts,
    @Inject(EntitlementsAdmin) private readonly entitlements: EntitlementsAdmin,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  list(principal: Principal, search: string | undefined, requestId: string): Promise<ClinicList> {
    return this.#run(principal, { event: 'clinic.listed', requestId }, async (tx) => {
      const all = await tx
        .select({
          id: tenant.id,
          name: tenant.name,
          type: tenant.type,
          status: tenant.status,
          subscriptionEnd: tenant.subscriptionEnd,
          createdAt: tenant.createdAt,
        })
        .from(tenant)
        .orderBy(desc(tenant.createdAt));
      // A folded name at the start of a word, with Combobox's own rule (A-02-03 contract fix):
      // «احمد» finds «أحمد», «الطبيه» finds «الطبية», a match inside a word does not count.
      const found = search ? all.filter((r) => matchesWordStart(r.name, search)) : all;
      // shifa_platform sees owner memberships only; a clinic can hold several (co-owners the
      // owner invited): one card per clinic, the same one the detail shows.
      const owners = await ownerRows(tx);
      // A-02-07: last activity and sign-ins of the last seven days (criterion 21).
      const activity = await clinicActivity(tx, this.clock.now());
      return {
        clinics: found.map((r) => {
          const owner = ownerOf(owners.filter((o) => o.tenantId === r.id));
          return {
            ...r,
            ownerName: owner?.name ?? null,
            ownerStatus: owner?.status ?? null,
            createdAt: r.createdAt.toISOString(),
            ...activity.of(r.id),
          };
        }),
      };
    });
  }

  detail(principal: Principal, id: string, requestId: string): Promise<ClinicDetail> {
    return this.#run(principal, { event: 'clinic.viewed', requestId, targetId: id }, (tx) =>
      clinicDetail(tx, id),
    );
  }

  async create(
    principal: Principal,
    input: CreateClinicRequest,
    requestId: string,
  ): Promise<ClinicCreated> {
    const phone = normalisePhone(input.ownerPhone);
    if (!phone.ok) {
      throw new RequestValidationError([{ path: 'body.ownerPhone', code: 'invalid_format' }]);
    }
    // Same owner phone as an existing account: an invitation (accepted in A-01-04), never a
    // second account.
    const purpose = (await this.owners.userIdByPhone(phone.e164)) ? 'invitation' : 'owner_setup';
    const link = this.owners.newSetupLink();
    const action = { event: 'clinic.created', requestId, data: { linkPurpose: purpose } } as const;
    return this.#run(principal, action, async (tx) => {
      // OD-85: the phone owns another clinic whose owner has not set up yet: two owner links
      // for one phone would leave the second one used dead. Refused until the first is set up.
      const [pending] = await tx
        .select({ id: membership.id })
        .from(membership)
        .where(and(eq(membership.phoneE164, phone.e164), eq(membership.status, 'pending')))
        .limit(1);
      if (pending) throw new ApiError(409, 'owner_setup_pending');
      const created = await createClinic(tx, {
        name: input.name.trim(),
        type: input.type,
        status: input.status,
        subscriptionEnd: input.subscriptionEnd ?? null,
        owner: {
          displayName: input.ownerName.trim(),
          phoneE164: phone.e164,
          link: { purpose, tokenHash: link.tokenHash, expiresAt: link.expiresAt },
        },
      });
      return { clinic: await clinicDetail(tx, created.tenantId), ownerLink: link.issued(purpose) };
    });
  }

  /**
   * Status, end date and (A-02-02) type. A new type moves the clinic to that plan at once in one
   * `clinic.type_changed` action (before and after in the audit row, a history event per limit
   * whose plan value moved; overrides stay). The same type again is no type change: the call
   * rolls back and runs as a status change, so no type_changed row is left.
   */
  async update(
    principal: Principal,
    id: string,
    input: UpdateClinicRequest,
    requestId: string,
  ): Promise<ClinicDetail> {
    const data: Record<string, string> = {};
    if (input.status) data['status'] = input.status;
    if (input.subscriptionEnd !== undefined) {
      data['endDate'] = input.subscriptionEnd === null ? 'cleared' : 'set';
    }
    const { type } = input;
    if (type) {
      const action = { event: 'clinic.type_changed', requestId, targetId: id, data } as const;
      try {
        const detail = await this.#run(principal, action, async (tx, audit) => {
          const [current] = await tx
            .select({ type: tenant.type })
            .from(tenant)
            .where(eq(tenant.id, id))
            .for('update');
          if (!current) throw new NotFoundException();
          if (current.type === type) throw new SameType();
          audit.setData({ before: current.type, after: type });
          await updateClinic(tx, id, input, type);
          await this.entitlements.recordTypeChange(tx, id, current.type, type, principal.userId);
          return clinicDetail(tx, id);
        });
        this.entitlements.invalidate(id);
        return detail;
      } catch (err) {
        if (!(err instanceof SameType)) throw err;
      }
    }
    const action = { event: 'clinic.status_changed', requestId, targetId: id, data } as const;
    return this.#run(principal, action, async (tx) => {
      await updateClinic(tx, id, input);
      return clinicDetail(tx, id);
    });
  }

  /** New setup link, MFA reset or sessions ended for the clinic's owner; each ends sessions. */
  ownerAction(
    principal: Principal,
    id: string,
    kind: OwnerAction,
    requestId: string,
  ): Promise<SetupLinkIssued | undefined> {
    // The clinic in `data`: the target is the person, who may own several (security review L5).
    const action = { event: OWNER_EVENTS[kind], requestId, data: { clinicId: id } } as const;
    const by = { actorId: principal.userId, requestId };
    return this.#run(principal, action, async (tx, audit) => {
      const owner = ownerOf(await ownerRows(tx, id));
      if (!owner) throw new NotFoundException();
      audit.setTarget(owner.userId ?? owner.id);
      if (kind === 'setup-link') {
        const purpose =
          owner.userId || !(await this.owners.userIdByPhone(owner.phone))
            ? 'owner_setup'
            : 'invitation';
        const link = this.owners.newSetupLink();
        await issueOwnerLink(tx, {
          tenantId: id,
          membershipId: owner.id,
          purpose,
          tokenHash: link.tokenHash,
          expiresAt: link.expiresAt,
        });
        if (owner.userId) await this.owners.resetPassword(owner.userId, by);
        return link.issued(purpose);
      }
      // An owner without an account has no sessions or TOTP: answering a success would be a lie
      // (A-01-11 gap 6). The throw rolls back, so no owner.* audit row is written.
      if (!owner.userId) throw new ApiError(409, 'owner_setup_pending');
      if (kind === 'reset-mfa') await this.owners.resetMfa(owner.userId, by);
      else await this.owners.endSessions(owner.userId, by);
      return undefined;
    });
  }

  /**
   * OD-99: corrects a pending owner's phone and re-issues the owner's link (the earlier one stops
   * working); an invitation when the new phone has an account. 409 `owner_account_exists` once
   * the owner has an account; 409 `owner_setup_pending` when the new phone owns another clinic
   * not set up (OD-85). The phone never enters the audit row, logs or errors.
   */
  async changeOwnerPhone(
    principal: Principal,
    id: string,
    input: OwnerPhoneRequest,
    requestId: string,
  ): Promise<SetupLinkIssued> {
    const phone = normalisePhone(input.phone);
    if (!phone.ok) {
      throw new RequestValidationError([{ path: 'body.phone', code: 'invalid_format' }]);
    }
    const purpose = (await this.owners.userIdByPhone(phone.e164)) ? 'invitation' : 'owner_setup';
    const link = this.owners.newSetupLink();
    const action = {
      event: 'owner.phone_changed',
      requestId,
      data: { clinicId: id, linkPurpose: purpose },
    } as const;
    return this.#run(principal, action, async (tx, audit) => {
      // Every owner membership: the edit is for a clinic whose only owner has no account yet. A
      // pending co-owner the set-up owner invited is never "the owner" (security review M1).
      const all = await ownerRows(tx, id);
      const owner = ownerOf(all);
      if (!owner) throw new NotFoundException();
      audit.setTarget(owner.id);
      if (owner.userId || all.length > 1) throw new ApiError(409, 'owner_account_exists');
      const [pending] = await tx
        .select({ id: membership.id })
        .from(membership)
        .where(
          and(
            eq(membership.phoneE164, phone.e164),
            eq(membership.status, 'pending'),
            ne(membership.id, owner.id),
          ),
        )
        .limit(1);
      if (pending) throw new ApiError(409, 'owner_setup_pending');
      // False only when the owner bound an account since the read above: the update re-checks
      // the row against the policies.
      const changed = await changeOwnerPhone(tx, {
        tenantId: id,
        membershipId: owner.id,
        phoneE164: phone.e164,
      });
      if (!changed) throw new ApiError(409, 'owner_account_exists');
      await issueOwnerLink(tx, {
        tenantId: id,
        membershipId: owner.id,
        purpose,
        tokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
      });
      return link.issued(purpose);
    });
  }

  #run<T>(
    principal: Principal,
    action: Omit<PlatformAction, 'actorId'>,
    fn: (tx: PlatformTx, audit: AuditTarget) => Promise<T>,
  ): Promise<T> {
    return this.platformDb.withPlatformAdmin({ ...action, actorId: principal.userId }, fn);
  }
}

/** A type change to the clinic's own type: rolled back and run as a status change. */
class SameType extends Error {}

/** Writes status, end date and type as given; 404 when there is no such clinic. */
async function updateClinic(
  tx: PlatformTx,
  id: string,
  input: UpdateClinicRequest,
  type?: TenantType,
): Promise<void> {
  const changed = await tx
    .update(tenant)
    .set({
      ...(type ? { type } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.subscriptionEnd !== undefined ? { subscriptionEnd: input.subscriptionEnd } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tenant.id, id))
    .returning({ id: tenant.id });
  if (changed.length === 0) throw new NotFoundException();
}

/** Owner memberships (all shifa_platform can see), of one clinic or of every clinic. */
function ownerRows(tx: PlatformTx, tenantId?: string) {
  return tx
    .select({
      id: membership.id,
      tenantId: membership.tenantId,
      userId: membership.userId,
      name: membership.displayName,
      status: membership.status,
      phone: membership.phoneE164,
    })
    .from(membership)
    .where(tenantId ? eq(membership.tenantId, tenantId) : undefined);
}

/**
 * The clinic's owner for its card and the support actions. A clinic can also hold co-owners the
 * owner invited (pending until they accept): the owner with an account comes first, then the
 * lowest id, so every call names the same person (security review M1).
 */
function ownerOf<T extends { id: string; userId: string | null }>(rows: T[]): T | undefined {
  return [...rows].sort(
    (a, b) => Number(a.userId === null) - Number(b.userId === null) || a.id.localeCompare(b.id),
  )[0];
}

/** The clinic's own fields and its owner card; 404 when there is no such clinic. */
async function clinicDetail(tx: PlatformTx, id: string): Promise<ClinicDetail> {
  const [clinic] = await tx.select().from(tenant).where(eq(tenant.id, id));
  if (!clinic) throw new NotFoundException();
  const owner = ownerOf(await ownerRows(tx, id));
  const linkExpiresAt = owner
    ? await ownerLinkExpiry(tx, { tenantId: id, membershipId: owner.id })
    : null;
  return {
    id: clinic.id,
    name: clinic.name,
    type: clinic.type,
    status: clinic.status,
    subscriptionEnd: clinic.subscriptionEnd,
    ownerName: owner?.name ?? null,
    ownerStatus: owner?.status ?? null,
    createdAt: clinic.createdAt.toISOString(),
    owner: owner
      ? {
          membershipId: owner.id,
          name: owner.name,
          status: owner.status,
          // Masked here: the full phone never leaves the platform path (A-01-11).
          phoneMasked: maskPhone(owner.phone),
          linkExpiresAt: linkExpiresAt?.toISOString() ?? null,
        }
      : null,
  };
}
