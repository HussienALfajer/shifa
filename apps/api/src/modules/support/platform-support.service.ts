// The super admin's support access (A-02 criteria 11, 12, 14; contract rows `sup` … `supEnded`):
// list a clinic's grants, open one (reason, 30/60/120/240 minutes, a hand-off), issue a new hand-off
// («فتح عيادة الويب»), end one's own grant (from admin web or from the support tab). Each call is one
// withPlatformAdmin() transaction with its audit row (support.listed, support.opened with the
// minutes, support.handoff_issued, support.ended); the reason stays on the grant row. Grants are
// read inside the clinic's context, where restrictive policies keep them to these actions; every
// action first closes the clinic's expired grants (`expiry`, one support.expired row each).
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  OpenedSupportGrant,
  OpenSupportGrantRequest,
  PlatformSupportGrants,
  SupportGrantView,
  SupportHandoff,
} from '@shifa/contracts';
import {
  type AuditTarget,
  auditEvent,
  inTenantContext,
  type PlatformAction,
  type PlatformDb,
  type PlatformTx,
  supportAccessGrant,
  tenant,
} from '@shifa/db';
import { and, desc, eq, isNull, lte, sql } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { ApiError } from '../../platform/errors.ts';
import { SupportDirectory } from '../identity/index.ts';
import {
  type GrantRow,
  grantColumns,
  grantView,
  HANDOFF_TTL_MS,
  handoffUrl,
  isOpen,
  newHandoffToken,
} from './grants.ts';
import { SUPPORT_CLINIC_WEB_URL, SUPPORT_PLATFORM_DB } from './tokens.ts';

const MINUTE_MS = 60_000;
const OPEN_KEY = 'support_access_grant_tenant_id_admin_user_id_open_key';

const supportEnded = () => new ApiError(409, 'support_ended');

/** A unique violation of the one-open-grant index (a racing second open). */
function isSecondOpen(err: unknown): boolean {
  const e = err as { code?: unknown; constraint?: unknown } | null;
  return e?.code === '23505' && e.constraint === OPEN_KEY;
}

@Injectable()
export class PlatformSupport {
  constructor(
    @Inject(SUPPORT_PLATFORM_DB) private readonly platformDb: PlatformDb,
    @Inject(SUPPORT_CLINIC_WEB_URL) private readonly clinicWebUrl: string,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SupportDirectory) private readonly directory: SupportDirectory,
  ) {}

  list(principal: Principal, clinicId: string, requestId: string): Promise<PlatformSupportGrants> {
    const action = { event: 'support.listed', requestId, targetId: clinicId } as const;
    return this.#inClinic(principal, action, clinicId, async (sp) => {
      const now = this.clock.now();
      const rows = await sp
        .select(grantColumns)
        .from(supportAccessGrant)
        .orderBy(desc(supportAccessGrant.openedAt));
      const mine = rows.find((r) => r.adminUserId === principal.userId && isOpen(r, now));
      return {
        now: now.toISOString(),
        mine: mine ? grantView(mine, now) : null,
        grants: rows.map((r) => grantView(r, now)),
      };
    });
  }

  async open(
    principal: Principal,
    clinicId: string,
    body: OpenSupportGrantRequest,
    requestId: string,
  ): Promise<OpenedSupportGrant> {
    const adminName = await this.directory.nameOf(principal.userId);
    if (adminName === null) throw new Error('the super admin has no account');
    const { token, hash } = newHandoffToken();
    const action = {
      event: 'support.opened',
      requestId,
      targetId: clinicId,
      data: { minutes: String(body.minutes) },
    } as const;
    try {
      return await this.#inClinic(principal, action, clinicId, async (sp, audit) => {
        const now = this.clock.now();
        const [mine] = await sp
          .select(grantColumns)
          .from(supportAccessGrant)
          .where(
            and(
              eq(supportAccessGrant.adminUserId, principal.userId),
              isNull(supportAccessGrant.endedAt),
            ),
          );
        if (mine && isOpen(mine, now)) throw new ApiError(409, 'support_active');
        const [row] = await sp
          .insert(supportAccessGrant)
          .values({
            tenantId: clinicId,
            adminUserId: principal.userId,
            adminName: adminName.slice(0, 200),
            reason: body.reason,
            openedAt: now,
            expiresAt: new Date(now.getTime() + body.minutes * MINUTE_MS),
            handoffTokenHash: hash,
            handoffExpiresAt: new Date(now.getTime() + HANDOFF_TTL_MS),
          })
          .returning(grantColumns);
        if (!row) throw new Error('the grant was not written');
        audit.setData({ grantId: row.id });
        return {
          grant: grantView(row, now),
          handoffUrl: handoffUrl(this.clinicWebUrl, token),
        };
      });
    } catch (err) {
      if (isSecondOpen(err)) throw new ApiError(409, 'support_active');
      throw err;
    }
  }

  async handoff(principal: Principal, grantId: string, requestId: string): Promise<SupportHandoff> {
    const clinicId = await this.#clinicOf(principal, grantId);
    const { token, hash } = newHandoffToken();
    const action = {
      event: 'support.handoff_issued',
      requestId,
      targetId: clinicId,
      data: { grantId },
    } as const;
    return this.#inClinic(principal, action, clinicId, async (sp) => {
      const now = this.clock.now();
      await this.#own(sp, principal, grantId, now);
      const issued = await sp
        .update(supportAccessGrant)
        .set({ handoffTokenHash: hash, handoffExpiresAt: new Date(now.getTime() + HANDOFF_TTL_MS) })
        .where(and(eq(supportAccessGrant.id, grantId), isNull(supportAccessGrant.endedAt)));
      if (issued.rowCount !== 1) throw supportEnded();
      return { handoffUrl: handoffUrl(this.clinicWebUrl, token) };
    });
  }

  /** The super admin ends their own grant (admin web, contract row `supEnded`). */
  async end(principal: Principal, grantId: string, requestId: string): Promise<SupportGrantView> {
    return this.#end(principal, await this.#clinicOf(principal, grantId), grantId, requestId);
  }

  /** The support tab ends its own grant (`POST /auth/support/end`, row `endAsk`). */
  async endFromSession(principal: Principal, requestId: string): Promise<void> {
    const grantId = principal.support?.grantId;
    if (!grantId || principal.tenantId === null) throw new ApiError(403, 'forbidden');
    await this.#end(principal, principal.tenantId, grantId, requestId);
  }

  #end(
    principal: Principal,
    clinicId: string,
    grantId: string,
    requestId: string,
  ): Promise<SupportGrantView> {
    const action = {
      event: 'support.ended',
      requestId,
      targetId: clinicId,
      data: { grantId, endedBy: 'admin' },
    } as const;
    return this.#inClinic(principal, action, clinicId, async (sp) => {
      const now = this.clock.now();
      const row = await this.#own(sp, principal, grantId, now);
      const [ended] = await sp
        .update(supportAccessGrant)
        .set({
          endedAt: now,
          endedBy: principal.userId,
          endedByName: row.adminName,
          endReason: 'admin',
          handoffTokenHash: null,
          handoffExpiresAt: null,
        })
        .where(and(eq(supportAccessGrant.id, grantId), isNull(supportAccessGrant.endedAt)))
        .returning(grantColumns);
      if (!ended) throw supportEnded();
      return grantView(ended, now);
    });
  }

  /** This super admin's open grant `grantId`: 404 when not theirs, 409 when it ended. */
  async #own(sp: PlatformTx, principal: Principal, grantId: string, now: Date): Promise<GrantRow> {
    const [row] = await sp
      .select(grantColumns)
      .from(supportAccessGrant)
      .where(
        and(
          eq(supportAccessGrant.id, grantId),
          eq(supportAccessGrant.adminUserId, principal.userId),
        ),
      );
    if (!row) throw new NotFoundException();
    if (!isOpen(row, now)) throw supportEnded();
    return row;
  }

  async #clinicOf(principal: Principal, grantId: string): Promise<string> {
    const clinicId = await this.directory.clinicOfOwnGrant(principal.userId, grantId);
    if (clinicId === null) throw new NotFoundException();
    return clinicId;
  }

  /** One audited platform action inside the clinic (404 when there is no such clinic). */
  #inClinic<T>(
    principal: Principal,
    action: Omit<PlatformAction, 'actorId'>,
    clinicId: string,
    fn: (sp: PlatformTx, audit: AuditTarget) => Promise<T>,
  ): Promise<T> {
    return this.platformDb.withPlatformAdmin(
      { ...action, actorId: principal.userId },
      async (tx, audit) => {
        const [clinic] = await tx
          .select({ id: tenant.id })
          .from(tenant)
          .where(eq(tenant.id, clinicId));
        if (!clinic) throw new NotFoundException();
        return inTenantContext(tx, clinicId, async (sp) => {
          await closeExpired(sp, action.requestId);
          return fn(sp, audit);
        });
      },
    );
  }
}

/**
 * Closes the clinic's grants whose expiry has passed (database time), each with one
 * `support.expired` row: the one-open-grant index then allows a new one (criterion 11).
 */
async function closeExpired(sp: PlatformTx, requestId: string | undefined): Promise<void> {
  const closed = await sp
    .update(supportAccessGrant)
    .set({
      endedAt: sql`${supportAccessGrant.expiresAt}`,
      endReason: 'expiry',
      handoffTokenHash: null,
      handoffExpiresAt: null,
    })
    .where(and(isNull(supportAccessGrant.endedAt), lte(supportAccessGrant.expiresAt, sql`now()`)))
    .returning({ id: supportAccessGrant.id, adminUserId: supportAccessGrant.adminUserId });
  for (const { id, adminUserId } of closed) {
    await sp.insert(auditEvent).values({
      tenantId: null,
      actorId: adminUserId,
      targetId: id,
      event: 'support.expired',
      requestId: requestId ?? null,
      data: { endedBy: 'expiry' },
    });
  }
}
