// The production AuthPort (A-01a criterion 15): the `__Host-shifa.sid` cookie, its signature
// checked before any lookup, the session loaded on the shifa_auth pool with the idle and absolute
// limits, and the principal built from the active tenant's memberships. Contract: access/auth.port.ts.
import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthPort, Principal } from '../../access/index.ts';
import { errorClass } from '../../platform/errors.ts';
import { parseCookies } from '../../platform/request-meta.ts';
import { SESSION_COOKIE, verifySessionCookie } from './session-cookie.ts';
import { SessionsService } from './sessions.service.ts';
import { IDENTITY_CONFIG, type IdentitySecrets } from './tokens.ts';

/** Any failure while authenticating: a fixed message, no cause (no token, cookie or phone). */
export class AuthAdapterError extends Error {
  override name = 'AuthAdapterError';
  constructor() {
    super('authentication failed');
  }
}

@Injectable()
export class BetterAuthAdapter implements AuthPort {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(IDENTITY_CONFIG) private readonly secrets: IdentitySecrets,
  ) {}

  async authenticate(request: FastifyRequest): Promise<Principal | null> {
    const value = parseCookies(request.headers.cookie).get(SESSION_COOKIE);
    const token = verifySessionCookie(value, this.secrets.betterAuthSecret);
    if (token === null) return null;
    try {
      return await this.sessions.authenticate(token, request.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // Class and SQLSTATE only: an error's message or cause may quote the token.
      request.log.error({ err: errorClass(err) }, 'session lookup failed');
      throw new AuthAdapterError();
    }
  }
}
