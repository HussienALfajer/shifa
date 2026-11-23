// Public surface of the access model; product modules import only from here.
export { AccessModule } from './access.module.ts';
export { AUTH_PORT, type AuthPort, SessionExpiredError } from './auth.port.ts';
export {
  BeforeMfa,
  CurrentPrincipal,
  PlatformAdmin,
  Public,
  RequirePermission,
  SignedIn,
} from './decorators.ts';
export type { PermissionKey } from './permissions.ts';
export {
  PERMISSION_CATALOGUE,
  PermissionCatalogue,
  type PermissionDefinition,
} from './permissions.ts';
export {
  type AccessScope,
  isGranted,
  type MfaState,
  mfaBlock,
  mustEnrolMfa,
  type PermissionOverride,
  type Principal,
  PrincipalError,
  parsePrincipal,
  type RoleAssignment,
} from './principal.ts';
export type { Role } from './roles.ts';
export { PRODUCTION_GRANTS } from './roles.ts';
export { CurrentScope, linkScope, type RequestScope } from './scope.ts';
export { TenantDb, withScope } from './tenant-db.ts';
