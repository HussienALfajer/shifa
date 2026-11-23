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

/** The principal the guard authenticated for this request (set before the handler runs). */
const principals = new WeakMap<object, Principal>();

export function rememberPrincipal(request: object, principal: Principal): void {
  principals.set(request, principal);
}

/** Factory of @CurrentPrincipal(): the contract check knows it reads no client input. */
export function currentPrincipalFactory(_data: unknown, context: ExecutionContext): Principal {
  const principal = principals.get(context.switchToHttp().getRequest<object>());
  // Only on @SignedIn / @RequirePermission routes: the guard ran and authenticated.
  if (!principal) throw new Error('@CurrentPrincipal() on a route without authentication');
  return principal;
}

/** Handler parameter: the authenticated principal (never read headers for it yourself). */
export const CurrentPrincipal = createParamDecorator(currentPrincipalFactory);
