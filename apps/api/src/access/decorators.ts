// Every route handler carries exactly one of these; the start-up check refuses anything else.
import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionKey } from './permissions.ts';
import type { Principal } from './principal.ts';

export const PUBLIC_METADATA = 'shifa:access:public';
export const PERMISSION_METADATA = 'shifa:access:permission';
export const SIGNED_IN_METADATA = 'shifa:access:signed-in';

/** Open to anonymous callers. Use only for probes and genuinely public pages. */
export const Public = (): MethodDecorator => SetMetadata(PUBLIC_METADATA, true);

/** Needs an authenticated principal holding `key` in its active tenant/branch. */
export const RequirePermission = (key: PermissionKey): MethodDecorator =>
  SetMetadata(PERMISSION_METADATA, key);

/**
 * Needs a signed-in person, whatever their roles and clinic: their own session and account
 * routes (A-01-02). Never for tenant data: that needs @RequirePermission.
 */
export const SignedIn = (): MethodDecorator => SetMetadata(SIGNED_IN_METADATA, true);

export const PLATFORM_ADMIN_METADATA = 'shifa:access:platform-admin';
export const BEFORE_MFA_METADATA = 'shifa:access:before-mfa';

/**
 * Needs a super admin (A-01-03): the admin web's clinic and owner-support routes. Work goes
 * through withPlatformAdmin() (audited); a super admin never passes a tenant permission check.
 */
export const PlatformAdmin = (): MethodDecorator => SetMetadata(PLATFORM_ADMIN_METADATA, true);

/**
 * With @SignedIn only: reachable before the second factor (session view, sign-out, TOTP
 * enrolment and challenge). Every other route answers 403 `mfa_enrolment_required` or
 * `mfa_challenge_required` until the session has passed MFA where it must (A-01a criterion 11).
 */
export const BeforeMfa = (): MethodDecorator => SetMetadata(BEFORE_MFA_METADATA, true);

export const SUPPORT_WRITE_METADATA = 'shifa:access:support-write';

/**
 * With @SignedIn only (A-02-05, ADR-0050): the one write a support session may make, ending its
 * own grant (`POST /auth/support/end`). Every other non-GET route answers 403 `support_read_only`
 * in a support session; the start-up check refuses this marker on any other route.
 */
export const SupportSessionWrite = (): MethodDecorator => SetMetadata(SUPPORT_WRITE_METADATA, true);

export const READ_IN_BODY_METADATA = 'shifa:access:read-in-body';

/**
 * With @RequirePermission on a POST only (A-03-03): a read whose input travels in the body
 * because it is personal data (a patient search term, spec A-03 criterion 6). A support session
 * may call it like a GET; its transaction stays READ ONLY there, so the handler must answer
 * without writing in that scope (patient search skips its key backfill there) and must reach no
 * other database or service that would write. The support matrix lists every such route.
 */
export const ReadInBody = (): MethodDecorator => SetMetadata(READ_IN_BODY_METADATA, true);

export const NOT_IN_SUPPORT_METADATA = 'shifa:access:not-in-support';

/**
 * A read an owner may make that a support session may not (A-02 Permissions: the subscription
 * card, the support log; A-02-05 review 2): 403 `forbidden` in a support session.
 */
export const NotInSupportSession = (): MethodDecorator =>
  SetMetadata(NOT_IN_SUPPORT_METADATA, true);

export const ENTITLEMENT_GATE_METADATA = 'shifa:access:entitlement-gate';
export const FLAG_GATE_METADATA = 'shifa:access:flag-gate';

/**
 * With @RequirePermission only (A-02-03): after the permission, the clinic must have the feature
 * entitlement `key` on, else 403 `feature_unavailable`. A key outside the entitlement catalogue
 * stops the start.
 */
export const RequireEntitlement = (key: string): MethodDecorator =>
  SetMetadata(ENTITLEMENT_GATE_METADATA, key);

/**
 * With @RequirePermission only (A-02-03): after the permission, the flag `key` must be on for the
 * clinic, else 403 `feature_unavailable`. A key outside the flag catalogue stops the start.
 */
export const RequireFlag = (key: string): MethodDecorator => SetMetadata(FLAG_GATE_METADATA, key);

/** The principal the guard authenticated for this request (set before the handler runs). */
const principals = new WeakMap<object, Principal>();

export function rememberPrincipal(request: object, principal: Principal): void {
  principals.set(request, principal);
}

/** Factory of @CurrentPrincipal(): the contract check knows it reads no client input. */
export function currentPrincipalFactory(_data: unknown, context: ExecutionContext): Principal {
  const principal = principals.get(context.switchToHttp().getRequest<object>());
  // Only on @SignedIn / @RequirePermission / @PlatformAdmin routes: the guard authenticated.
  if (!principal) throw new Error('@CurrentPrincipal() on a route without authentication');
  return principal;
}

/** Handler parameter: the authenticated principal (never read headers for it yourself). */
export const CurrentPrincipal = createParamDecorator(currentPrincipalFactory);
