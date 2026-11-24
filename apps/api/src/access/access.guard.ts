// Global guard, fail-closed: not exactly one access annotation → 500; @Public → pass; otherwise
// authenticate (401), then the MFA gate (A-01a criterion 11: 403 `mfa_enrolment_required` or
// `mfa_challenge_required` on every route not marked @BeforeMfa), then @SignedIn → pass,
// @PlatformAdmin → a super admin (403), @RequirePermission → the key in the principal's active
// tenant/branch, role grants ± the member's sensitive overrides (403). The principal is kept for
// @CurrentPrincipal(); the checked `{ tenant, branch, person }` for @CurrentScope() (A-01b 8).
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ApiError } from '../platform/errors.ts';
import { annotationCount, ROLE_GRANTS, readAccess } from './access-check.ts';
import { AUTH_PORT, type AuthPort } from './auth.port.ts';
import { rememberPrincipal } from './decorators.ts';
import {
  PERMISSION_CATALOGUE,
  type PermissionCatalogue,
  type PermissionKey,
} from './permissions.ts';
import { isGranted, mfaBlock } from './principal.ts';
import type { RoleGrants } from './roles.ts';
import { bindScope } from './scope.ts';

export { ROLE_GRANTS };

type GuardRequest = Pick<FastifyRequest, 'log'> & {
  routeOptions?: { url?: string | undefined };
};

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH_PORT) private readonly auth: AuthPort,
    @Inject(ROLE_GRANTS) private readonly grants: RoleGrants,
    @Inject(PERMISSION_CATALOGUE) private readonly catalogue: PermissionCatalogue,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlerFn = context.getHandler();
    const handler = `${context.getClass().name}.${handlerFn.name}`;
    const request = context.switchToHttp().getRequest<GuardRequest>();
    // The route template, never the URL: the URL can carry a query string.
    const route = request.routeOptions?.url;
    const access = readAccess(this.reflector, handlerFn);

    if (annotationCount(access) !== 1 || (access.beforeMfa && !access.signedIn)) {
      request.log.error({ handler, route }, 'route has no single access annotation');
      throw new InternalServerErrorException();
    }
    if (access.isPublic) return true;

    const principal = await this.auth.authenticate(request as FastifyRequest);
    if (principal === null) {
      // info, not warn: anonymous probes are routine and must not flood the warning stream.
      request.log.info({ status: 401, handler, route }, 'access denied');
      throw new UnauthorizedException();
    }
    rememberPrincipal(request, principal);

    const block = access.beforeMfa ? null : mfaBlock(principal);
    if (block) {
      request.log.info(
        { status: 403, handler, route, userId: principal.userId, reason: block },
        'access denied',
      );
      throw new ApiError(403, block);
    }
    if (access.signedIn) return true;
    if (access.platformAdmin) {
      if (principal.platformAdmin) return true;
      this.#deny(request, { handler, route, userId: principal.userId, platformAdmin: true });
    }
    if (principal.clinicSuspended) {
      // Tenant routes only: @SignedIn routes (/me/*, sign-out) went through above.
      request.log.info(
        { status: 403, handler, route, userId: principal.userId, reason: 'clinic_suspended' },
        'access denied',
      );
      throw new ApiError(403, 'clinic_suspended');
    }
    const scope = { tenantId: principal.tenantId, branchId: principal.branchId };
    const key = access.permission as PermissionKey;
    if (
      principal.tenantId === null ||
      !isGranted(principal, key, scope, this.grants, this.catalogue)
    ) {
      this.#deny(request, { handler, route, userId: principal.userId, permission: key });
    }
    // Bound to exactly what was checked: handlers reach tenant data only with this scope.
    bindScope(request, {
      tenantId: principal.tenantId,
      branchId: principal.branchId,
      userId: principal.userId,
    });
    return true;
  }

  #deny(request: GuardRequest, fields: Record<string, unknown>): never {
    request.log.warn({ status: 403, ...fields }, 'access denied');
    throw new ForbiddenException();
  }
}
