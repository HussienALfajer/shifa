// Global guard, fail-closed: not exactly one access annotation → 500; @Public → pass; otherwise
// authenticate (401), then the MFA gate (A-01a criterion 11: 403 `mfa_enrolment_required` or
// `mfa_challenge_required` on every route not marked @BeforeMfa), then @SignedIn → pass,
// @PlatformAdmin → a super admin (403), @RequirePermission → the key in the principal's active
// tenant/branch, role grants ± the member's sensitive overrides (403), then the route's
// @RequireEntitlement / @RequireFlag gates for that clinic (403 `feature_unavailable`, A-02-03).
// A support session (A-02-05, ADR-0050) is audited first, refused every write but its own end
// (403 `support_read_only`) and every platform route, and gets a READ ONLY scope.
// The principal is kept for @CurrentPrincipal(); the checked `{ tenant, branch, person }` for
// @CurrentScope() (A-01b 8).
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ApiError } from '../platform/errors.ts';
import {
  type AccessAnnotations,
  annotationCount,
  ROLE_GRANTS,
  readAccess,
} from './access-check.ts';
import { AUTH_PORT, type AuthPort } from './auth.port.ts';
import { rememberPrincipal } from './decorators.ts';
import { findGates, type GatePort, NO_GATES } from './gates.ts';
import {
  PERMISSION_CATALOGUE,
  type PermissionCatalogue,
  type PermissionKey,
} from './permissions.ts';
import { isGranted, mfaBlock, type Principal } from './principal.ts';
import type { RoleGrants } from './roles.ts';
import { bindScope, type RequestScope } from './scope.ts';
import { findSupportAudit } from './support.ts';

export { ROLE_GRANTS };

type GuardRequest = Pick<FastifyRequest, 'log'> & {
  routeOptions?: { url?: string | undefined };
  method?: string;
  params?: unknown;
  id?: string;
};

/** The only methods a support session may use, besides its one marked write (A-02 criterion 12). */
const READ_METHODS = new Set(['GET', 'HEAD']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The path's `:id` when it is a UUID, lower-cased (the audit row's target); otherwise null. */
function targetIdOf(params: unknown): string | null {
  if (typeof params !== 'object' || params === null) return null;
  const id = (params as Record<string, unknown>)['id'];
  return typeof id === 'string' && UUID.test(id) ? id.toLowerCase() : null;
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH_PORT) private readonly auth: AuthPort,
    @Inject(ROLE_GRANTS) private readonly grants: RoleGrants,
    @Inject(PERMISSION_CATALOGUE) private readonly catalogue: PermissionCatalogue,
    /** Finds the GatePort (A-02-03); absent in hand-built guards of unit tests (no gates). */
    @Optional() @Inject(ModuleRef) private readonly moduleRef?: ModuleRef,
  ) {}

  #gates: GatePort | undefined;

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
    if (principal.support) {
      await this.#supportSession(request, principal, access, { handler, route });
    }

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
    const bound = bindScope(request, {
      tenantId: principal.tenantId,
      branchId: principal.branchId,
      userId: principal.userId,
      // A support session reads only: every transaction of the request is READ ONLY.
      ...(principal.support ? { readOnly: true as const } : {}),
    });
    await this.#checkGates(request, access, bound, { handler, route, userId: principal.userId });
    return true;
  }

  /**
   * A support session (A-02 criteria 12, 14; ADR-0050): the request is audited first (refused
   * ones too); platform routes are refused (the admin session never travels in a tenant, nor the
   * support session out of one); every route but GET/HEAD, reads by POST (@ReadInBody) and the
   * one marked write answers 403 `support_read_only` before the handler. Logs carry the grant id,
   * never the reason.
   */
  async #supportSession(
    request: GuardRequest,
    principal: Principal,
    access: AccessAnnotations,
    fields: { handler: string; route: string | undefined },
  ): Promise<void> {
    const grantId = principal.support?.grantId;
    const recorder = this.moduleRef ? findSupportAudit(this.moduleRef) : null;
    if (!recorder) {
      request.log.error({ ...fields, grantId }, 'support session without a request audit');
      throw new InternalServerErrorException();
    }
    const method = (request.method ?? '').toUpperCase();
    await recorder.recordRequest(principal, {
      method,
      route: fields.route ?? 'unknown',
      targetId: targetIdOf(request.params),
      requestId: request.id,
    });
    // A read by POST (@ReadInBody, A-03-03) passes like a GET; its scope stays READ ONLY.
    if (!READ_METHODS.has(method) && !access.supportWrite && !access.readInBody) {
      request.log.info(
        { status: 403, ...fields, userId: principal.userId, grantId, reason: 'support_read_only' },
        'access denied',
      );
      throw new ApiError(403, 'support_read_only');
    }
    if (access.platformAdmin) {
      this.#deny(request, { ...fields, userId: principal.userId, grantId, platformAdmin: true });
    }
    // An owner's read the spec keeps from support (subscription card, support log; review 2).
    if (access.notInSupport) {
      this.#deny(request, { ...fields, userId: principal.userId, grantId, notInSupport: true });
    }
  }

  /** After the permission: the route's feature and flag gates for the clinic (A-02-03). */
  async #checkGates(
    request: GuardRequest,
    access: AccessAnnotations,
    scope: RequestScope,
    fields: Record<string, unknown>,
  ): Promise<void> {
    if (access.entitlementGate === undefined && access.flagGate === undefined) return;
    this.#gates ??= this.moduleRef ? findGates(this.moduleRef) : NO_GATES;
    const feature = access.entitlementGate;
    const flag = access.flagGate;
    const open =
      (feature === undefined || (await this.#gates.entitled(scope, feature))) &&
      (flag === undefined || (await this.#gates.flagOn(scope, flag)));
    if (open) return;
    // info, not warn: a clinic without a feature is routine (the screens hide it).
    request.log.info(
      { status: 403, ...fields, reason: 'feature_unavailable', feature, flag },
      'access denied',
    );
    throw new ApiError(403, 'feature_unavailable');
  }

  #deny(request: GuardRequest, fields: Record<string, unknown>): never {
    request.log.warn({ status: 403, ...fields }, 'access denied');
    throw new ForbiddenException();
  }
}
