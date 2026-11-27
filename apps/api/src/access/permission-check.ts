// A second permission a handler needs after the guard checked its route's key (A-03-02: the
// archived count is the owner's, `patients.archive`). Same rule as the guard: role grants in the
// principal's active clinic and branch, then a sensitive key's override. It never grants access
// to a route; the route's own @RequirePermission does that.
import { Inject, Injectable } from '@nestjs/common';
import { ROLE_GRANTS } from './access-check.ts';
import {
  PERMISSION_CATALOGUE,
  type PermissionCatalogue,
  type PermissionKey,
} from './permissions.ts';
import { isGranted, type Principal } from './principal.ts';
import type { RoleGrants } from './roles.ts';

@Injectable()
export class PermissionCheck {
  constructor(
    @Inject(ROLE_GRANTS) private readonly grants: RoleGrants,
    @Inject(PERMISSION_CATALOGUE) private readonly catalogue: PermissionCatalogue,
  ) {}

  /** True when `principal` holds `key` in its active clinic (false without one). */
  holds(principal: Principal, key: PermissionKey): boolean {
    if (principal.tenantId === null) return false;
    const scope = { tenantId: principal.tenantId, branchId: principal.branchId };
    return isGranted(principal, key, scope, this.grants, this.catalogue);
  }
}
