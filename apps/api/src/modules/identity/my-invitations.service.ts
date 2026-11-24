// Pending invitations in the clinic chooser (OD-90, OD-91): the signed-in person's open
// invitations, found on the auth path by their account's phone, shown with the clinic's name and
// the roles only. They are accepted or declined on the invitation's own link (InvitationsService):
// phones are unverified until A-09, so a phone alone never answers one. The clinic's name and
// roles are read in the invitation's clinic (linkScope: the documented exception, the invitation
// being found on the auth path first), as the link page does.
import { Inject, Injectable } from '@nestjs/common';
import type { MyInvitation } from '@shifa/contracts';
import { type AuthDb, membership, type ShifaDb, setupLink, type Tx, tenant } from '@shifa/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { linkScope, withScope } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { SHIFA_DB } from '../../platform/database.module.ts';
import { SetupLinksService } from './setup-links.service.ts';
import { AUTH_DB } from './tokens.ts';

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
}

/** Under withUser(): the person's open invitations (the policies already require them). */
async function openInvitations(tx: Tx, now: Date): Promise<Open[]> {
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
