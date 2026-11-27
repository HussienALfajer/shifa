// What the session's active clinic says about the person, read per request inside that tenant
// (shifa_app, its RLS): is the clinic suspended (A-01b 11), is the person still an active member
// with a role, the clinic's idle minutes (the settings cascade, A-02-04), the active branch if it
// is still one of the clinic's active branches, their roles (none in an archived branch:
// criterion 4) and toggles.
import {
  branch,
  membership,
  permissionOverride,
  roleAssignment,
  type ShifaDb,
  tenant,
} from '@shifa/db';
import { and, eq, isNull, or } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { idleMinutesInClinic } from '../settings/index.ts';

/** Idle limit without an active clinic: super admins, and people between clinics (OD-77). */
export const NO_CLINIC_IDLE_MINUTES = 15;

export interface TenantView {
  active: boolean;
  /** The active clinic is suspended: no clinic for the session, 403 on tenant routes. */
  suspended: boolean;
  idleMinutes: number;
  branchId: string | null;
  roles: Principal['roles'];
  overrides: { key: string; granted: boolean }[];
}

const NONE: TenantView = {
  active: false,
  suspended: false,
  idleMinutes: NO_CLINIC_IDLE_MINUTES,
  branchId: null,
  roles: [],
  overrides: [],
};

export function tenantView(
  db: ShifaDb,
  userId: string,
  tenantId: string | null,
  branchId: string | null,
): Promise<TenantView> {
  if (tenantId === null) return Promise.resolve(NONE);
  return db.withTenant({ tenantId, userId }, async (tx) => {
    const [clinic] = await tx
      .select({ type: tenant.type, status: tenant.status })
      .from(tenant)
      .where(eq(tenant.id, tenantId));
    if (!clinic) return NONE;
    const [member] = await tx
      .select({ id: membership.id })
      .from(membership)
      .where(and(eq(membership.userId, userId), eq(membership.status, 'active')));
    // Membership first: someone no longer a member learns nothing of the clinic's status.
    if (!member) return NONE;
    if (clinic.status === 'suspended') return { ...NONE, suspended: true };
    const roles = await tx
      .select({ role: roleAssignment.role, branchId: roleAssignment.branchId })
      .from(roleAssignment)
      .leftJoin(
        branch,
        and(eq(branch.tenantId, roleAssignment.tenantId), eq(branch.id, roleAssignment.branchId)),
      )
      .where(
        and(
          eq(roleAssignment.membershipId, member.id),
          or(isNull(roleAssignment.branchId), isNull(branch.archivedAt)),
        ),
      );
    // A member without a role (or only roles in archived branches) holds nothing here.
    if (roles.length === 0) return NONE;
    const overrides = await tx
      .select({ key: permissionOverride.key, granted: permissionOverride.granted })
      .from(permissionOverride)
      .where(eq(permissionOverride.membershipId, member.id));
    const [current] = branchId
      ? await tx
          .select({ id: branch.id })
          .from(branch)
          .where(and(eq(branch.id, branchId), isNull(branch.archivedAt)))
      : [];
    return {
      active: true,
      suspended: false,
      idleMinutes: await idleMinutesInClinic(tx, clinic.type),
      branchId: current?.id ?? null,
      roles: roles.map((r) => ({ role: r.role, tenantId, branchId: r.branchId })),
      overrides,
    };
  });
}
