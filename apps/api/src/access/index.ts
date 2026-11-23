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
  type AccessScope,
  type MfaState,
  mfaBlock,
  mustEnrolMfa,
  type Principal,
  PrincipalError,
  parsePrincipal,
  type RoleAssignment,
} from './principal.ts';
export type { Role } from './roles.ts';
