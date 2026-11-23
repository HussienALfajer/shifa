// The super-admin clinic work (A-01a criteria 2, 3, 13): every call is one withPlatformAdmin()
// transaction on the shifa_platform pool with its audit row (lists and views too: support
// access is sensitive). Super admins see a clinic's own fields and its owner card (name,
// status), never clinic data: the platform role holds no SELECT on clinic tables beyond owner
// memberships and roles. Owner actions on the person (sessions, MFA, password) run on the auth
// path inside the platform transaction: a failure there leaves no platform row and no new link;
// the auth step commits with its own audit row, so it stays recorded even if the platform
// commit fails afterwards (two pools, no shared transaction).
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ClinicCreated,
  type ClinicDetail,
  type ClinicList,
  type CreateClinicRequest,
  normalisePhone,
  type SetupLinkIssued,
  type UpdateClinicRequest,
} from '@shifa/contracts';
import {
  type AuditTarget,
  createClinic,
  issueOwnerLink,
  membership,
  type PlatformAction,
  type PlatformDb,
  type PlatformTx,
  tenant,
} from '@shifa/db';
import { and, desc, eq, ilike } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { OwnerAccounts } from '../identity/index.ts';
import { PLATFORM_DB } from './tokens.ts';

export type OwnerAction = 'setup-link' | 'reset-mfa' | 'end-sessions';

const OWNER_EVENTS = {
  'setup-link': 'owner.link_issued',
  'reset-mfa': 'owner.mfa_reset',
  'end-sessions': 'owner.sessions_ended',
} as const;

/** LIKE wildcards in a search are matched literally. */
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

@Injectable()
export class ClinicsService {
  constructor(
    @Inject(PLATFORM_DB) private readonly platformDb: PlatformDb,
    @Inject(OwnerAccounts) private readonly owners: OwnerAccounts,
  ) {}

  list(principal: Principal, search: string | undefined, requestId: string): Promise<ClinicList> {
    return this.#run(principal, { event: 'clinic.listed', requestId }, async (tx) => {
      const rows = await tx
        .select({
          id: tenant.id,
          name: tenant.name,
          type: tenant.type,
          status: tenant.status,
          subscriptionEnd: tenant.subscriptionEnd,
          createdAt: tenant.createdAt,
          ownerName: membership.displayName,
        })
        .from(tenant)
        // shifa_platform sees owner memberships only: at most one row per clinic.
        .leftJoin(membership, eq(membership.tenantId, tenant.id))
        .where(search ? ilike(tenant.name, likePattern(search)) : undefined)
        .orderBy(desc(tenant.createdAt));
      return {
        clinics: rows.map((r) => ({
          ...r,
          ownerName: r.ownerName ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
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

  update(
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
    const action = { event: 'clinic.status_changed', requestId, targetId: id, data } as const;
    return this.#run(principal, action, async (tx) => {
      const changed = await tx
        .update(tenant)
        .set({
          ...(input.status ? { status: input.status } : {}),
          ...(input.subscriptionEnd !== undefined
            ? { subscriptionEnd: input.subscriptionEnd }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(tenant.id, id))
        .returning({ id: tenant.id });
      if (changed.length === 0) throw new NotFoundException();
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
      const [owner] = await tx
        .select({ id: membership.id, userId: membership.userId, phone: membership.phoneE164 })
        .from(membership)
        .where(eq(membership.tenantId, id));
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
      if (owner.userId) {
        if (kind === 'reset-mfa') await this.owners.resetMfa(owner.userId, by);
        else await this.owners.endSessions(owner.userId, by);
      }
      return undefined;
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

/** The clinic's own fields and its owner card; 404 when there is no such clinic. */
async function clinicDetail(tx: PlatformTx, id: string): Promise<ClinicDetail> {
  const [clinic] = await tx.select().from(tenant).where(eq(tenant.id, id));
  if (!clinic) throw new NotFoundException();
  const [owner] = await tx
    .select({
      membershipId: membership.id,
      name: membership.displayName,
      status: membership.status,
    })
    .from(membership)
    .where(and(eq(membership.tenantId, id)));
  return {
    id: clinic.id,
    name: clinic.name,
    type: clinic.type,
    status: clinic.status,
    subscriptionEnd: clinic.subscriptionEnd,
    ownerName: owner?.name ?? null,
    createdAt: clinic.createdAt.toISOString(),
    owner: owner ?? null,
  };
}
