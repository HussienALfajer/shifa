// Who is calling (PLT-45 scope): the active tenant/branch and every role assignment. The AuthPort
// contract (A-01a criterion 15) is PrincipalSchema: adapters return only what it accepts.
import { z } from 'zod';
import type { PermissionCatalogue, PermissionKey } from './permissions.ts';
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
  /** A super admin (platform_admin table); reaches @PlatformAdmin routes, never tenant data. */
  platformAdmin: boolean;
  /**
   * The session's second factor: `none` (no TOTP enrolled), `pending` (enrolled, challenge not
   * passed in this session), `verified` (passed in this session). A-01a criteria 11, 12.
   */
  mfa: MfaState;
  /**
   * The member's switches of sensitive keys in the active tenant (A-01b criterion 7), read per
   * request; absent = none. A switch of a key that is not sensitive counts for nothing.
   */
  overrides?: readonly PermissionOverride[] | undefined;
  /**
   * Owner in some clinic, active or not (A-01a criterion 11): the MFA gate holds even before a
   * clinic is chosen (A-01-03 review 2). Absent = only the active clinic's roles count.
   */
  ownsClinic?: boolean | undefined;
  /**
   * The session's clinic is suspended (A-01b criterion 11): no active tenant, and every
   * @RequirePermission route answers 403 `clinic_suspended`. Absent = not suspended.
   */
  clinicSuspended?: boolean | undefined;
  /**
   * A support session (A-02 criteria 11–14, ADR-0050): a super admin reading the active tenant as
   * its owner (synthesised tenant-wide `owner` role) under this grant until `expiresAt` (ISO).
   * Every write route answers 403 `support_read_only` and its transactions are READ ONLY.
   */
  support?: SupportGrantRef | undefined;
}

export interface SupportGrantRef {
  grantId: string;
  expiresAt: string;
}

export interface PermissionOverride {
  key: string;
  granted: boolean;
}

export const MFA_STATES = ['none', 'pending', 'verified'] as const;
export type MfaState = (typeof MFA_STATES)[number];

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
    platformAdmin: z.boolean(),
    mfa: z.enum(MFA_STATES),
    overrides: z
      .array(
        z.strictObject({
          key: z.string().regex(/^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/),
          granted: z.boolean(),
        }),
      )
      .optional(),
    ownsClinic: z.boolean().optional(),
    clinicSuspended: z.boolean().optional(),
    support: z.strictObject({ grantId: z.uuid(), expiresAt: z.iso.datetime() }).optional(),
  })
  // A support session: a super admin in a tenant, holding only the synthesised tenant-wide owner
  // role there, no member toggles, the clinic readable even when suspended (criterion 14).
  .refine(
    (p) =>
      p.support === undefined ||
      (p.platformAdmin &&
        p.tenantId !== null &&
        p.branchId === null &&
        p.clinicSuspended !== true &&
        (p.overrides ?? []).length === 0 &&
        p.roles.length === 1 &&
        p.roles.every((r) => r.role === 'owner' && r.branchId === null)),
    { path: ['support'] },
  )
  .refine((p) => p.clinicSuspended !== true || p.tenantId === null, {
    path: ['clinicSuspended'],
  })
  .refine((p) => p.tenantId !== null || (p.overrides ?? []).length === 0, {
    path: ['overrides'],
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

/** Owners and super admins must enrol TOTP before anything else (A-01a criterion 11). */
export function mustEnrolMfa(principal: Principal): boolean {
  return (
    principal.platformAdmin ||
    principal.ownsClinic === true ||
    principal.roles.some((r) => r.role === 'owner')
  );
}

/**
 * Why this principal may reach only @BeforeMfa routes, or null when it may go on: a session that
 * has not passed the challenge, or an owner or super admin without TOTP.
 */
export function mfaBlock(
  principal: Principal,
): 'mfa_enrolment_required' | 'mfa_challenge_required' | null {
  if (principal.mfa === 'pending') return 'mfa_challenge_required';
  if (principal.mfa === 'none' && mustEnrolMfa(principal)) return 'mfa_enrolment_required';
  return null;
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

/**
 * The guard's check (A-01b criterion 7): role grants in `scope`, then the member's override of
 * `key` when the catalogue marks it sensitive and the member holds some role in `scope`. An
 * override of any other key, or where the member holds no role, changes nothing.
 */
export function isGranted(
  principal: Principal,
  key: PermissionKey,
  scope: AccessScope,
  grants: RoleGrants,
  catalogue: PermissionCatalogue,
): boolean {
  const byRole = hasPermission(principal, key, scope, grants);
  if (!catalogue.isSensitive(key)) return byRole;
  const override = principal.overrides?.find((o) => o.key === key);
  if (override === undefined) return byRole;
  const holdsRole = principal.roles.some(
    (r) =>
      r.role !== 'platform_admin' &&
      scope.tenantId !== null &&
      r.tenantId === scope.tenantId &&
      (r.branchId === null || r.branchId === scope.branchId),
  );
  return holdsRole && override.granted;
}
