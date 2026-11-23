// Sign-in (A-01a criteria 6–9): phone normalised to E.164, locks checked first, the password
// verified by Better Auth, one answer for a wrong phone or password with comparable timing (an
// unknown phone verifies a dummy scrypt hash), failures counted, every outcome audited, and the
// session cookie rotated (a session presented with the request is ended).
import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { normalisePhone, type SessionView, type SignInRequest } from '@shifa/contracts';
import { type AuthDb, account, user } from '@shifa/db';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import type { ShifaAuth } from './better-auth.ts';
import { IdentityAudit } from './identity-audit.ts';
import { SESSION_COOKIE, sessionCookieLine, verifySessionCookie } from './session-cookie.ts';
import { SessionsService } from './sessions.service.ts';
import { type Lock, ThrottleService } from './throttle.service.ts';
import { AUTH_DB, BETTER_AUTH, IDENTITY_CONFIG, type IdentitySecrets } from './tokens.ts';

export interface SignInMeta {
  requestId: string;
  ip: string;
  userAgent: string | undefined;
  /** The session cookie sent with the request, if any (ended on success: rotation). */
  presentedCookie: string | undefined;
}

export interface SignedIn {
  view: SessionView;
  /** Set-Cookie line of the new session. */
  cookie: string;
}

/** Better Auth answers a wrong password with an APIError of status 401. */
function isUnauthorized(err: unknown): boolean {
  const status = (err as { statusCode?: unknown; status?: unknown } | null)?.statusCode;
  return status === 401;
}

@Injectable()
export class SignInService implements OnModuleInit {
  /** A scrypt hash of a random value, verified for unknown phones so timing stays comparable. */
  #dummyHash = '';

  constructor(
    @Inject(BETTER_AUTH) private readonly auth: ShifaAuth,
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(IDENTITY_CONFIG) private readonly secrets: IdentitySecrets,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ThrottleService) private readonly throttle: ThrottleService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
  ) {}

  async onModuleInit(): Promise<void> {
    this.#dummyHash = await hashPassword(randomUUID());
  }

  async signIn(input: SignInRequest, meta: SignInMeta): Promise<SignedIn> {
    const phone = normalisePhone(input.phone);
    if (!phone.ok)
      throw new RequestValidationError([{ path: 'body.phone', code: 'invalid_format' }]);
    const keys = { phone: phone.e164, ip: meta.ip };
    // Counted before any password is checked, so parallel attempts cannot outrun the limit.
    const { refused, started } = await this.throttle.reserve(keys, this.clock.now());
    if (refused) {
      const reason = refused.kind === 'ip' ? 'ip_blocked' : 'phone_locked';
      await this.audit.record(
        { event: 'auth.sign_in_failed', data: { reason } },
        { actorId: null, targetId: null, requestId: meta.requestId },
      );
      await this.#auditLocks(started, null, meta.requestId);
      throw lockError(refused);
    }

    // A person without a password yet (an owner before the setup link) verifies the dummy hash
    // too: no account state is told apart by timing.
    const [person] = await this.authDb.withAuth((tx) =>
      tx
        .select({ id: user.id, password: account.password })
        .from(user)
        .leftJoin(account, and(eq(account.userId, user.id), eq(account.providerId, 'credential')))
        .where(eq(user.phoneNumber, phone.e164))
        .limit(1),
    );
    if (!person?.password) {
      await verifyPassword({ hash: this.#dummyHash, password: input.password });
      return this.#fail(started, person?.id ?? null, meta.requestId);
    }

    // A wrong password is Better Auth's 401; anything else is a real failure.
    const result = await this.callBetterAuth(phone.e164, input.password, meta.userAgent).catch(
      (err: unknown) => {
        if (isUnauthorized(err)) return null;
        throw err;
      },
    );
    if (!result) return this.#fail(started, person.id, meta.requestId);
    // With TOTP enrolled, Better Auth answers a second-factor redirect and no session: the
    // challenge route comes in A-01-03, and no route can enrol TOTP before it.
    if ('twoFactorRedirect' in (result.response as object)) {
      throw new Error('two-factor sign-in is not available before A-01-03');
    }
    const token = result.response.token;
    const cookie = sessionCookieLine(result.headers);
    if (!token || !cookie || cookie.startsWith(`${SESSION_COOKIE}=;`)) {
      throw new Error('Better Auth set no session');
    }

    await this.throttle.succeeded(keys, started);
    const presented = verifySessionCookie(meta.presentedCookie, this.secrets.betterAuthSecret);
    const principal = await this.sessions.authenticate(token, meta.requestId);
    if (!principal?.sessionId) throw new Error('the new session was not found');
    if (presented && presented !== token) {
      await this.sessions.endByToken(presented, principal.userId, meta.requestId);
    }
    await this.audit.record(
      { event: 'auth.sign_in' },
      { actorId: principal.userId, targetId: principal.sessionId, requestId: meta.requestId },
    );
    return { view: await this.sessions.view(principal), cookie };
  }

  private callBetterAuth(phoneE164: string, password: string, userAgent: string | undefined) {
    return this.auth.api.signInPhoneNumber({
      body: { phoneNumber: phoneE164, password },
      headers: new Headers(userAgent ? { 'user-agent': userAgent.slice(0, 512) } : {}),
      returnHeaders: true,
    });
  }

  /** Audits the failure (and any lock this attempt set) and answers 401, or 429 for a new lock. */
  async #fail(started: Lock[], targetId: string | null, requestId: string): Promise<never> {
    await this.audit.record(
      { event: 'auth.sign_in_failed', data: { reason: 'invalid_credentials' } },
      { actorId: null, targetId, requestId },
    );
    await this.#auditLocks(started, targetId, requestId);
    const lock = started.find((l) => l.kind === 'ip') ?? started[0];
    if (lock) throw lockError(lock);
    throw new ApiError(401, 'invalid_credentials');
  }

  /** One auth.locked row per lock a failure started; the person as target of a phone lock. */
  async #auditLocks(started: Lock[], targetId: string | null, requestId: string): Promise<void> {
    for (const lock of started) {
      await this.audit.record(
        { event: 'auth.locked', data: { kind: lock.kind } },
        { actorId: null, targetId: lock.kind === 'phone' ? targetId : null, requestId },
      );
    }
  }
}

function lockError(lock: Lock): ApiError {
  return new ApiError(429, lock.kind === 'ip' ? 'ip_blocked' : 'phone_locked', lock.until);
}
