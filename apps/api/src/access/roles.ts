// PLT-42 roles and the role → permission map (A-01b criterion 6). A member's effective grants
// are these plus or minus their overrides of sensitive keys (principal.ts isGranted()).
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

/** What each role may do in its tenant (or branch) by default. */
export const PRODUCTION_GRANTS: RoleGrants = Object.freeze({
  owner: [
    'members.view',
    'members.manage',
    'branches.manage',
    'clinic.settings.manage',
    'clinic.capabilities.view',
    'patients.view',
    'patients.manage',
    'patients.archive',
    'patients.merge',
    'patients.fields.manage',
    'patients.read_log.view',
  ],
  doctor: ['clinical.notes.view', 'clinic.capabilities.view', 'patients.view', 'patients.manage'],
  receptionist: ['clinic.capabilities.view', 'patients.view', 'patients.manage'],
  assistant: [
    'clinical.notes.view',
    'clinic.capabilities.view',
    'patients.view',
    'patients.manage',
  ],
  accountant: ['clinic.capabilities.view', 'patients.view'],
  // Platform work goes through withPlatformAdmin() on the shifa_platform pool (ADR-0043),
  // never through tenant grants.
  platform_admin: [],
});
