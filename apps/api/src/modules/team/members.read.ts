// Reading the team inside one clinic (A-01b criteria 2, 3, 5, 7): members with their roles and
// scope, sensitive toggles against the role default, and the last-owner rule. Plain functions on
// a `tx` from TenantDb (the clinic's RLS applies), shared by the service's reads and writes.
import type { MemberDetail, MemberRole, MemberSummary } from '@shifa/contracts';
import {
  branch,
  membership,
  permissionOverride,
  type Role,
  roleAssignment,
  setupLink,
  type Tx,
} from '@shifa/db';
import { and, asc, eq, inArray, isNull, max } from 'drizzle-orm';
import type { PermissionCatalogue, PermissionKey } from '../../access/index.ts';

type Grants = Readonly<Record<string, readonly string[]>>;

type MembershipRow = typeof membership.$inferSelect;

const ROLE_ORDER: readonly Role[] = ['owner', 'doctor', 'assistant', 'receptionist', 'accountant'];

/** Role assignments with branch names, per membership. */
async function rolesBy(tx: Tx, membershipIds: string[]): Promise<Map<string, MemberRole[]>> {
  const byMember = new Map<string, MemberRole[]>();
  if (membershipIds.length === 0) return byMember;
  const rows = await tx
    .select({
      membershipId: roleAssignment.membershipId,
      role: roleAssignment.role,
      branchId: roleAssignment.branchId,
      branchName: branch.name,
    })
    .from(roleAssignment)
    .leftJoin(
      branch,
      and(eq(branch.tenantId, roleAssignment.tenantId), eq(branch.id, roleAssignment.branchId)),
    )
    .where(inArray(roleAssignment.membershipId, membershipIds));
  for (const row of rows) {
    const list = byMember.get(row.membershipId) ?? [];
    list.push({ role: row.role, branchId: row.branchId, branchName: row.branchName ?? null });
    byMember.set(row.membershipId, list);
  }
  for (const list of byMember.values()) {
    list.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  }
  return byMember;
}

/** The latest unused, unreplaced link per membership, past or future (one query, A-01-12). */
async function openLinksBy(tx: Tx, membershipIds: string[]): Promise<Map<string, Date>> {
  if (membershipIds.length === 0) return new Map();
  const rows = await tx
    .select({ membershipId: setupLink.membershipId, expiresAt: max(setupLink.expiresAt) })
    .from(setupLink)
    .where(
      and(
        inArray(setupLink.membershipId, membershipIds),
        isNull(setupLink.usedAt),
        isNull(setupLink.replacedAt),
      ),
    )
    .groupBy(setupLink.membershipId);
  return new Map(
    rows.flatMap((r) => (r.expiresAt ? [[r.membershipId, r.expiresAt] as const] : [])),
  );
}

/** Who is reading: the caller's own row reads «أنت». */
export interface Viewer {
  userId: string;
}

function summary(
  row: MembershipRow,
  roles: MemberRole[],
  link: Date | undefined,
  viewer: Viewer,
): MemberSummary {
  return {
    id: row.id,
    name: row.displayName,
    phone: row.phoneE164,
    status: row.status,
    roles,
    lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    // A pending member's link only: an active member's unused recovery link is not «انتهى الرابط».
    linkExpiresAt: row.status === 'pending' ? (link?.toISOString() ?? null) : null,
    isSelf: row.userId !== null && row.userId === viewer.userId,
  };
}

export async function listMembers(tx: Tx, viewer: Viewer): Promise<MemberSummary[]> {
  const rows = await tx.select().from(membership).orderBy(asc(membership.createdAt));
  const ids = rows.map((r) => r.id);
  const roles = await rolesBy(tx, ids);
  const links = await openLinksBy(tx, ids);
  return rows.map((row) => summary(row, roles.get(row.id) ?? [], links.get(row.id), viewer));
}

export async function findMember(tx: Tx, id: string): Promise<MembershipRow | undefined> {
  const [row] = await tx.select().from(membership).where(eq(membership.id, id));
  return row;
}

/** Ids of the clinic's active members holding the owner role. */
export async function activeOwners(tx: Tx): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ id: membership.id })
    .from(membership)
    .innerJoin(
      roleAssignment,
      and(
        eq(roleAssignment.tenantId, membership.tenantId),
        eq(roleAssignment.membershipId, membership.id),
      ),
    )
    .where(and(eq(membership.status, 'active'), eq(roleAssignment.role, 'owner')));
  return rows.map((r) => r.id);
}

export interface DetailContext {
  viewer: Viewer;
  catalogue: PermissionCatalogue;
  grants: Grants;
  /** Whether a person has TOTP, read on the auth path (identity's MemberAccounts). */
  mfaEnrolled(userId: string): Promise<boolean>;
}

/** Whether the member holds the owner role in this clinic. */
export async function holdsOwnerRole(tx: Tx, membershipId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: roleAssignment.id })
    .from(roleAssignment)
    .where(and(eq(roleAssignment.membershipId, membershipId), eq(roleAssignment.role, 'owner')))
    .limit(1);
  return row !== undefined;
}

export async function memberDetail(
  tx: Tx,
  row: MembershipRow,
  ctx: DetailContext,
): Promise<MemberDetail> {
  const roles = (await rolesBy(tx, [row.id])).get(row.id) ?? [];
  const overrides = await tx
    .select({ key: permissionOverride.key, granted: permissionOverride.granted })
    .from(permissionOverride)
    .where(eq(permissionOverride.membershipId, row.id));
  const owners = await activeOwners(tx);
  const permissions = ctx.catalogue.sensitiveKeys().map((key: PermissionKey) => {
    const roleDefault = roles.some((r) => (ctx.grants[r.role] ?? []).includes(key));
    const override = overrides.find((o) => o.key === key);
    return {
      key,
      roleDefault,
      granted: override ? override.granted : roleDefault,
      overridden: override !== undefined,
    };
  });
  const links = await openLinksBy(tx, [row.id]);
  return {
    ...summary(row, roles, links.get(row.id), ctx.viewer),
    permissions,
    isLastOwner: owners.length === 1 && owners[0] === row.id,
    mfaEnrolled: row.userId ? await ctx.mfaEnrolled(row.userId) : false,
  };
}
