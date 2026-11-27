// Support sessions (A-02 criteria 11–14, ADR-0050): a `session` row with `support_grant_id`, opened
// by a hand-off (support-handoff.ts). Every request reads its grant on the auth path as the signed-in
// super admin: once the grant ended (the admin, an owner) or expired, the answer is 401
// `session_expired`, reason `support_ended`, with who ended it and when; an expired grant is closed
// here (`support.expired`, once). Otherwise the principal is the super admin with a synthesised
// tenant-wide `owner` role in the grant's clinic, `support` set: the guard refuses writes and
// TenantDb opens READ ONLY transactions. The super admin's own idle limit applies (15 minutes).
import { Inject, Injectable } from '@nestjs/common';
import type { SupportEnded, SupportSessionView } from '@shifa/contracts';
import {
  type AuthDb,
  platformAdmin,
  type ShifaDb,
  session,
  supportAccessGrant,
  tenant,
} from '@shifa/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  type Principal,
  parsePrincipal,
  SessionExpiredError,
  SupportEndedError,
} from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { SHIFA_DB } from '../../platform/database.module.ts';
import { IdentityAudit, type SessionEndReason } from './identity-audit.ts';
import { NO_CLINIC_IDLE_MINUTES } from './tenant-view.ts';
import { AUTH_DB } from './tokens.ts';

const MINUTE_MS = 60_000;

type SessionRow = typeof session.$inferSelect;

/** Ends the session row (deleted, one `auth.session_ended` row). */
type EndSession = (reason: SessionEndReason) => Promise<void>;

const grantColumns = {
  id: supportAccessGrant.id,
  tenantId: supportAccessGrant.tenantId,
  adminUserId: supportAccessGrant.adminUserId,
  reason: supportAccessGrant.reason,
  expiresAt: supportAccessGrant.expiresAt,
  endedAt: supportAccessGrant.endedAt,
  endedByName: supportAccessGrant.endedByName,
  endReason: supportAccessGrant.endReason,
};

type GrantRow = {
  [K in keyof typeof grantColumns]: (typeof supportAccessGrant.$inferSelect)[K];
};

@Injectable()
export class SupportSessions {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(SHIFA_DB) private readonly db: ShifaDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
  ) {}

  /** The principal of a support session row; throws when its grant or session has ended. */
  async principal(
    row: SessionRow,
    now: Date,
    requestId: string,
    end: EndSession,
  ): Promise<Principal> {
    const grantId = row.supportGrantId;
    const { grant, admin } = await this.authDb.withUser(row.userId, async (tx) => ({
      grant: grantId
        ? (
            await tx
              .select(grantColumns)
              .from(supportAccessGrant)
              .where(eq(supportAccessGrant.id, grantId))
          )[0]
        : undefined,
      admin:
        (
          await tx
            .select({ id: platformAdmin.userId })
            .from(platformAdmin)
            .where(eq(platformAdmin.userId, row.userId))
        ).length > 0,
    }));
    // A grant that is not this admin's in this clinic, or an admin who is one no more: gone.
    if (
      !grant ||
      !admin ||
      grant.adminUserId !== row.userId ||
      grant.tenantId !== row.activeTenantId
    ) {
      await end('ended');
      throw new SessionExpiredError('ended');
    }
    const ended = await this.#ended(grant, now, requestId);
    if (ended) {
      // The ended page stays until the grant's own end; then the row goes.
      if (now >= row.expiresAt) await end('support_ended');
      throw new SupportEndedError(ended);
    }
    const lastActive = row.lastActiveAt ?? row.createdAt;
    if (now.getTime() - lastActive.getTime() >= NO_CLINIC_IDLE_MINUTES * MINUTE_MS) {
      await end('idle');
      throw new SessionExpiredError('idle');
    }
    await this.authDb.withUser(row.userId, (tx) =>
      tx.update(session).set({ lastActiveAt: now }).where(eq(session.id, row.id)),
    );
    return parsePrincipal({
      userId: row.userId,
      sessionId: row.id,
      tenantId: grant.tenantId,
      branchId: null,
      roles: [{ role: 'owner', tenantId: grant.tenantId, branchId: null }],
      platformAdmin: true,
      mfa: row.mfaVerifiedAt ? 'verified' : 'pending',
      support: { grantId: grant.id, expiresAt: grant.expiresAt.toISOString() },
    });
  }

  /** What clinic web's support banner shows (`support` of GET /auth/session). */
  async view(principal: Principal): Promise<SupportSessionView | null> {
    const ref = principal.support;
    if (!ref || principal.tenantId === null) return null;
    const tenantId = principal.tenantId;
    const [grant] = await this.authDb.withUser(principal.userId, (tx) =>
      tx
        .select({ reason: supportAccessGrant.reason, expiresAt: supportAccessGrant.expiresAt })
        .from(supportAccessGrant)
        .where(eq(supportAccessGrant.id, ref.grantId)),
    );
    // The clinic's name, read as the clinic reads its own row (read only, as the session).
    const [clinic] = await this.db.withTenant(
      { tenantId, userId: principal.userId, readOnly: true },
      (tx) => tx.select({ name: tenant.name }).from(tenant).where(eq(tenant.id, tenantId)),
    );
    if (!grant || !clinic) throw new SessionExpiredError('ended');
    return {
      grantId: ref.grantId,
      clinicName: clinic.name,
      reason: grant.reason,
      expiresAt: grant.expiresAt.toISOString(),
      now: this.clock.now().toISOString(),
    };
  }

  /** How the grant ended, or null while it is open; an expired grant is closed here, once. */
  async #ended(grant: GrantRow, now: Date, requestId: string): Promise<SupportEnded | null> {
    if (grant.endedAt !== null && grant.endReason !== null) {
      return {
        endedBy: grant.endReason,
        endedAt: grant.endedAt.toISOString(),
        ownerName: grant.endReason === 'owner' ? grant.endedByName : null,
      };
    }
    if (grant.expiresAt > now) return null;
    await this.authDb.withUser(grant.adminUserId, async (tx) => {
      // The policy lets only an expired, open grant of this admin be closed: once.
      const closed = await tx
        .update(supportAccessGrant)
        .set({ endedAt: sql`${supportAccessGrant.expiresAt}`, endReason: 'expiry' })
        .where(and(eq(supportAccessGrant.id, grant.id), isNull(supportAccessGrant.endedAt)));
      if (closed.rowCount === 1) {
        await this.audit.record(
          { event: 'support.expired', data: { endedBy: 'expiry' } },
          { actorId: grant.adminUserId, targetId: grant.id, requestId },
          tx,
        );
      }
    });
    return { endedBy: 'expiry', endedAt: grant.expiresAt.toISOString(), ownerName: null };
  }
}
