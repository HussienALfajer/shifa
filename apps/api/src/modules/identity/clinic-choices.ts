// The clinics a person may work in (A-01b criteria 10, 11): their active memberships, read on
// the auth path (withUser: own memberships, roles and clinics only), with each clinic's active
// branches read inside that clinic. A clinic is selectable when it is not suspended and the
// person holds a tenant-wide role or a role in an active branch. Shared by sign-in (one
// selectable clinic: straight in), the chooser and the switch.
import type { SessionRole } from '@shifa/contracts';
import {
  type AuthDb,
  branch,
  membership,
  type Role,
  roleAssignment,
  type ShifaDb,
  type TenantStatus,
  tenant,
} from '@shifa/db';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

const ROLE_ORDER: readonly Role[] = ['owner', 'doctor', 'assistant', 'receptionist', 'accountant'];

export interface ClinicChoice {
  tenantId: string;
  name: string;
  status: TenantStatus;
  selectable: boolean;
  roles: SessionRole[];
  lastActiveAt: Date | null;
  /** The clinic has exactly one active branch. */
  solo: boolean;
  /** Active branches the person holds a role in (all for a tenant-wide role); none if suspended. */
  branches: { id: string; name: string }[];
}

/** The person's clinics, last used first (never used last, then by name). */
export async function clinicChoices(
  authDb: AuthDb,
  db: ShifaDb,
  userId: string,
): Promise<ClinicChoice[]> {
  const own = await authDb.withUser(userId, async (tx) => {
    const members = await tx
      .select({
        id: membership.id,
        tenantId: membership.tenantId,
        lastActiveAt: membership.lastActiveAt,
      })
      .from(membership)
      // The auth path's own-read policies ignore status (sign-in uses them): filtered here.
      .where(and(eq(membership.userId, userId), eq(membership.status, 'active')));
    if (members.length === 0) return null;
    const tenantIds = members.map((m) => m.tenantId);
    const clinics = await tx
      .select({ id: tenant.id, name: tenant.name, status: tenant.status })
      .from(tenant)
      .where(inArray(tenant.id, tenantIds));
    const roles = await tx
      .select({
        membershipId: roleAssignment.membershipId,
        role: roleAssignment.role,
        branchId: roleAssignment.branchId,
      })
      .from(roleAssignment)
      .where(
        inArray(
          roleAssignment.membershipId,
          members.map((m) => m.id),
        ),
      );
    return { members, clinics, roles };
  });
  if (!own) return [];
  const choices: ClinicChoice[] = [];
  for (const member of own.members) {
    const clinic = own.clinics.find((c) => c.id === member.tenantId);
    if (!clinic) continue;
    const roles = own.roles.filter((r) => r.membershipId === member.id);
    const suspended = clinic.status === 'suspended';
    const active = suspended ? [] : await activeBranches(db, clinic.id, userId);
    const tenantWide = roles.some((r) => r.branchId === null);
    const held = tenantWide ? active : active.filter((b) => roles.some((r) => r.branchId === b.id));
    choices.push({
      tenantId: clinic.id,
      name: clinic.name,
      status: clinic.status,
      selectable: !suspended && (tenantWide || held.length > 0),
      roles: [...new Set(roles.map((r) => r.role))].sort(
        (a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b),
      ),
      lastActiveAt: member.lastActiveAt,
      solo: active.length === 1,
      branches: held,
    });
  }
  return choices.sort(
    (a, b) =>
      (b.lastActiveAt?.getTime() ?? -1) - (a.lastActiveAt?.getTime() ?? -1) ||
      a.name.localeCompare(b.name, 'ar') ||
      a.tenantId.localeCompare(b.tenantId),
  );
}

/** Where a new session starts: the only selectable clinic and its only held branch, else none. */
export async function activeAtSignIn(
  authDb: AuthDb,
  db: ShifaDb,
  userId: string,
): Promise<{ tenantId: string | null; branchId: string | null }> {
  const selectable = (await clinicChoices(authDb, db, userId)).filter((c) => c.selectable);
  const [only, ...others] = selectable;
  if (!only || others.length > 0) return { tenantId: null, branchId: null };
  return { tenantId: only.tenantId, branchId: defaultBranch(only) };
}

/** The branch a switch without one lands in: the only branch the person holds there. */
export function defaultBranch(choice: ClinicChoice): string | null {
  return choice.branches.length === 1 ? (choice.branches[0]?.id ?? null) : null;
}

function activeBranches(db: ShifaDb, tenantId: string, userId: string) {
  return db.withTenant({ tenantId, userId }, (tx) =>
    tx
      .select({ id: branch.id, name: branch.name })
      .from(branch)
      .where(isNull(branch.archivedAt))
      .orderBy(asc(branch.createdAt), asc(branch.id)),
  );
}
