// Invitations (A-01b criterion 2, OD-76): a phone that already has an account is invited, not
// given a password. The page shows the clinic, the name the owner typed and the roles with scope.
// Only the signed-in person whose phone was invited accepts or declines; anyone else, and any
// used, replaced or expired link, gets one answer (404 link_invalid). Acceptance binds the
// membership on the auth path (withUserLink; the database checks person and phone too); the
// clinic's audit row is written in the link's clinic (linkScope, the documented exception to
// scope binding) around it, so a failed binding leaves no row.
import { Inject, Injectable } from '@nestjs/common';
import type { InvitationView } from '@shifa/contracts';
import { type AuthDb, auditEvent, membership, type ShifaDb, setupLink, user } from '@shifa/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { linkScope, type Principal, withScope } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { SHIFA_DB } from '../../platform/database.module.ts';
import { linkTokenHash } from './links.ts';
import { type ClinicLink, linkInvalid, SetupLinksService } from './setup-links.service.ts';
import { AUTH_DB } from './tokens.ts';

type Answer = 'accepted' | 'declined';

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(SHIFA_DB) private readonly db: ShifaDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SetupLinksService) private readonly links: SetupLinksService,
  ) {}

  async view(token: string): Promise<InvitationView> {
    const found = await this.#invitation(token);
    return {
      clinicName: found.clinicName,
      personName: found.personName,
      roles: await this.links.rolesOf(found),
      expiresAt: found.expiresAt.toISOString(),
    };
  }

  accept(principal: Principal, token: string, requestId: string): Promise<void> {
    return this.#answer(principal, token, 'accepted', requestId);
  }

  decline(principal: Principal, token: string, requestId: string): Promise<void> {
    return this.#answer(principal, token, 'declined', requestId);
  }

  async #answer(
    principal: Principal,
    token: string,
    answer: Answer,
    requestId: string,
  ): Promise<void> {
    const found = await this.#invitation(token);
    const scope = linkScope({ tenantId: found.tenantId, userId: principal.userId });
    await withScope(this.db, scope, async (tx) => {
      await tx.insert(auditEvent).values({
        tenantId: found.tenantId,
        actorId: principal.userId,
        targetId: found.membershipId,
        event: answer === 'accepted' ? 'member.invitation_accepted' : 'member.invitation_declined',
        requestId,
        data: {},
      });
      // The auth step commits first; if this clinic transaction failed afterwards the binding
      // would stand without its row (two pools, as the owner support of A-01-03).
      await this.#bind(principal.userId, token, found, answer);
    });
  }

  /** On the auth path: the person's phone checked, the link used, the membership bound. */
  #bind(userId: string, token: string, found: ClinicLink, answer: Answer): Promise<void> {
    const now = this.clock.now();
    return this.authDb.withUserLink(userId, linkTokenHash(token), async (tx) => {
      const [person] = await tx
        .select({ phone: user.phoneNumber })
        .from(user)
        .where(eq(user.id, userId));
      // Someone else signed in: the same answer as for any invalid link.
      if (person?.phone !== found.phoneE164) throw linkInvalid();
      const used = await tx
        .update(setupLink)
        .set({ usedAt: now })
        .where(
          and(
            eq(setupLink.id, found.linkId),
            isNull(setupLink.usedAt),
            isNull(setupLink.replacedAt),
            gt(setupLink.expiresAt, now),
          ),
        )
        .returning({ id: setupLink.id });
      if (used.length === 0) throw linkInvalid();
      if (answer === 'declined') return;
      const bound = await tx
        .update(membership)
        .set({ userId, status: 'active', updatedAt: now })
        .where(eq(membership.id, found.membershipId))
        .returning({ id: membership.id });
      if (bound.length !== 1) throw linkInvalid();
    });
  }

  async #invitation(token: string): Promise<ClinicLink> {
    const found = await this.links.findClinicLink(token);
    if (found.purpose !== 'invitation' || found.boundUserId !== null) throw linkInvalid();
    return found;
  }
}
