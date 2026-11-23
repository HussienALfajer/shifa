// What the platform module needs from identity (A-01a criteria 3, 4, 13), on the auth path: new
// setup links (token shown once, hash stored by the caller), the account behind a phone (an
// existing owner gets an invitation, never a second account), and the owner support actions:
// end every session, reset MFA (enrol again at next sign-in), clear the password (until the new
// link is used). The platform module audits each action in its own transaction.
import { Inject, Injectable } from '@nestjs/common';
import type { SetupLinkIssued } from '@shifa/contracts';
import { type AuthDb, twoFactor, user } from '@shifa/db';
import { eq } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { clearPassword, userIdByPhone } from './accounts.ts';
import { LINK_TTL_MS, linkUrls, newLinkToken } from './links.ts';
import { SessionIssuer } from './session-issuer.ts';
import { AUTH_DB, CLINIC_WEB_URL } from './tokens.ts';

export interface NewSetupLink {
  /** SHA-256 of the token, for the setup_link row. */
  tokenHash: string;
  expiresAt: Date;
  /** The link as shown once (copy and WhatsApp share) for `purpose`. */
  issued(purpose: SetupLinkIssued['purpose']): SetupLinkIssued;
}

@Injectable()
export class OwnerAccounts {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CLINIC_WEB_URL) private readonly clinicWebUrl: string,
    @Inject(SessionIssuer) private readonly issuer: SessionIssuer,
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

  endSessions(userId: string): Promise<number> {
    return this.issuer.endAll(userId);
  }

  /** TOTP and recovery codes gone: the person enrols again at the next sign-in. */
  async resetMfa(userId: string): Promise<void> {
    const now = this.clock.now();
    await this.authDb.withAuth(async (tx) => {
      await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
      await tx
        .update(user)
        .set({ twoFactorEnabled: false, updatedAt: now })
        .where(eq(user.id, userId));
    });
    await this.issuer.endAll(userId);
  }

  /** The old password stops working at once; the new setup link sets the next one. */
  async resetPassword(userId: string): Promise<void> {
    const now = this.clock.now();
    await this.authDb.withAuth((tx) => clearPassword(tx, userId, now));
    await this.issuer.endAll(userId);
  }
}
