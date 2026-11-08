// Who is calling (PLT-45 scope): the active tenant/branch and every role assignment.
import type { PermissionKey } from './permissions.ts';
import type { Role, RoleGrants } from './roles.ts';

export interface RoleAssignment {
  role: Role;
  tenantId: string;
  /** null: the role holds in every branch of the tenant. */
  branchId: string | null;
}

export interface Principal {
  userId: string;
  /** Active tenant. */
  tenantId: string;
  /** Active branch; null when no branch is selected. */
  branchId: string | null;
  roles: readonly RoleAssignment[];
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
      grants[assignment.role].includes(key),
  );
}
