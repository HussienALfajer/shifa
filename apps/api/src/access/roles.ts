// PLT-42 roles and the role → permission map. Grants stay empty until Phase A adds role tables.
import type { PermissionKey } from './permissions.ts';

export const ROLES = [
  'owner',
  'doctor',
  'receptionist',
  'assistant',
  'accountant',
  'platform_admin',
] as const;

export type Role = (typeof ROLES)[number];

export type RoleGrants = Readonly<Record<Role, readonly PermissionKey[]>>;

/** What each role may do in its tenant (or branch). Empty until Phase A. */
export const PRODUCTION_GRANTS: RoleGrants = Object.freeze({
  owner: [],
  doctor: [],
  receptionist: [],
  assistant: [],
  accountant: [],
  // Platform work goes through withPlatformAdmin(), never through tenant grants.
  platform_admin: [],
});
