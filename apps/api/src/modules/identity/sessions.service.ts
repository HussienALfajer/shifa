// Server-side sessions (A-01a criteria 9, 10; OD-77): the active clinic at sign-in, the idle and
// absolute limits, the principal of a session (roles read inside the active tenant, so shifa_auth
// needs no privilege on role_assignment), and listing and ending a person's own sessions.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SessionList, SessionView } from '@shifa/contracts';
import {
  type AuthDb,
  membership,
  platformAdmin,
  roleAssignment,
  type ShifaDb,
  session,
  type Tx,
  twoFactor,
} from '@shifa/db';
import { and, eq, gt, isNull, lt, ne, or } from 'drizzle-orm';
import {
  type MfaState,
  mustEnrolMfa,
  type Principal,
  parsePrincipal,
  SessionExpiredError,
} from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { SHIFA_DB } from '../../platform/database.module.ts';
import { idleMinutesOfOwnClinics } from '../settings/index.ts';
import { activeAtSignIn } from './clinic-choices.ts';
import { IdentityAudit, type SessionEndReason } from './identity-audit.ts';
import { SESSION_ABSOLUTE_MS } from './session-cookie.ts';
import { NO_CLINIC_IDLE_MINUTES, tenantView } from './tenant-view.ts';
import { AUTH_DB } from './tokens.ts';

export { NO_CLINIC_IDLE_MINUTES };

import { describeUserAgent } from './user-agent.ts';

/** Is the person a super admin, and have they a confirmed TOTP enrolment? */
async function accountFactors(
  tx: Tx,
  userId: string,
): Promise<{ platformAdmin: boolean; totpEnrolled: boolean; ownsClinic: boolean }> {
  const [admin] = await tx
    .select({ id: platformAdmin.userId })
    .from(platformAdmin)
    .where(eq(platformAdmin.userId, userId));
  const [totp] = await tx
    .select({ id: twoFactor.id })
    .from(twoFactor)
    .where(and(eq(twoFactor.userId, userId), eq(twoFactor.verified, true)));
  // Owner in any clinic where the person is active (the auth path sees own roles only, run
  // with withUser): the MFA gate holds before a clinic is chosen (A-01-03 review 2).
  const [owner] = await tx
    .select({ id: roleAssignment.id })
    .from(roleAssignment)
    .innerJoin(
      membership,
      and(
        eq(membership.tenantId, roleAssignment.tenantId),
        eq(membership.id, roleAssignment.membershipId),
      ),
    )
    .where(
      and(
        eq(membership.userId, userId),
        eq(membership.status, 'active'),
        eq(roleAssignment.role, 'owner'),
      ),
    )
    .limit(1);
  return {
    platformAdmin: admin !== undefined,
    totpEnrolled: totp !== undefined,
    ownsClinic: owner !== undefined,
  };
}

const MINUTE_MS = 60_000;

type SessionRow = typeof session.$inferSelect;

@Injectable()
export class SessionsService {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(SHIFA_DB) private readonly db: ShifaDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(IdentityAudit) private readonly audit: IdentityAudit,
  ) {}

  /**
   * The clinic and branch a new session starts in: the only selectable clinic (not suspended, a
   * role left) and the only branch the person holds there; otherwise none (the chooser).
   */
  activeAtSignIn(userId: string): Promise<{ tenantId: string | null; branchId: string | null }> {
    return activeAtSignIn(this.authDb, this.db, userId);
  }

  /**
   * The principal of the session with this token; null when there is none. A session past its
   * idle or absolute limit is deleted, audited, and answers SessionExpiredError. Any other request
   * refreshes its last activity.
   */
  async authenticate(token: string, requestId: string): Promise<Principal | null> {
    const now = this.clock.now();
    const [row] = await this.authDb.withAuth((tx) =>
      tx.select().from(session).where(eq(session.token, token)).limit(1),
    );
    if (!row) return null;
    const view = await tenantView(this.db, row.userId, row.activeTenantId, row.activeBranchId);
    const reason = this.#expiry(row, view.idleMinutes, now);
    if (reason) {
      await this.end(row.userId, [row.id], reason, requestId);
      throw new SessionExpiredError(reason === 'idle' ? 'idle' : 'absolute');
    }
    const factors = await this.authDb.withUser(row.userId, async (tx) => {
      await tx.update(session).set({ lastActiveAt: now }).where(eq(session.id, row.id));
      return accountFactors(tx, row.userId);
    });
    if (view.active && row.activeTenantId) {
      await this.#touchMember(row.userId, row.activeTenantId, now);
    }
    const mfa: MfaState = !factors.totpEnrolled
      ? 'none'
      : row.mfaVerifiedAt
        ? 'verified'
        : 'pending';
    return parsePrincipal({
      userId: row.userId,
      sessionId: row.id,
      tenantId: view.active ? row.activeTenantId : null,
      branchId: view.active ? view.branchId : null,
      roles: view.active ? view.roles : [],
      platformAdmin: factors.platformAdmin,
      mfa,
      ...(view.active && view.overrides.length > 0 ? { overrides: view.overrides } : {}),
      ...(factors.ownsClinic ? { ownsClinic: true } : {}),
      // The data stays; every tenant route answers 403 clinic_suspended (criterion 11).
      ...(view.suspended ? { clinicSuspended: true } : {}),
    });
  }

  /** The current session as the client sees it (criterion 9: when it ends). */
  async view(principal: Principal): Promise<SessionView> {
    const row = await this.own(principal);
    const idleMinutes = (await tenantView(this.db, principal.userId, principal.tenantId, null))
      .idleMinutes;
    const lastActive = row.lastActiveAt ?? row.createdAt;
    return {
      userId: principal.userId,
      sessionId: row.id,
      platformAdmin: principal.platformAdmin,
      mfa: principal.mfa,
      mfaRequired: mustEnrolMfa(principal),
      tenantId: principal.tenantId,
      branchId: principal.branchId,
      roles: principal.roles
        .filter((r) => r.role !== 'platform_admin')
        .map((r) => ({
          role: r.role as Exclude<typeof r.role, 'platform_admin'>,
          tenantId: r.tenantId,
          branchId: r.branchId,
        })),
      idleMinutes,
      idleExpiresAt: new Date(lastActive.getTime() + idleMinutes * MINUTE_MS).toISOString(),
      absoluteExpiresAt: absoluteEnd(row).toISOString(),
    };
  }

  /** The person's sessions that have not run out, idle or absolute (criterion 10). */
  async list(principal: Principal): Promise<SessionList> {
    const now = this.clock.now();
    // The person's own clinics (withUser) give each session's idle limit (review N2), through the
    // settings cascade (A-02-04).
    const { rows, idle } = await this.authDb.withUser(principal.userId, async (tx) => ({
      rows: await tx
        .select()
        .from(session)
        .where(and(eq(session.userId, principal.userId), gt(session.expiresAt, now))),
      idle: await idleMinutesOfOwnClinics(tx),
    }));
    const idleMinutesOf = (row: SessionRow) =>
      (row.activeTenantId ? idle.get(row.activeTenantId) : undefined) ?? NO_CLINIC_IDLE_MINUTES;
    return {
      sessions: rows
        .filter((row) => this.#expiry(row, idleMinutesOf(row), now) === null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((row) => ({
          id: row.id,
          ...describeUserAgent(row.userAgent),
          createdAt: row.createdAt.toISOString(),
          lastActiveAt: (row.lastActiveAt ?? row.createdAt).toISOString(),
          current: row.id === principal.sessionId,
        })),
    };
  }

  /** Ends one of the person's own sessions; 404 for any other id. */
  async endOne(principal: Principal, sessionId: string, requestId: string): Promise<void> {
    const ended = await this.end(principal.userId, [sessionId], 'ended', requestId);
    if (ended === 0) throw new NotFoundException();
  }

  /** Ends every session of the person but the current one; returns how many. */
  async endOthers(principal: Principal, requestId: string): Promise<number> {
    const rows = await this.authDb.withAuth((tx) =>
      tx
        .select({ id: session.id })
        .from(session)
        .where(
          and(
            eq(session.userId, principal.userId),
            principal.sessionId ? ne(session.id, principal.sessionId) : undefined,
          ),
        ),
    );
    return this.end(
      principal.userId,
      rows.map((r) => r.id),
      'ended_others',
      requestId,
    );
  }

  /** Ends the current session (sign-out). */
  async signOut(principal: Principal, requestId: string): Promise<void> {
    if (principal.sessionId) {
      await this.end(principal.userId, [principal.sessionId], 'sign_out', requestId);
    }
  }

  /**
   * Ends the session with this token whoever holds it (rotation at sign-in): the person who just
   * signed in is the actor, though the old session may be someone else's on a shared browser.
   */
  async endByToken(token: string, actorId: string, requestId: string): Promise<void> {
    const [row] = await this.authDb.withAuth((tx) =>
      tx
        .select({ id: session.id, userId: session.userId })
        .from(session)
        .where(eq(session.token, token)),
    );
    if (row) await this.end(row.userId, [row.id], 'replaced', requestId, actorId);
  }

  /** Deletes the person's sessions among `ids`, one audit row each, in one transaction. */
  async end(
    userId: string,
    ids: string[],
    reason: SessionEndReason,
    requestId: string,
    actorId: string = userId,
  ): Promise<number> {
    if (ids.length === 0) return 0;
    return this.authDb.withAuth(async (tx) => {
      let ended = 0;
      for (const id of ids) {
        const deleted = await tx
          .delete(session)
          .where(and(eq(session.id, id), eq(session.userId, userId)))
          .returning({ id: session.id });
        if (deleted.length === 0) continue;
        ended += 1;
        await this.audit.record(
          { event: 'auth.session_ended', data: { reason } },
          { actorId, targetId: id, requestId },
          tx,
        );
      }
      return ended;
    });
  }

  /** The principal's own session row; SessionExpiredError when it is gone. */
  async own(principal: Principal): Promise<SessionRow> {
    const id = principal.sessionId;
    const [row] = id
      ? await this.authDb.withAuth((tx) =>
          tx
            .select()
            .from(session)
            .where(and(eq(session.id, id), eq(session.userId, principal.userId))),
        )
      : [];
    if (!row) throw new SessionExpiredError();
    return row;
  }

  #expiry(row: SessionRow, idleMinutes: number, now: Date): SessionEndReason | null {
    if (now >= absoluteEnd(row) || now >= row.expiresAt) return 'absolute';
    const lastActive = row.lastActiveAt ?? row.createdAt;
    if (now.getTime() - lastActive.getTime() >= idleMinutes * MINUTE_MS) return 'idle';
    return null;
  }

  /**
   * The member's last activity in the clinic (the team list, A-01b), written at most once a
   * minute so a busy session does not write on every request.
   */
  async #touchMember(userId: string, tenantId: string, now: Date): Promise<void> {
    const before = new Date(now.getTime() - MINUTE_MS);
    await this.db.withTenant({ tenantId, userId }, (tx) =>
      tx
        .update(membership)
        .set({ lastActiveAt: now })
        .where(
          and(
            eq(membership.userId, userId),
            eq(membership.status, 'active'),
            or(isNull(membership.lastActiveAt), lt(membership.lastActiveAt, before)),
          ),
        ),
    );
  }
}

function absoluteEnd(row: SessionRow): Date {
  return new Date(row.createdAt.getTime() + SESSION_ABSOLUTE_MS);
}
