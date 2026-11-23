// Opening and using a setup link (A-01a criteria 4, 5): found by the SHA-256 of its token alone
// (withSetupLink for a clinic link, the verification table for a super admin's), one answer
// (404 `link_invalid`) for used, expired, replaced and unknown links, the password rules named
// on refusal, and on success: the password set, the link used, the membership bound, one audit
// row, and a new session at mfa 'none' (the guard then allows enrolment only).
import { Inject, Injectable } from '@nestjs/common';
import type { SessionView, SetupLinkView } from '@shifa/contracts';
import { type AuthDb, membership, setupLink, type Tx, tenant, user, verification } from '@shifa/db';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { ApiError } from '../../platform/errors.ts';
import { createPerson, setPassword, userIdByPhone } from './accounts.ts';
import { IdentityAudit } from './identity-audit.ts';
import { ADMIN_SETUP_IDENTIFIER, linkTokenHash } from './links.ts';
import { checkPasswordRules, type PasswordProblem } from './password-rules.ts';
import { SessionIssuer } from './session-issuer.ts';
import { SessionsService } from './sessions.service.ts';
import { AUTH_DB } from './tokens.ts';

type Found =
  | {
      kind: 'clinic';
      linkId: string;
      purpose: 'owner_setup' | 'member_setup' | 'invitation';
      membershipId: string;
      boundUserId: string | null;
      clinicName: string;
      personName: string;
      phoneE164: string;
      expiresAt: Date;
    }
  | {
      kind: 'admin';
      verificationId: string;
      userId: string;
      personName: string;
      phoneE164: string;
      expiresAt: Date;
    };

const PASSWORD_ERRORS: Record<PasswordProblem, ApiError> = {
  too_short: new ApiError(400, 'password_too_short'),
  // Longer than 128 is refused by the contract before this; same code for the rare rest.
  too_long: new ApiError(400, 'password_too_short'),
  common: new ApiError(400, 'password_common'),
  contains_phone: new ApiError(400, 'password_contains_phone'),
};

const linkInvalid = () => new ApiError(404, 'link_invalid');

export interface ConsumeMeta {
  requestId: string;
  userAgent: string | undefined;
}

@Injectable()
export class SetupLinksService {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(SessionIssuer) private readonly issuer: SessionIssuer,
  ) {}

  async view(token: string): Promise<SetupLinkView> {
    const found = await this.#find(token);
    if (found.kind === 'admin') {
      return {
        clinicName: null,
        personName: found.personName,
        role: 'platform_admin',
        purpose: 'admin_setup',
        expiresAt: found.expiresAt.toISOString(),
      };
    }
    return {
      clinicName: found.clinicName,
      personName: found.personName,
      // Only owner links exist before A-01-04 (member links and invitations of staff).
      role: 'owner',
      purpose: found.purpose,
      expiresAt: found.expiresAt.toISOString(),
    };
  }

  async consume(
    token: string,
    password: string,
    meta: ConsumeMeta,
  ): Promise<{ view: SessionView; cookie: string }> {
    const found = await this.#find(token);
    // An invitation is accepted by a signed-in person (A-01-04), never by setting a password.
    if (found.kind === 'clinic' && found.purpose !== 'owner_setup') {
      throw new ApiError(409, 'conflict');
    }
    const problem = checkPasswordRules(password, found.phoneE164);
    if (problem) throw PASSWORD_ERRORS[problem];
    const hash = await hashPassword(password);
    const userId =
      found.kind === 'clinic'
        ? await this.#useClinicLink(token, found, hash, meta.requestId)
        : await this.#useAdminLink(found, hash, meta.requestId);

    const issued = await this.issuer.issue(userId, { userAgent: meta.userAgent });
    const principal = await this.sessions.authenticate(issued.token, meta.requestId);
    if (!principal) throw new Error('the new session was not found');
    return { view: await this.sessions.view(principal), cookie: issued.cookie };
  }

  async #useClinicLink(
    token: string,
    found: Extract<Found, { kind: 'clinic' }>,
    hash: string,
    requestId: string,
  ): Promise<string> {
    const now = this.clock.now();
    return this.authDb.withSetupLink(linkTokenHash(token), async (tx) => {
      // The policy lets only an unused, unreplaced, unexpired link be marked: a second use of
      // the same link in parallel updates nothing.
      const used = await tx
        .update(setupLink)
        .set({ usedAt: now })
        .where(and(eq(setupLink.id, found.linkId), isNull(setupLink.usedAt)))
        .returning({ id: setupLink.id });
      if (used.length === 0) throw linkInvalid();
      let userId = found.boundUserId;
      if (userId) {
        // A new link for a set-up owner: the password is reset.
        await setPassword(tx, userId, hash, now);
      } else {
        // An account with this phone appeared since the link was issued: never take it over.
        if ((await userIdByPhone(tx, found.phoneE164)) !== null)
          throw new ApiError(409, 'conflict');
        userId = await createPerson(tx, {
          name: found.personName,
          phoneE164: found.phoneE164,
          now,
        });
        await setPassword(tx, userId, hash, now);
        const bound = await tx
          .update(membership)
          .set({ userId, status: 'active', updatedAt: now })
          .where(eq(membership.id, found.membershipId))
          .returning({ id: membership.id });
        if (bound.length !== 1) throw linkInvalid();
      }
      await this.audit.record(
        { event: 'auth.link_used', data: { purpose: 'owner_setup' } },
        { actorId: userId, targetId: found.membershipId, requestId },
        tx,
      );
      return userId;
    });
  }

  async #useAdminLink(
    found: Extract<Found, { kind: 'admin' }>,
    hash: string,
    requestId: string,
  ): Promise<string> {
    const now = this.clock.now();
    return this.authDb.withAuth(async (tx) => {
      const used = await tx
        .delete(verification)
        .where(eq(verification.id, found.verificationId))
        .returning({ id: verification.id });
      if (used.length === 0) throw linkInvalid();
      await setPassword(tx, found.userId, hash, now);
      await this.audit.record(
        { event: 'auth.link_used', data: { purpose: 'admin_setup' } },
        { actorId: found.userId, targetId: found.userId, requestId },
        tx,
      );
      return found.userId;
    });
  }

  /** The valid link of this token, or 404 `link_invalid`; never says why. */
  async #find(token: string): Promise<Found> {
    const now = this.clock.now();
    const hash = linkTokenHash(token);
    const clinic = await this.authDb.withSetupLink(hash, (tx) => clinicLink(tx));
    if (clinic) {
      if (clinic.usedAt || clinic.replacedAt || clinic.expiresAt <= now) throw linkInvalid();
      return clinic.found;
    }
    const admin = await this.authDb.withAuth((tx) => adminLink(tx, hash));
    if (!admin || admin.expiresAt <= now) throw linkInvalid();
    return admin;
  }
}

/** The link visible under withSetupLink(), with its person and clinic. */
async function clinicLink(tx: Tx) {
  const [row] = await tx
    .select({
      linkId: setupLink.id,
      purpose: setupLink.purpose,
      membershipId: setupLink.membershipId,
      expiresAt: setupLink.expiresAt,
      usedAt: setupLink.usedAt,
      replacedAt: setupLink.replacedAt,
      boundUserId: membership.userId,
      personName: membership.displayName,
      phoneE164: membership.phoneE164,
      clinicName: tenant.name,
    })
    .from(setupLink)
    .innerJoin(
      membership,
      and(eq(membership.tenantId, setupLink.tenantId), eq(membership.id, setupLink.membershipId)),
    )
    .innerJoin(tenant, eq(tenant.id, setupLink.tenantId));
  if (!row) return null;
  return {
    usedAt: row.usedAt,
    replacedAt: row.replacedAt,
    expiresAt: row.expiresAt,
    found: {
      kind: 'clinic' as const,
      linkId: row.linkId,
      purpose: row.purpose,
      membershipId: row.membershipId,
      boundUserId: row.boundUserId,
      clinicName: row.clinicName,
      personName: row.personName,
      phoneE164: row.phoneE164,
      expiresAt: row.expiresAt,
    },
  };
}

/** A super admin's link: a verification row whose value is the token hash. */
async function adminLink(tx: Tx, hash: string): Promise<Extract<Found, { kind: 'admin' }> | null> {
  const rows = await tx
    .select({
      id: verification.id,
      identifier: verification.identifier,
      expiresAt: verification.expiresAt,
    })
    .from(verification)
    .where(eq(verification.value, hash));
  const row = rows.find((r) => r.identifier.startsWith(`${ADMIN_SETUP_IDENTIFIER}:`));
  if (!row) return null;
  const userId = row.identifier.slice(ADMIN_SETUP_IDENTIFIER.length + 1);
  const [person] = await tx
    .select({ name: user.name, phone: user.phoneNumber })
    .from(user)
    .where(eq(user.id, userId));
  if (!person?.phone) return null;
  return {
    kind: 'admin',
    verificationId: row.id,
    userId,
    personName: person.name,
    phoneE164: person.phone,
    expiresAt: row.expiresAt,
  };
}
