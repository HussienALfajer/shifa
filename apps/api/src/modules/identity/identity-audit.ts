// Identity audit rows (PLT-47, A-01a criterion 14): sign-in success and failure, locks and session
// ends, written on the auth path with a null tenant (a person signs in before any clinic is
// known). Only ids, the event, the request id and one allowlisted detail: never a phone, a token,
// an address or a password.
import { Inject, Injectable } from '@nestjs/common';
import { type AuthDb, auditEvent, type Tx } from '@shifa/db';
import { AUTH_DB } from './tokens.ts';

export type FailureReason = 'invalid_credentials' | 'phone_locked' | 'ip_blocked';
export type SessionEndReason =
  | 'sign_out'
  | 'ended'
  | 'ended_others'
  | 'replaced'
  | 'idle'
  | 'absolute';

/** The allowlisted `data` of each event; nothing else can be written. */
export type IdentityEvent =
  | { event: 'auth.sign_in' }
  | { event: 'auth.sign_in_failed'; data: { reason: FailureReason } }
  | { event: 'auth.locked'; data: { kind: 'phone' | 'ip' } }
  | { event: 'auth.session_ended'; data: { reason: SessionEndReason } };

export interface AuditIds {
  actorId: string | null;
  targetId: string | null;
  requestId: string;
}

/** Request ids the API generates (UUIDs); anything else is left out rather than refused. */
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

@Injectable()
export class IdentityAudit {
  constructor(@Inject(AUTH_DB) private readonly authDb: AuthDb) {}

  /** Writes one row, in `tx` when given (same transaction as the change it records). */
  async record(entry: IdentityEvent, ids: AuditIds, tx?: Tx): Promise<void> {
    const write = (t: Tx) =>
      t.insert(auditEvent).values({
        tenantId: null,
        actorId: ids.actorId,
        targetId: ids.targetId,
        event: entry.event,
        requestId: REQUEST_ID.test(ids.requestId) ? ids.requestId : null,
        data: 'data' in entry ? entry.data : {},
      });
    if (tx) {
      await write(tx);
      return;
    }
    await this.authDb.withAuth(write);
  }
}
