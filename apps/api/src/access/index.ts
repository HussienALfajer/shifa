// Public surface of the access model; product modules import only from here.
export { AccessModule } from './access.module.ts';
export { AUTH_PORT, type AuthPort } from './auth.port.ts';
export { Public, RequirePermission } from './decorators.ts';
export type { PermissionKey } from './permissions.ts';
export type { AccessScope, Principal, RoleAssignment } from './principal.ts';
export type { Role } from './roles.ts';
