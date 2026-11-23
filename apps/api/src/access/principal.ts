// Who is calling (PLT-45 scope): the active tenant/branch and every role assignment. The AuthPort
// contract (A-01a criterion 15) is PrincipalSchema: adapters return only what it accepts.
import { z } from 'zod';
import type { PermissionKey } from './permissions.ts';
import { ROLES, type Role, type RoleGrants } from './roles.ts';

export interface RoleAssignment {
  role: Role;
  tenantId: string;
  /** null: the role holds in every branch of the tenant. */
  branchId: string | null;
}

export interface Principal {
  /** Opaque UUID of the person (it is logged; never a phone or a name). */
  userId: string;
  /** The server-side session the request came with; null for credentials without one. */
  sessionId: string | null;
  /** Active tenant; null when the person has none (super admins, or a clinic not yet chosen). */
  tenantId: string | null;
  /** Active branch, always one of the active tenant's; null when no branch is selected. */
  branchId: string | null;
  /** From server-side memberships of the active tenant only. */
  roles: readonly RoleAssignment[];
}

const RoleAssignmentSchema = z.strictObject({
  role: z.enum(ROLES),
  tenantId: z.uuid(),
  branchId: z.uuid().nullable(),
});

/**
 * The AuthPort contract: an opaque UUID user and session; a branch only with a tenant; roles only
 * in the active tenant (none without one); no other field (a phone or a token cannot ride along).
 * That the branch belongs to the tenant and the roles to the person is the adapter's duty: it
 * reads both from the database inside that tenant.
 */
export const PrincipalSchema = z
  .strictObject({
    userId: z.uuid(),
    sessionId: z.uuid().nullable(),
    tenantId: z.uuid().nullable(),
    branchId: z.uuid().nullable(),
    roles: z.array(RoleAssignmentSchema),
  })
  .refine((p) => p.tenantId !== null || p.branchId === null, { path: ['branchId'] })
  .refine((p) => p.roles.every((r) => r.tenantId === p.tenantId), { path: ['roles'] });

/** A principal that broke the contract. Its message lists paths only, never a value. */
export class PrincipalError extends Error {
  override name = 'PrincipalError';
}

export function parsePrincipal(candidate: unknown): Principal {
  const parsed = PrincipalSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  const paths = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.') || '(root)'))];
  throw new PrincipalError(`invalid principal at ${paths.sort().join(', ')}`);
}

export interface AccessScope {
  tenantId: string | null;
  branchId: string | null;
}

/**
 * True when one of the principal's role assignments grants `key` in `scope`: same tenant, and
 * either tenant-wide or for exactly the scope's branch. A branch role never counts for a
 * tenant-wide scope, platform_admin never counts for tenant work, and a scope without a tenant
 * grants nothing.
 */
export function hasPermission(
  principal: Principal,
  key: PermissionKey,
  scope: AccessScope,
  grants: RoleGrants,
): boolean {
  const { tenantId, branchId } = scope;
  if (tenantId === null) return false;
  return principal.roles.some(
    (assignment) =>
      assignment.role !== 'platform_admin' &&
      assignment.tenantId === tenantId &&
      (assignment.branchId === null || assignment.branchId === branchId) &&
      // hasOwn: an unknown role from an adapter grants nothing instead of throwing.
      Object.hasOwn(grants, assignment.role) &&
      grants[assignment.role].includes(key),
  );
}
