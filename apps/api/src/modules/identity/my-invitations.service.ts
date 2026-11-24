// Pending invitations in the clinic chooser (OD-90): the signed-in person's open invitations,
// found on the auth path by their account's phone (clinic name and roles only), and accepted or
// declined by id with the link path's checks (phone, never a super admin, an open link), which
// closes the clinic's link. Anything else, someone else's invitation included, answers 404
// `link_invalid`. The clinic's name and roles, and its audit row, are read and written in the
// invitation's clinic (linkScope: the documented exception, the invitation being verified on
// the auth path first), around the auth step, as the link path does.
import { Inject, Injectable } from '@nestjs/common';
import type { MyInvitation } from '@shifa/contracts';
import {
  type AuthDb,
  auditEvent,
  membership,
  platformAdmin,
  type ShifaDb,
  setupLink,
  type Tx,
  tenant,
} from '@shifa/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { linkScope, withScope } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { SHIFA_DB } from '../../platform/database.module.ts';
import { IdentityAudit } from './identity-audit.ts';
import { linkInvalid, SetupLinksService } from './setup-links.service.ts';
import { AUTH_DB } from './tokens.ts';

type Answer = 'accepted' | 'declined';

interface Open {
  membershipId: string;
  tenantId: string;
  expiresAt: Date;
}

@Injectable()
export class MyInvitations {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(SHIFA_DB) private readonly db: ShifaDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SetupLinksService) private readonly links: SetupLinksService,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
  ) {}

  async list(userId: string): Promise<MyInvitation[]> {
    const open = await this.authDb.withUser(userId, (tx) => openInvitations(tx, this.clock.now()));
    const out: MyInvitation[] = [];
    for (const found of open) {
      const scope = linkScope({ tenantId: found.tenantId, userId });
      const [clinic] = await withScope(this.db, scope, (tx) =>
        tx.select({ name: tenant.name }).from(tenant).where(eq(tenant.id, found.tenantId)),
      );
      out.push({
        id: found.membershipId,
        clinicName: clinic?.name ?? '',
        roles: await this.links.rolesOf(found),
        expiresAt: found.expiresAt.toISOString(),
      });
    }
    return out.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  }

  accept(userId: string, membershipId: string, requestId: string): Promise<void> {
    return this.#answer(userId, membershipId, 'accepted', requestId);
  }

  decline(userId: string, membershipId: string, requestId: string): Promise<void> {
    return this.#answer(userId, membershipId, 'declined', requestId);
  }

  async #answer(
    userId: string,
    membershipId: string,
    answer: Answer,
    requestId: string,
  ): Promise<void> {
    const now = this.clock.now();
    const found = (
      await this.authDb.withUser(userId, (tx) => openInvitations(tx, now, membershipId))
    )[0];
    if (!found) throw linkInvalid();
    const scope = linkScope({ tenantId: found.tenantId, userId });
    await withScope(this.db, scope, async (tx) => {
      await tx.insert(auditEvent).values({
        tenantId: found.tenantId,
        actorId: userId,
        targetId: membershipId,
        event: answer === 'accepted' ? 'member.invitation_accepted' : 'member.invitation_declined',
        requestId,
        data: {},
      });
      await this.#bind(userId, found, answer, requestId);
    });
  }

  /** On the auth path: bound while the link is open (the policy checks it), then the link used. */
  #bind(userId: string, found: Open, answer: Answer, requestId: string): Promise<void> {
    const now = this.clock.now();
    return this.authDb.withUser(userId, async (tx) => {
      // A super admin's account never joins a clinic (OD-89; the database refuses it too).
      const [admin] = await tx
        .select({ id: platformAdmin.userId })
        .from(platformAdmin)
        .where(eq(platformAdmin.userId, userId));
      if (admin) throw linkInvalid();
      if (answer === 'accepted') {
        const bound = await tx
          .update(membership)
          .set({ userId, status: 'active', updatedAt: now })
          .where(and(eq(membership.id, found.membershipId), isNull(membership.userId)))
          .returning({ id: membership.id });
        if (bound.length !== 1) throw linkInvalid();
      }
      // Every open invitation link of this membership closes (normally one).
      const used = await tx
        .update(setupLink)
        .set({ usedAt: now })
        .where(
          and(
            eq(setupLink.tenantId, found.tenantId),
            eq(setupLink.membershipId, found.membershipId),
            eq(setupLink.purpose, 'invitation'),
            isNull(setupLink.usedAt),
            isNull(setupLink.replacedAt),
            gt(setupLink.expiresAt, now),
          ),
        )
        .returning({ id: setupLink.id });
      if (used.length === 0) throw linkInvalid();
      await this.audit.record(
        { event: 'auth.link_used', data: { purpose: 'invitation' } },
        { actorId: userId, targetId: found.membershipId, requestId },
        tx,
      );
    });
  }
}

/** Under withUser(): the person's open invitations (the policies already require them). */
async function openInvitations(tx: Tx, now: Date, membershipId?: string): Promise<Open[]> {
  const rows = await tx
    .select({
      membershipId: membership.id,
      tenantId: membership.tenantId,
      expiresAt: setupLink.expiresAt,
    })
    .from(membership)
    .innerJoin(
      setupLink,
      and(eq(setupLink.tenantId, membership.tenantId), eq(setupLink.membershipId, membership.id)),
    )
    .where(
      and(
        isNull(membership.userId),
        eq(membership.status, 'pending'),
        membershipId === undefined ? undefined : eq(membership.id, membershipId),
        eq(setupLink.purpose, 'invitation'),
        isNull(setupLink.usedAt),
        isNull(setupLink.replacedAt),
        gt(setupLink.expiresAt, now),
      ),
    );
  // One entry per membership: the latest expiry of its open links.
  const byMember = new Map<string, Open>();
  for (const row of rows) {
    const seen = byMember.get(row.membershipId);
    if (!seen || seen.expiresAt < row.expiresAt) byMember.set(row.membershipId, row);
  }
  return [...byMember.values()];
}
