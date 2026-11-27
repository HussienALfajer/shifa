// The owner's side of support access (A-02 criteria 13, 26; contract rows `banner`, `endAsk`,
// `ended`, `logEmpty`): the clinic's open grants for the banner, every grant for «سجل دخول الدعم»,
// and ending a grant. Tenant data only through TenantDb with the scope the guard checked; the end
// writes the clinic's `support.ended` audit row in the same transaction. In a support session the
// scope is read only (the guard refuses the end first).
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ClinicSupportGrants, SupportGrantView } from '@shifa/contracts';
import { auditEvent, membership, supportAccessGrant } from '@shifa/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { ApiError } from '../../platform/errors.ts';
import { grantColumns, grantView, isOpen } from './grants.ts';

/** A request id as the API issues it; anything else is left out of the audit row. */
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

@Injectable()
export class ClinicSupport {
  constructor(
    @Inject(TenantDb) private readonly tenantDb: TenantDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(scope: RequestScope): Promise<ClinicSupportGrants> {
    const now = this.clock.now();
    const rows = await this.tenantDb.run(scope, (tx) =>
      tx.select(grantColumns).from(supportAccessGrant).orderBy(desc(supportAccessGrant.openedAt)),
    );
    return {
      now: now.toISOString(),
      open: rows
        .filter((r) => isOpen(r, now))
        .map((r) => ({
          id: r.id,
          adminName: r.adminName,
          reason: r.reason,
          expiresAt: r.expiresAt.toISOString(),
        })),
      grants: rows.map((r) => grantView(r, now)),
    };
  }

  end(scope: RequestScope, grantId: string, requestId: string): Promise<SupportGrantView> {
    return this.tenantDb.run(scope, async (tx) => {
      const now = this.clock.now();
      const [row] = await tx
        .select(grantColumns)
        .from(supportAccessGrant)
        .where(eq(supportAccessGrant.id, grantId));
      if (!row) throw new NotFoundException();
      if (!isOpen(row, now)) throw new ApiError(409, 'support_ended');
      const [me] = await tx
        .select({ name: membership.displayName })
        .from(membership)
        .where(and(eq(membership.userId, scope.userId), eq(membership.status, 'active')));
      // The policy lets an owner end only an open grant, as themselves.
      const [ended] = await tx
        .update(supportAccessGrant)
        .set({
          endedAt: now,
          endedBy: scope.userId,
          endedByName: (me?.name ?? 'المالك').slice(0, 200),
          endReason: 'owner',
        })
        .where(and(eq(supportAccessGrant.id, grantId), isNull(supportAccessGrant.endedAt)))
        .returning(grantColumns);
      if (!ended) throw new ApiError(409, 'support_ended');
      await tx.insert(auditEvent).values({
        tenantId: scope.tenantId,
        actorId: scope.userId,
        targetId: grantId,
        event: 'support.ended',
        requestId: REQUEST_ID.test(requestId) ? requestId : null,
        data: { endedBy: 'owner' },
      });
      return grantView(ended, now);
    });
  }
}
