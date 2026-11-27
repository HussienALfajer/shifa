// The SupportAuditPort (A-02 criterion 14): one `support.request` row in the clinic per request of a
// support session, written by the guard before any other check in its own transaction (not READ
// ONLY: it is the audit, not the request's work), so refused writes are recorded too. The row holds
// the method, the route template and the grant id, with the path's id as its target: never a body,
// a query string or a header.
import { Inject, Injectable } from '@nestjs/common';
import { auditEvent, type ShifaDb } from '@shifa/db';
import type { Principal, SupportAuditPort, SupportRequest } from '../../access/index.ts';
import { SHIFA_DB } from '../../platform/database.module.ts';

/** A request id as the API issues it; anything else is left out of the row. */
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

@Injectable()
export class SupportRequestAudit implements SupportAuditPort {
  constructor(@Inject(SHIFA_DB) private readonly db: ShifaDb) {}

  async recordRequest(principal: Principal, request: SupportRequest): Promise<void> {
    const tenantId = principal.tenantId;
    const grantId = principal.support?.grantId;
    if (tenantId === null || grantId === undefined) throw new Error('not a support principal');
    await this.db.withTenant({ tenantId, userId: principal.userId }, (tx) =>
      tx.insert(auditEvent).values({
        tenantId,
        actorId: principal.userId,
        targetId: request.targetId,
        event: 'support.request',
        requestId:
          request.requestId && REQUEST_ID.test(request.requestId) ? request.requestId : null,
        data: { grantId, method: request.method, route: request.route.slice(0, 200) },
      }),
    );
  }
}
