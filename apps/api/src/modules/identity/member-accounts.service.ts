// What the team module needs from identity (A-01b criteria 2–4, OD-86), on the auth path: a new
// member link (token shown once, hash stored by the caller in the clinic's transaction), whether
// a phone has an account (invitation or setup link; the owner never learns which), whether an
// account works in another clinic (a new link resets a password only for a one-clinic account),
// ending a member's sessions in one clinic, and the password reset of a one-clinic account.
import { Inject, Injectable } from '@nestjs/common';
import type { MemberLinkIssued } from '@shifa/contracts';
import { type AuthDb, membership, platformAdmin, session, type Tx } from '@shifa/db';
import { and, eq } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { ApiError } from '../../platform/errors.ts';
import { clearPassword, userIdByPhone } from './accounts.ts';
import { IdentityAudit } from './identity-audit.ts';
import { type ActionBy, OwnerAccounts } from './owner-accounts.service.ts';
import { AUTH_DB } from './tokens.ts';

/** Under withUser(): a super admin, or a member of a clinic besides `tenantId`. */
async function sharedIn(tx: Tx, userId: string, tenantId: string): Promise<boolean> {
  const [admin] = await tx
    .select({ id: platformAdmin.userId })
    .from(platformAdmin)
    .where(eq(platformAdmin.userId, userId));
  if (admin) return true;
  const rows = await tx
    .select({ tenantId: membership.tenantId })
    .from(membership)
    .where(eq(membership.userId, userId));
  return rows.some((r) => r.tenantId !== tenantId);
}

export interface NewMemberLink {
  tokenHash: string;
  expiresAt: Date;
  /** The link as the owner sees it once: no purpose (OD-76). */
  issued: MemberLinkIssued;
}

@Injectable()
export class MemberAccounts {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(OwnerAccounts) private readonly accounts: OwnerAccounts,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  newLink(): NewMemberLink {
    const link = this.accounts.newSetupLink();
    const { url, whatsappUrl, expiresAt } = link.issued('member_setup');
    return {
      tokenHash: link.tokenHash,
      expiresAt: link.expiresAt,
      issued: { url, whatsappUrl, expiresAt },
    };
  }

  hasAccount(phoneE164: string): Promise<boolean> {
    return this.authDb.withAuth(async (tx) => (await userIdByPhone(tx, phoneE164)) !== null);
  }

  /** True when the account belongs to a clinic besides `tenantId`, or is a super admin. */
  isShared(userId: string, tenantId: string): Promise<boolean> {
    return this.authDb.withUser(userId, (tx) => sharedIn(tx, userId, tenantId));
  }

  /** Ends the person's sessions whose active clinic is `tenantId`; one audit row each. */
  endSessionsInClinic(userId: string, tenantId: string, by: ActionBy): Promise<number> {
    return this.authDb.withAuth(async (tx) => {
      const ended = await tx
        .delete(session)
        .where(and(eq(session.userId, userId), eq(session.activeTenantId, tenantId)))
        .returning({ id: session.id });
      for (const row of ended) {
        await this.audit.record(
          { event: 'auth.session_ended', data: { reason: 'member' } },
          { actorId: by.actorId, targetId: row.id, requestId: by.requestId },
          tx,
        );
      }
      return ended.length;
    });
  }

  /**
   * The password stops at once and every session ends; the new link sets the next one. Checked
   * again in the same transaction: an account that joined another clinic since isShared() is
   * refused (409 `account_shared`), never cleared (OD-86).
   */
  resetPassword(userId: string, tenantId: string, by: ActionBy): Promise<void> {
    const now = this.clock.now();
    return this.authDb.withUser(userId, async (tx) => {
      if (await sharedIn(tx, userId, tenantId)) throw new ApiError(409, 'account_shared');
      await clearPassword(tx, userId, now);
      await tx.delete(session).where(eq(session.userId, userId));
      await this.audit.record(
        { event: 'auth.password_reset' },
        { actorId: by.actorId, targetId: userId, requestId: by.requestId },
        tx,
      );
    });
  }
}
