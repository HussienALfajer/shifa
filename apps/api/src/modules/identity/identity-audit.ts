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
  | 'absolute'
  | 'rotated'
  /** A super admin ended every session of an owner (owner support, A-01a criterion 13). */
  | 'admin'
  /** The clinic deactivated the member, removed their roles or issued a new link (A-01b 3, 4). */
  | 'member'
  /** The person changed their password: every other session ends (OD-92). */
  | 'password_changed'
  /** A support session's grant ended or expired (A-02-05), or a new hand-off replaced it. */
  | 'support_ended';

/** The allowlisted `data` of each event; nothing else can be written. */
export type IdentityEvent =
  | { event: 'auth.sign_in' }
  | { event: 'auth.sign_in_failed'; data: { reason: FailureReason } }
  | { event: 'auth.locked'; data: { kind: 'phone' | 'ip' } }
  | { event: 'auth.session_ended'; data: { reason: SessionEndReason } }
  // A-01-03: setup links and MFA (target: the membership or person; never a token or code)
  | {
      event: 'auth.link_used';
      data: { purpose: 'owner_setup' | 'member_setup' | 'invitation' | 'admin_setup' };
    }
  | { event: 'auth.mfa_enrolled' }
  | { event: 'auth.mfa_passed'; data: { method: 'totp' | 'recovery' } }
  | { event: 'auth.mfa_locked' }
  // Owner support by a super admin (actor), each also ending the owner's sessions.
  | { event: 'auth.mfa_reset' }
  | { event: 'auth.password_reset' }
  | { event: 'auth.recovery_code_used' }
  // A-01-09: own password and recovery codes (actor and target: the person).
  | { event: 'auth.password_changed' }
  | { event: 'auth.password_change_failed' }
  | { event: 'auth.recovery_codes_renewed' }
  // A-01-11: TOTP moved to a new phone (OD-98; actor and target: the person).
  | { event: 'auth.mfa_reenrolled' }
  // A-02-05 (target: the grant; actor: its super admin): a hand-off opened a support session; a
  // support session found its grant expired and closed it (`support.expired`, once).
  | { event: 'support.session_started' }
  | { event: 'support.expired'; data: { endedBy: 'expiry' } };

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
