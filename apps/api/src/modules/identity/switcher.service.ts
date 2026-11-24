// The clinic chooser and switcher (A-01b criteria 10, 11, 12). The person's own clinics come
// from the auth path (clinicChoices); a switch is checked against them on the server, whatever
// the client sends: a clinic without an active membership and role is not found, a suspended one
// answers 403 `clinic_suspended`, an archived branch 409 `branch_archived`, a branch without a
// role 403 `branch_not_held`. The session keeps its token; only its active clinic and branch
// change, and the clinic switched to records `clinic.switched`.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ActiveClinic, MyClinics, SwitchRequest } from '@shifa/contracts';
import { type AuthDb, auditEvent, branch, type ShifaDb, session } from '@shifa/db';
import { and, eq } from 'drizzle-orm';
import { type Principal, SessionExpiredError } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { SHIFA_DB } from '../../platform/database.module.ts';
import { ApiError } from '../../platform/errors.ts';
import { type ClinicChoice, clinicChoices, defaultBranch } from './clinic-choices.ts';
import { MyInvitations } from './my-invitations.service.ts';
import { AUTH_DB } from './tokens.ts';

@Injectable()
export class SwitcherService {
  constructor(
    @Inject(AUTH_DB) private readonly authDb: AuthDb,
    @Inject(SHIFA_DB) private readonly db: ShifaDb,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(MyInvitations) private readonly invitations: MyInvitations,
  ) {}

  /** The chooser: clinics last used first and open invitations; 404 `no_clinic` for neither. */
  async myClinics(principal: Principal): Promise<MyClinics> {
    const choices = await clinicChoices(this.authDb, this.db, principal.userId);
    const invitations = await this.invitations.list(principal.userId);
    if (choices.length === 0 && invitations.length === 0) throw new ApiError(404, 'no_clinic');
    return {
      clinics: choices.map((c) => ({
        tenantId: c.tenantId,
        name: c.name,
        status: c.status,
        selectable: c.selectable,
        roles: c.roles,
        lastActiveAt: c.lastActiveAt?.toISOString() ?? null,
        solo: c.solo,
        branches: c.branches,
      })),
      invitations,
    };
  }

  async switch(
    principal: Principal,
    input: SwitchRequest,
    requestId: string,
  ): Promise<ActiveClinic> {
    const sessionId = principal.sessionId;
    if (sessionId === null) throw new SessionExpiredError();
    const choices = await clinicChoices(this.authDb, this.db, principal.userId);
    const choice = choices.find((c) => c.tenantId === input.tenantId);
    if (!choice) throw new NotFoundException();
    if (choice.status === 'suspended') throw new ApiError(403, 'clinic_suspended');
    if (!choice.selectable) throw new NotFoundException();
    const branchId = await this.#branch(principal.userId, choice, input.branchId ?? null);
    const active = { tenantId: choice.tenantId, branchId };
    const now = this.clock.now();
    // The auth step runs inside the clinic's transaction (two pools, as invitations do): a failed
    // session change rolls back the audit row; the rare failure of the clinic's commit after the
    // auth step leaves the switch without its row (accepted, as for invitations).
    await this.db.withTenant(
      { tenantId: choice.tenantId, userId: principal.userId },
      async (tx) => {
        await tx.insert(auditEvent).values({
          tenantId: choice.tenantId,
          actorId: principal.userId,
          targetId: branchId ?? choice.tenantId,
          event: 'clinic.switched',
          requestId,
          data: { branch: branchId !== null },
        });
        const moved = await this.authDb.withAuth((auth) =>
          auth
            .update(session)
            .set({
              activeTenantId: active.tenantId,
              activeBranchId: active.branchId,
              updatedAt: now,
            })
            .where(and(eq(session.id, sessionId), eq(session.userId, principal.userId)))
            .returning({ id: session.id }),
        );
        if (moved.length === 0) throw new SessionExpiredError();
      },
    );
    return active;
  }

  /** The branch asked for, if the person holds it; none asked: the only one they hold. */
  async #branch(
    userId: string,
    choice: ClinicChoice,
    wanted: string | null,
  ): Promise<string | null> {
    if (wanted === null) return defaultBranch(choice);
    if (choice.branches.some((b) => b.id === wanted)) return wanted;
    const [row] = await this.db.withTenant({ tenantId: choice.tenantId, userId }, (tx) =>
      tx.select({ archivedAt: branch.archivedAt }).from(branch).where(eq(branch.id, wanted)),
    );
    if (row?.archivedAt) throw new ApiError(409, 'branch_archived');
    throw new ApiError(403, 'branch_not_held');
  }
}
