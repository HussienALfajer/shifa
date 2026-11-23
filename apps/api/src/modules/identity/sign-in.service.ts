// Sign-in (A-01a criteria 6–9): phone normalised to E.164, locks checked first, the password
// verified by Better Auth, one answer for a wrong phone or password with comparable timing (an
// unknown phone verifies a dummy scrypt hash), failures counted, every outcome audited, and the
// session cookie rotated (a session presented with the request is ended).
import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { normalisePhone, type SessionView, type SignInRequest } from '@shifa/contracts';
import { type AuthDb, user } from '@shifa/db';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';
import type { ShifaAuth } from './better-auth.ts';
import { IdentityAudit } from './identity-audit.ts';
import { sessionCookieLine, verifySessionCookie } from './session-cookie.ts';
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
    const now = this.clock.now();
    const lock = await this.throttle.lockFor(keys, now);
    if (lock) {
      const reason = lock.kind === 'ip' ? 'ip_blocked' : 'phone_locked';
      await this.audit.record(
        { event: 'auth.sign_in_failed', data: { reason } },
        { actorId: null, targetId: null, requestId: meta.requestId },
      );
      // An attempt on a locked phone still counts against the IP (a locked account sprayed from
      // one address trips the IP block); it never extends the phone's lock.
      if (lock.kind === 'phone') {
        const started = await this.throttle.recordFailure(keys, now, ['ip']);
        await this.#auditLocks(started, null, meta.requestId);
      }
      throw lockError(lock);
    }

    const [person] = await this.authDb.withAuth((tx) =>
      tx.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phone.e164)).limit(1),
    );
    if (!person) {
      await verifyPassword({ hash: this.#dummyHash, password: input.password });
      return this.#fail(keys, null, meta.requestId);
    }

    let result: Awaited<ReturnType<typeof this.callBetterAuth>>;
    try {
      result = await this.callBetterAuth(phone.e164, input.password, meta.userAgent);
    } catch (err) {
      if (isUnauthorized(err)) return this.#fail(keys, person.id, meta.requestId);
      throw err;
    }
    const cookie = sessionCookieLine(result.headers);
    if (!cookie) throw new Error('Better Auth set no session cookie');

    await this.throttle.clearPhone(phone.e164);
    const presented = verifySessionCookie(meta.presentedCookie, this.secrets.betterAuthSecret);
    if (presented && presented !== result.response.token) {
      await this.sessions.endByToken(presented, meta.requestId);
    }
    const principal = await this.sessions.authenticate(result.response.token, meta.requestId);
    if (!principal?.sessionId) throw new Error('the new session was not found');
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

  /** Counts the failure, audits it (and any lock it starts), and answers 401 or 429. */
  async #fail(
    keys: { phone: string; ip: string },
    targetId: string | null,
    requestId: string,
  ): Promise<never> {
    const started = await this.throttle.recordFailure(keys, this.clock.now());
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
