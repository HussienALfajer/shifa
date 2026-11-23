// Global guard, fail-closed: not exactly one access annotation → 500; @Public → pass; @SignedIn →
// authenticate (401); @RequirePermission → authenticate (401) and check the key in the
// principal's active tenant/branch (403). The principal is kept for @CurrentPrincipal().
// Route scope from path parameters arrives with the Phase A routes.
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
import { AUTH_PORT, type AuthPort } from './auth.port.ts';
import {
  PERMISSION_METADATA,
  PUBLIC_METADATA,
  rememberPrincipal,
  SIGNED_IN_METADATA,
} from './decorators.ts';
import type { PermissionKey } from './permissions.ts';
import { hasPermission } from './principal.ts';
import type { RoleGrants } from './roles.ts';

export const ROLE_GRANTS = Symbol('ROLE_GRANTS');

type GuardRequest = Pick<FastifyRequest, 'log'> & {
  routeOptions?: { url?: string | undefined };
};

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH_PORT) private readonly auth: AuthPort,
    @Inject(ROLE_GRANTS) private readonly grants: RoleGrants,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlerFn = context.getHandler();
    const handler = `${context.getClass().name}.${handlerFn.name}`;
    const request = context.switchToHttp().getRequest<GuardRequest>();
    // The route template, never the URL: the URL can carry a query string.
    const route = request.routeOptions?.url;
    const isPublic = this.reflector.get<boolean | undefined>(PUBLIC_METADATA, handlerFn) === true;
    // Read as string: PermissionKey has no values until Phase A, and the type would collapse.
    const key = this.reflector.get<string | undefined>(PERMISSION_METADATA, handlerFn);
    const signedIn =
      this.reflector.get<boolean | undefined>(SIGNED_IN_METADATA, handlerFn) === true;

    const annotations = [isPublic, key !== undefined, signedIn].filter(Boolean).length;
    if (annotations !== 1) {
      request.log.error({ handler, route }, 'route has no single access annotation');
      throw new InternalServerErrorException();
    }
    if (isPublic) return true;

    const principal = await this.auth.authenticate(request as FastifyRequest);
    if (principal === null) {
      // info, not warn: anonymous probes are routine and must not flood the warning stream.
      request.log.info({ status: 401, handler, route }, 'access denied');
      throw new UnauthorizedException();
    }
    rememberPrincipal(request, principal);
    if (signedIn) return true;
    const scope = { tenantId: principal.tenantId, branchId: principal.branchId };
    if (!hasPermission(principal, key as PermissionKey, scope, this.grants)) {
      request.log.warn(
        { status: 403, handler, route, userId: principal.userId, permission: key },
        'access denied',
      );
      throw new ForbiddenException();
    }
    return true;
  }
}
