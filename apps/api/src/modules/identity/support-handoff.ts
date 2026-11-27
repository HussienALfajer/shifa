// The support hand-off (A-02 criterion 11, ADR-0050): clinic web posts the token from the hand-off
// URL's fragment; the grant is found by the token's SHA-256 alone, the hash is cleared in the same
// transaction (single use), the grant's earlier support sessions end (one tab), and a support
// session starts: the super admin's, in the grant's clinic, MFA passed (only an MFA-verified super
// admin can issue a hand-off), ending with the grant, under its own cookie. One answer (404
// `link_invalid`) for an unknown, used or expired hand-off and an ended or expired grant.
import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SessionView } from '@shifa/contracts';
import { type AuthDb, platformAdmin, session, supportAccessGrant } from '@shifa/db';
import { and, eq, isNull } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { IdentityAudit } from './identity-audit.ts';
import { linkTokenHash } from './links.ts';
import { SUPPORT_COOKIE, sessionCookieFor } from './session-cookie.ts';
import { SessionsService } from './sessions.service.ts';
import { linkInvalid } from './setup-links.service.ts';
import { AUTH_DB, IDENTITY_CONFIG, type IdentitySecrets } from './tokens.ts';

export interface HandoffMeta {
  requestId: string;
  userAgent: string | undefined;
}

@Injectable()
export class SupportHandoffs {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(IDENTITY_CONFIG) private readonly secrets: IdentitySecrets,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
    @Inject(SessionsService) private readonly sessions: SessionsService,
  ) {}

  async exchange(token: string, meta: HandoffMeta): Promise<{ view: SessionView; cookie: string }> {
    const now = this.clock.now();
    const hash = linkTokenHash(token);
    const [grant] = await this.authDb.withHandoff(hash, (tx) =>
      tx
        .select({
          id: supportAccessGrant.id,
          tenantId: supportAccessGrant.tenantId,
          adminUserId: supportAccessGrant.adminUserId,
          expiresAt: supportAccessGrant.expiresAt,
          endedAt: supportAccessGrant.endedAt,
          handoffExpiresAt: supportAccessGrant.handoffExpiresAt,
        })
        .from(supportAccessGrant)
        .where(eq(supportAccessGrant.handoffTokenHash, hash)),
    );
    if (grant === undefined) throw linkInvalid();
    const open = grant.endedAt === null && grant.expiresAt > now;
    const fresh = grant.handoffExpiresAt !== null && grant.handoffExpiresAt > now;
    if (!open || !fresh) throw linkInvalid();
    // 192 bits, like Better Auth's own tokens.
    const sessionToken = randomBytes(24).toString('base64url');
    await this.authDb.withHandoff(
      hash,
      async (tx) => {
        // The policy lets only an unexpired hand-off of an open grant be cleared: a second use of
        // the same token in parallel changes nothing.
        const used = await tx
          .update(supportAccessGrant)
          .set({ handoffTokenHash: null, handoffExpiresAt: null })
          .where(
            and(
              eq(supportAccessGrant.id, grant.id),
              eq(supportAccessGrant.handoffTokenHash, hash),
              isNull(supportAccessGrant.endedAt),
            ),
          );
        if (used.rowCount !== 1) throw linkInvalid();
        const [admin] = await tx
          .select({ id: platformAdmin.userId })
          .from(platformAdmin)
          .where(eq(platformAdmin.userId, grant.adminUserId));
        if (!admin) throw linkInvalid();
        // One tab: the grant's earlier support sessions end.
        const replaced = await tx
          .delete(session)
          .where(eq(session.supportGrantId, grant.id))
          .returning({ id: session.id });
        for (const { id } of replaced) {
          await this.audit.record(
            { event: 'auth.session_ended', data: { reason: 'replaced' } },
            { actorId: grant.adminUserId, targetId: id, requestId: meta.requestId },
            tx,
          );
        }
        await tx.insert(session).values({
          id: randomUUID(),
          token: sessionToken,
          userId: grant.adminUserId,
          createdAt: now,
          updatedAt: now,
          lastActiveAt: now,
          expiresAt: grant.expiresAt,
          userAgent: meta.userAgent?.slice(0, 512) ?? null,
          activeTenantId: grant.tenantId,
          activeBranchId: null,
          mfaVerifiedAt: now,
          supportGrantId: grant.id,
        });
        await this.audit.record(
          { event: 'support.session_started' },
          { actorId: grant.adminUserId, targetId: grant.id, requestId: meta.requestId },
          tx,
        );
      },
      grant.adminUserId,
    );
    const principal = await this.sessions.authenticate(sessionToken, meta.requestId);
    if (!principal) throw new Error('the new support session was not found');
    return {
      view: await this.sessions.view(principal),
      cookie: sessionCookieFor(
        sessionToken,
        this.secrets.betterAuthSecret,
        grant.expiresAt,
        now,
        SUPPORT_COOKIE,
      ),
    };
  }
}
