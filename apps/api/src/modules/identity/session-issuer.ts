// Sessions we create ourselves (A-01-03): after a setup link sets the password, and when a
// session is rotated after the second factor (A-01a criterion 9). Same row and cookie format as
// Better Auth's own sign-in, so the adapter reads them alike.
import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type AuthDb, session } from '@shifa/db';
import type { Principal } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { SESSION_ABSOLUTE_MS, sessionCookieFor } from './session-cookie.ts';
import { SessionsService } from './sessions.service.ts';
import { AUTH_DB, IDENTITY_CONFIG, type IdentitySecrets } from './tokens.ts';

export interface IssueOptions {
  active?: { tenantId: string | null; branchId: string | null };
  createdAt?: Date;
  expiresAt?: Date;
  userAgent?: string | undefined;
  /** The session has passed the second factor (rotation after enrolment or the challenge). */
  mfaVerified?: boolean;
}

export interface Issued {
  token: string;
  /** Set-Cookie line of the new session. */
  cookie: string;
}

@Injectable()
export class SessionIssuer {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(IDENTITY_CONFIG) private readonly secrets: IdentitySecrets,
    @Inject(SessionsService) private readonly sessions: SessionsService,
  ) {}

  /** A new session for `userId`; the clinic is chosen as at sign-in unless given. */
  async issue(userId: string, options: IssueOptions = {}): Promise<Issued> {
    const now = this.clock.now();
    const active = options.active ?? (await this.sessions.activeAtSignIn(userId));
    // 192 bits, like Better Auth's own tokens (32 characters).
    const token = randomBytes(24).toString('base64url');
    const createdAt = options.createdAt ?? now;
    const expiresAt = options.expiresAt ?? new Date(createdAt.getTime() + SESSION_ABSOLUTE_MS);
    await this.authDb.withAuth((tx) =>
      tx.insert(session).values({
        id: randomUUID(),
        token,
        userId,
        createdAt,
        updatedAt: now,
        lastActiveAt: now,
        expiresAt,
        userAgent: options.userAgent?.slice(0, 512) ?? null,
        activeTenantId: active.tenantId,
        activeBranchId: active.branchId,
        mfaVerifiedAt: options.mfaVerified ? now : null,
      }),
    );
    return {
      token,
      cookie: sessionCookieFor(token, this.secrets.betterAuthSecret, expiresAt, now),
    };
  }

  /**
   * Replaces the principal's session with a new one, keeping its clinic and its absolute limit;
   * the old token stops working at once (audited `rotated`).
   */
  async rotate(principal: Principal, requestId: string, mfaVerified: boolean): Promise<Issued> {
    const old = await this.sessions.own(principal);
    const issued = await this.issue(principal.userId, {
      active: { tenantId: old.activeTenantId, branchId: old.activeBranchId },
      createdAt: old.createdAt,
      expiresAt: old.expiresAt,
      userAgent: old.userAgent ?? undefined,
      mfaVerified,
    });
    await this.sessions.end(principal.userId, [old.id], 'rotated', requestId);
    return issued;
  }
}
