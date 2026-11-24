// The signed-in person's own account (A-01a criteria 10a, 10b; OD-92): their profile, and the
// change of their password. The current password is verified with Better Auth's scrypt (as at
// sign-in) after the attempt is reserved in the sign-in throttle, so wrong passwords here count
// toward the phone lock of criterion 7 and a lock blocks both. On success, in one transaction:
// the hash replaced, every other session ended (`password_changed`) and the change audited; then
// this session is rotated, keeping its clinic, its absolute limit and its second factor.
import { randomUUID } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { MyProfile, SessionView } from '@shifa/contracts';
import { type AuthDb, account, session, user } from '@shifa/db';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { and, eq, ne, sql } from 'drizzle-orm';
import { type Principal, SessionExpiredError } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { ApiError } from '../../platform/errors.ts';
import { setPassword } from './accounts.ts';
import { IdentityAudit } from './identity-audit.ts';
import { checkPasswordRules, type PasswordProblem } from './password-rules.ts';
import { SessionIssuer } from './session-issuer.ts';
import { SessionsService } from './sessions.service.ts';
import { type Lock, ThrottleService } from './throttle.service.ts';
import { AUTH_DB } from './tokens.ts';

const PASSWORD_ERRORS: Record<PasswordProblem, () => ApiError> = {
  too_short: () => new ApiError(400, 'password_too_short'),
  // Longer than 128 is refused by the contract first; the same code for the rest.
  too_long: () => new ApiError(400, 'password_too_short'),
  common: () => new ApiError(400, 'password_common'),
  contains_phone: () => new ApiError(400, 'password_contains_phone'),
};

export interface PasswordChangeMeta {
  requestId: string;
  ip: string;
}

@Injectable()
export class AccountService implements OnModuleInit {
  /** A scrypt hash of a random value: verified when no hash is stored, so scrypt always runs. */
  #dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.#dummyHash = await hashPassword(randomUUID());
  }

  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ThrottleService) private readonly throttle: ThrottleService,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(SessionIssuer) private readonly issuer: SessionIssuer,
  ) {}

  /** The caller's own row only: the id comes from the principal, never from the request. */
  async profile(principal: Principal): Promise<MyProfile> {
    const [row] = await this.authDb.withAuth((tx) =>
      tx
        .select({ name: user.name, phone: user.phoneNumber })
        .from(user)
        .where(eq(user.id, principal.userId)),
    );
    if (!row) throw new SessionExpiredError();
    return { userId: principal.userId, name: row.name, phoneE164: row.phone ?? '' };
  }

  async changePassword(
    principal: Principal,
    currentPassword: string,
    newPassword: string,
    meta: PasswordChangeMeta,
  ): Promise<{ view: SessionView; cookie: string }> {
    const ids = {
      actorId: principal.userId,
      targetId: principal.userId,
      requestId: meta.requestId,
    };
    const [person] = await this.authDb.withAuth((tx) =>
      tx
        .select({ phone: user.phoneNumber, hash: account.password })
        .from(user)
        .leftJoin(account, and(eq(account.userId, user.id), eq(account.providerId, 'credential')))
        .where(eq(user.id, principal.userId)),
    );
    if (!person?.phone) throw new SessionExpiredError();
    const keys = { phone: person.phone, ip: meta.ip };
    // Reserved before the password is checked, as at sign-in: parallel attempts cannot outrun it.
    const { refused, started } = await this.throttle.reserve(keys, this.clock.now());
    if (refused) {
      await this.#auditLocks(started, principal.userId, meta.requestId);
      throw lockError(refused);
    }
    // Every signed-in person has a password (set through their link); scrypt runs either way.
    const valid = await verifyPassword({
      hash: person.hash ?? this.#dummyHash,
      password: currentPassword,
    });
    if (!valid) {
      await this.audit.record({ event: 'auth.password_change_failed' }, ids);
      await this.#auditLocks(started, principal.userId, meta.requestId);
      const lock = started.find((l) => l.kind === 'phone') ?? started[0];
      if (lock) throw lockError(lock);
      throw new ApiError(401, 'invalid_credentials');
    }
    await this.throttle.succeeded(keys, started);

    if (newPassword === currentPassword) throw new ApiError(400, 'password_unchanged');
    const problem = checkPasswordRules(newPassword, person.phone);
    if (problem) throw PASSWORD_ERRORS[problem]();

    const hash = await hashPassword(newPassword);
    const now = this.clock.now();
    const current = principal.sessionId;
    await this.authDb.withAuth(async (tx) => {
      // Two changes by one person at once run one after the other; the second finds its
      // session ended by the first and changes nothing (review N4).
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('shifa.password:' || ${principal.userId}, 0))`,
      );
      const [own] = current
        ? await tx.select({ id: session.id }).from(session).where(eq(session.id, current))
        : [];
      if (!own) throw new SessionExpiredError();
      await setPassword(tx, principal.userId, hash, now);
      const ended = await tx
        .delete(session)
        .where(
          and(eq(session.userId, principal.userId), current ? ne(session.id, current) : undefined),
        )
        .returning({ id: session.id });
      for (const row of ended) {
        await this.audit.record(
          { event: 'auth.session_ended', data: { reason: 'password_changed' } },
          { ...ids, targetId: row.id },
          tx,
        );
      }
      await this.audit.record({ event: 'auth.password_changed' }, ids, tx);
    });

    const issued = await this.issuer.rotate(
      principal,
      meta.requestId,
      principal.mfa === 'verified',
    );
    const next = await this.sessions.authenticate(issued.token, meta.requestId);
    if (!next) throw new Error('the rotated session was not found');
    return { view: await this.sessions.view(next), cookie: issued.cookie };
  }

  /** One auth.locked row per lock this attempt started; the person as target of a phone lock. */
  async #auditLocks(started: Lock[], userId: string, requestId: string): Promise<void> {
    for (const lock of started) {
      await this.audit.record(
        { event: 'auth.locked', data: { kind: lock.kind } },
        { actorId: null, targetId: lock.kind === 'phone' ? userId : null, requestId },
      );
    }
  }
}

function lockError(lock: Lock): ApiError {
  return new ApiError(429, lock.kind === 'ip' ? 'ip_blocked' : 'phone_locked', lock.until);
}
