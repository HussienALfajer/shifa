// Every tenant table's isolation case (0.2-06b). Add one file per tenant table next to this
// index (see /rls-policy) and list it here; the coverage test fails until you do.
import type { IsolationCase } from '../define.ts';
import { auditEventCase } from './audit-event.ts';
import { branchCase } from './branch.ts';
import { deploymentRouteCase } from './deployment-route.ts';
import { tenantAddonCase, tenantOverrideCase, tenantOverrideEventCase } from './entitlements.ts';
import { featureFlagTenantCase } from './feature-flags.ts';
import { membershipCase } from './membership.ts';
import { organizationCase } from './organization.ts';
import { permissionOverrideCase } from './permission-override.ts';
import { roleAssignmentCase } from './role-assignment.ts';
import { setupLinkCase } from './setup-link.ts';

export const ISOLATION_CASES: readonly IsolationCase[] = [
  organizationCase,
  deploymentRouteCase,
  branchCase,
  membershipCase,
  roleAssignmentCase,
  permissionOverrideCase,
  setupLinkCase,
  auditEventCase,
  tenantAddonCase,
  tenantOverrideCase,
  tenantOverrideEventCase,
  featureFlagTenantCase,
];
