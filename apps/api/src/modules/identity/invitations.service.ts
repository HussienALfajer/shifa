// Invitations (A-01b criterion 2, OD-76): a phone that already has an account is invited, not
// given a password. The page shows the clinic, the name the owner typed and the roles with scope.
// Only the signed-in person whose phone was invited accepts or declines. A valid link opened by a
// person signed in with another number answers 403 invitation_other_phone (OD-104), checked only
// after the link is known valid, so it says nothing about a dead link; any used, replaced or
// expired link, and a super admin, get one answer (404 link_invalid). Acceptance binds the
// membership on the auth path (withUserLink; the database checks person and phone too); the
// clinic's audit row is written in the link's clinic (linkScope, the documented exception to
// scope binding) around it, so a failed binding leaves no row.
import { Inject, Injectable } from '@nestjs/common';
import { type InvitationView, maskPhone } from '@shifa/contracts';
import {
  type AuthDb,
  auditEvent,
  membership,
  platformAdmin,
  type ShifaDb,
  setupLink,
  user,
} from '@shifa/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { linkScope, type Principal, withScope } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { SHIFA_DB } from '../../platform/database.module.ts';
import { ApiError } from '../../platform/errors.ts';
import { recordGauges } from '../usage/index.ts';
import { IdentityAudit } from './identity-audit.ts';
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
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
  ) {}

  async view(token: string): Promise<InvitationView> {
    const found = await this.#invitation(token);
    return {
      clinicName: found.clinicName,
      personName: found.personName,
      roles: await this.links.rolesOf(found),
      expiresAt: found.expiresAt.toISOString(),
      phoneMasked: maskPhone(found.phoneE164),
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
      await this.#bind(principal.userId, token, found, answer, requestId);
      // One more active member in the day's usage (A-02 criterion 17).
      if (answer === 'accepted') await recordGauges(tx, this.clock.now());
    });
  }

  /** On the auth path: the person's phone checked, the link used, the membership bound. */
  #bind(
    userId: string,
    token: string,
    found: ClinicLink,
    answer: Answer,
    requestId: string,
  ): Promise<void> {
    const now = this.clock.now();
    return this.authDb.withUserLink(userId, linkTokenHash(token), async (tx) => {
      // A super admin's account never joins a clinic (OD-89; the database refuses it too).
      const [admin] = await tx
        .select({ id: platformAdmin.userId })
        .from(platformAdmin)
        .where(eq(platformAdmin.userId, userId));
      if (admin) throw linkInvalid();
      // The link first (unused, unreplaced, unexpired), then the person: a dead link never
      // answers anything but link_invalid (OD-104).
      const [open] = await tx
        .select({ id: setupLink.id })
        .from(setupLink)
        .where(
          and(
            eq(setupLink.id, found.linkId),
            isNull(setupLink.usedAt),
            isNull(setupLink.replacedAt),
            gt(setupLink.expiresAt, now),
          ),
        );
      if (!open) throw linkInvalid();
      const [person] = await tx
        .select({ phone: user.phoneNumber })
        .from(user)
        .where(eq(user.id, userId));
      // Someone else signed in: told so, nothing written; the link stays usable (OD-104).
      if (person?.phone !== found.phoneE164) throw new ApiError(403, 'invitation_other_phone');
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
      if (answer === 'accepted') {
        const bound = await tx
          .update(membership)
          .set({ userId, status: 'active', updatedAt: now })
          .where(eq(membership.id, found.membershipId))
          .returning({ id: membership.id });
        if (bound.length !== 1) throw linkInvalid();
      }
      // Recorded on the auth path too, so the binding is audited even if the clinic's
      // transaction failed after this one committed (security review N1).
      await this.audit.record(
        { event: 'auth.link_used', data: { purpose: 'invitation' } },
        { actorId: userId, targetId: found.membershipId, requestId },
        tx,
      );
    });
  }

  async #invitation(token: string): Promise<ClinicLink> {
    const found = await this.links.findClinicLink(token);
    if (found.purpose !== 'invitation' || found.boundUserId !== null) throw linkInvalid();
    return found;
  }
}
