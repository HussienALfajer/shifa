// Opening and using a setup link (A-01a criteria 4, 5): found by the SHA-256 of its token alone
// (withSetupLink for a clinic link, the verification table for a super admin's), one answer
// (404 `link_invalid`) for used, expired, replaced and unknown links, the password rules named
// on refusal, and on success: the password set, the link used, the membership bound, one audit
// row, and a new session at mfa 'none' (the guard then allows enrolment only).
import { Inject, Injectable } from '@nestjs/common';
import { maskPhone, type SessionView, type SetupLinkView } from '@shifa/contracts';
import {
  type AuthDb,
  branch,
  membership,
  platformAdmin,
  type Role,
  roleAssignment,
  type ShifaDb,
  session,
  setupLink,
  type Tx,
  tenant,
  user,
  verification,
} from '@shifa/db';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { linkScope, withScope } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { SHIFA_DB } from '../../platform/database.module.ts';
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
      tenantId: string;
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

export const linkInvalid = () => new ApiError(404, 'link_invalid');

export type ClinicLink = Extract<Found, { kind: 'clinic' }>;

export interface LinkRole {
  role: Role;
  branchName: string | null;
}

/** A link page has no signed-in person: `app.user_id` is the nil UUID there (reads only). */
const NO_USER = '00000000-0000-0000-0000-000000000000';

/** The role a setup page names first. */
const ROLE_ORDER: readonly Role[] = ['owner', 'doctor', 'assistant', 'receptionist', 'accountant'];

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
    @Inject(SHIFA_DB) private readonly db: ShifaDb,
  ) {}

  async view(token: string): Promise<SetupLinkView> {
    const found = await this.#find(token);
    if (found.kind === 'admin') {
      return {
        clinicName: null,
        personName: found.personName,
        role: 'platform_admin',
        purpose: 'admin_setup',
        phoneMasked: maskPhone(found.phoneE164),
        expiresAt: found.expiresAt.toISOString(),
      };
    }
    const roles = await this.#roles(found);
    const role = roles[0]?.role;
    if (!role) throw linkInvalid();
    return {
      clinicName: found.clinicName,
      personName: found.personName,
      role,
      purpose: found.purpose,
      phoneMasked: maskPhone(found.phoneE164),
      expiresAt: found.expiresAt.toISOString(),
    };
  }

  async consume(
    token: string,
    password: string,
    meta: ConsumeMeta,
  ): Promise<{ view: SessionView; cookie: string }> {
    const found = await this.#find(token);
    // An invitation is accepted by a signed-in person (/invitations), never by a password.
    if (found.kind === 'clinic' && found.purpose === 'invitation') {
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
    // The link's first session is the person's first sign-in in its clinic (A-02 criterion 17).
    if (principal.tenantId) await this.sessions.countSignIn(principal.userId, principal.tenantId);
    return { view: await this.sessions.view(principal), cookie: issued.cookie };
  }

  async #useClinicLink(
    token: string,
    found: Extract<Found, { kind: 'clinic' }>,
    hash: string,
    requestId: string,
  ): Promise<string> {
    const now = this.clock.now();
    // A bound person's link reads their own memberships too (one clinic or several, OD-86).
    const tokenHash = linkTokenHash(token);
    const run = <T>(fn: (tx: Tx) => Promise<T>) =>
      found.boundUserId
        ? this.authDb.withUserLink(found.boundUserId, tokenHash, fn)
        : this.authDb.withSetupLink(tokenHash, fn);
    return run(async (tx) => {
      // The policy lets only an unused, unreplaced, unexpired link be marked: a second use of
      // the same link in parallel updates nothing.
      const used = await tx
        .update(setupLink)
        .set({ usedAt: now })
        .where(
          and(
            eq(setupLink.id, found.linkId),
            isNull(setupLink.usedAt),
            isNull(setupLink.replacedAt),
            // The same clock as #find(), so a check and its use never disagree (review 3).
            gt(setupLink.expiresAt, now),
          ),
        )
        .returning({ id: setupLink.id });
      if (used.length === 0) throw linkInvalid();
      let userId = found.boundUserId;
      if (userId) {
        // A new link for a set-up owner: the password is reset. Never a super admin's account,
        // and every other session of the person ends with it (security review M2).
        const [admin] = await tx
          .select({ id: platformAdmin.userId })
          .from(platformAdmin)
          .where(eq(platformAdmin.userId, userId));
        if (admin) throw linkInvalid();
        // A clinic's member link resets only an account that works in that clinic alone: it
        // may have joined another clinic since the link was issued (OD-86).
        if (found.purpose === 'member_setup') {
          const clinics = await tx
            .select({ tenantId: membership.tenantId })
            .from(membership)
            .where(eq(membership.userId, userId));
          if (clinics.some((c) => c.tenantId !== found.tenantId)) throw linkInvalid();
        }
        await setPassword(tx, userId, hash, now);
        await tx.delete(session).where(eq(session.userId, userId));
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
        {
          event: 'auth.link_used',
          data: { purpose: found.purpose === 'member_setup' ? 'member_setup' : 'owner_setup' },
        },
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
        .where(and(eq(verification.id, found.verificationId), gt(verification.expiresAt, now)))
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

  /** A valid clinic link of this token (invitations, A-01-04), or 404 `link_invalid`. */
  async findClinicLink(token: string): Promise<ClinicLink> {
    const found = await this.#find(token);
    if (found.kind !== 'clinic') throw linkInvalid();
    return found;
  }

  /**
   * The link's role assignments with branch names, read in the link's clinic: the documented
   * exception to scope binding (A-01b criterion 8), since nobody there is signed in.
   */
  async rolesOf(found: Pick<ClinicLink, 'tenantId' | 'membershipId'>): Promise<LinkRole[]> {
    return this.#roles(found);
  }

  async #roles(found: Pick<ClinicLink, 'tenantId' | 'membershipId'>): Promise<LinkRole[]> {
    const scope = linkScope({ tenantId: found.tenantId, userId: NO_USER });
    const rows = await withScope(this.db, scope, (tx) =>
      tx
        .select({ role: roleAssignment.role, branchName: branch.name })
        .from(roleAssignment)
        .leftJoin(
          branch,
          and(eq(branch.tenantId, roleAssignment.tenantId), eq(branch.id, roleAssignment.branchId)),
        )
        .where(eq(roleAssignment.membershipId, found.membershipId)),
    );
    return rows
      .map((r) => ({ role: r.role, branchName: r.branchName ?? null }))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
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
      tenantId: setupLink.tenantId,
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
      tenantId: row.tenantId,
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
