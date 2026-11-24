// Corrections of what the owner typed (A-01b criterion 3, OD-103): any member's name, and a
// pending member's phone. The phone edit replaces the earlier links and issues a new one, shown
// once (an invitation when the new phone has an account; the owner sees no difference, OD-76).
// Refused once the member has accepted (`member_account_exists`; the database refuses it too,
// trigger `membership_phone_unbound_only`) or is deactivated. Audited without a name or a phone.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type MemberLinkIssued, normalisePhone } from '@shifa/contracts';
import { membership, setupLink, type Tx } from '@shifa/db';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import { MemberAccounts } from '../identity/index.ts';
import { audit, lockMemberPhone, type MembershipRow, replaceLinks } from './team.writes.ts';

/** The name as typed, trimmed; audited `member.renamed` without the name. */
export async function rename(
  tx: Tx,
  scope: RequestScope,
  row: MembershipRow,
  name: string,
  requestId: string,
): Promise<MembershipRow> {
  const [changed] = await tx
    .update(membership)
    .set({ displayName: name.trim(), updatedAt: new Date() })
    .where(eq(membership.id, row.id))
    .returning();
  if (!changed) throw new NotFoundException();
  await audit(tx, scope, 'member.renamed', row.id, requestId);
  return changed;
}

@Injectable()
export class MemberCorrections {
  constructor(
    @Inject(TenantDb) private readonly tenants: TenantDb,
    @Inject(MemberAccounts) private readonly accounts: MemberAccounts,
  ) {}

  /** A pending member's phone; the same phone again issues a new link (a resend). */
  async changePhone(
    scope: RequestScope,
    id: string,
    input: string,
    requestId: string,
  ): Promise<MemberLinkIssued> {
    const phone = normalisePhone(input);
    if (!phone.ok)
      throw new RequestValidationError([{ path: 'body.phone', code: 'invalid_format' }]);
    const purpose = (await this.accounts.hasAccount(phone.e164)) ? 'invitation' : 'member_setup';
    const link = this.accounts.newLink();
    return this.tenants.run(scope, async (tx) => {
      // The same lock as an add of this phone: one of two writes waits and sees the other.
      await lockMemberPhone(tx, phone.e164);
      // The open links before the membership, in the order accepting or using a link takes them
      // (link, then membership): a phone edit racing an acceptance waits, never deadlocks (review 1).
      await tx
        .select({ id: setupLink.id })
        .from(setupLink)
        .where(
          and(
            eq(setupLink.membershipId, id),
            isNull(setupLink.usedAt),
            isNull(setupLink.replacedAt),
          ),
        )
        .for('update');
      const [row] = await tx.select().from(membership).where(eq(membership.id, id)).for('update');
      if (!row) throw new NotFoundException();
      if (row.userId) throw new ApiError(409, 'member_account_exists');
      if (row.status === 'deactivated') throw new ApiError(409, 'member_deactivated');
      const [taken] = await tx
        .select({ id: membership.id })
        .from(membership)
        .where(and(eq(membership.phoneE164, phone.e164), ne(membership.id, row.id)));
      if (taken) throw new ApiError(409, 'phone_in_team');
      if (row.phoneE164 !== phone.e164) {
        await tx
          .update(membership)
          .set({ phoneE164: phone.e164, updatedAt: new Date() })
          .where(eq(membership.id, row.id));
      }
      await replaceLinks(tx, row.id);
      await tx.insert(setupLink).values({
        tenantId: scope.tenantId,
        membershipId: row.id,
        purpose,
        tokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
        invitedPhone: purpose === 'invitation' ? phone.e164 : null,
      });
      await audit(tx, scope, 'member.phone_changed', row.id, requestId, { linkPurpose: purpose });
      return link.issued;
    });
  }
}
