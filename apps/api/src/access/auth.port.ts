// How the guard learns who is calling. Production: BetterAuthAdapter (modules/identity, A-01-02),
// wired by AppModule; NoAuthAdapter authenticates nobody and stays for tests.
//
// The AuthPort contract (A-01a criterion 15):
// - `authenticate()` returns a principal that passes PrincipalSchema (principal.ts), or null when
//   the request carries no valid credential (→ 401 `unauthorized`);
// - the principal's branch belongs to its tenant and its roles come from server-side memberships
//   of that tenant, read by the adapter for every request (never from the client);
// - `userId` is an opaque UUID (it is logged);
// - a credential that was valid but has run out, or whose session is gone, throws
//   SessionExpiredError (→ 401 `session_expired` with `reason` idle, absolute or ended), so the
//   client returns to sign-in and says why;
// - errors thrown by an adapter never carry a token, a cookie or a phone, in their message or
//   their cause.
import { Injectable } from '@nestjs/common';
import type { SessionEndReason } from '@shifa/contracts';
import type { FastifyRequest } from 'fastify';
import { ApiError } from '../platform/errors.ts';
import type { Principal } from './principal.ts';

export const AUTH_PORT = Symbol('AUTH_PORT');

export interface AuthPort {
  /** The caller's principal, or null when the request is not authenticated. */
  authenticate(request: FastifyRequest): Promise<Principal | null>;
}

/**
 * A session ended by its idle or absolute limit, or ended elsewhere (another device, the owner,
 * the super admin, a change of password): 401 with the reason (A-01a criterion 9).
 */
export class SessionExpiredError extends ApiError {
  constructor(reason: SessionEndReason = 'ended') {
    super(401, 'session_expired', undefined, reason);
  }
}

@Injectable()
export class NoAuthAdapter implements AuthPort {
  authenticate(): Promise<Principal | null> {
    return Promise.resolve(null);
  }
}
