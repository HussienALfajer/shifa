// What the platform module needs from identity (A-01a criteria 3, 4, 13), on the auth path: new
// setup links (token shown once, hash stored by the caller), the account behind a phone (an
// existing owner gets an invitation, never a second account), and the owner support actions:
// end every session, reset MFA (enrol again at next sign-in), clear the password (until the new
// link is used). Each action commits with its own auth-path audit row (actor: the super admin),
// so its effect is recorded even if the platform transaction around it fails afterwards.
import { Inject, Injectable } from '@nestjs/common';
import type { SetupLinkIssued } from '@shifa/contracts';
import { type AuthDb, session, type Tx, twoFactor, user } from '@shifa/db';
import { eq } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { clearPassword, userIdByPhone } from './accounts.ts';
import { IdentityAudit, type IdentityEvent } from './identity-audit.ts';
import { LINK_TTL_MS, linkUrls, newLinkToken } from './links.ts';
import { AUTH_DB, CLINIC_WEB_URL } from './tokens.ts';

export interface NewSetupLink {
  /** SHA-256 of the token, for the setup_link row. */
  tokenHash: string;
  expiresAt: Date;
  /** The link as shown once (copy and WhatsApp share) for `purpose`. */
  issued(purpose: SetupLinkIssued['purpose']): SetupLinkIssued;
}

/** Who asks for an owner action: the super admin and the request. */
export interface ActionBy {
  actorId: string;
  requestId: string;
}

@Injectable()
export class OwnerAccounts {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CLINIC_WEB_URL) private readonly clinicWebUrl: string,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
  ) {}

  /** A new link token valid 72 h; only its hash leaves for the database. */
  newSetupLink(): NewSetupLink {
    const { token, hash } = newLinkToken();
    const expiresAt = new Date(this.clock.now().getTime() + LINK_TTL_MS);
    const urls = linkUrls(this.clinicWebUrl, token);
    return {
      tokenHash: hash,
      expiresAt,
      issued: (purpose) => ({ ...urls, purpose, expiresAt: expiresAt.toISOString() }),
    };
  }

  userIdByPhone(phoneE164: string): Promise<string | null> {
    return this.authDb.withAuth((tx) => userIdByPhone(tx, phoneE164));
  }

  endSessions(userId: string, by: ActionBy): Promise<void> {
    return this.#act(userId, by, { event: 'auth.session_ended', data: { reason: 'admin' } }, () =>
      Promise.resolve(),
    );
  }

  /** TOTP and recovery codes gone: the person enrols again at the next sign-in. */
  resetMfa(userId: string, by: ActionBy): Promise<void> {
    const now = this.clock.now();
    return this.#act(userId, by, { event: 'auth.mfa_reset' }, async (tx) => {
      await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
      await tx
        .update(user)
        .set({ twoFactorEnabled: false, updatedAt: now })
        .where(eq(user.id, userId));
    });
  }

  /** The old password stops working at once; the new setup link sets the next one. */
  resetPassword(userId: string, by: ActionBy): Promise<void> {
    const now = this.clock.now();
    return this.#act(userId, by, { event: 'auth.password_reset' }, (tx) =>
      clearPassword(tx, userId, now),
    );
  }

  /** `work`, then every session of the person ended, then one audit row: one transaction. */
  #act(
    userId: string,
    by: ActionBy,
    entry: IdentityEvent,
    work: (tx: Tx) => Promise<void>,
  ): Promise<void> {
    return this.authDb.withAuth(async (tx) => {
      await work(tx);
      await tx.delete(session).where(eq(session.userId, userId));
      await this.audit.record(
        entry,
        { actorId: by.actorId, targetId: userId, requestId: by.requestId },
        tx,
      );
    });
  }
}
