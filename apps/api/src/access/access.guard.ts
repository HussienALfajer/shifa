// Global guard, fail-closed: no access metadata → 500; @Public → pass; @RequirePermission →
// authenticate (401) and check the key in the principal's active tenant/branch (403).
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
import { PERMISSION_METADATA, PUBLIC_METADATA } from './decorators.ts';
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

    if (isPublic && key === undefined) return true;
    if (isPublic || key === undefined) {
      request.log.error({ handler, route }, 'route has no single access annotation');
      throw new InternalServerErrorException();
    }

    const principal = await this.auth.authenticate(request as FastifyRequest);
    if (principal === null) {
      // info, not warn: anonymous probes are routine and must not flood the warning stream.
      request.log.info({ status: 401, handler, route }, 'access denied');
      throw new UnauthorizedException();
    }
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
