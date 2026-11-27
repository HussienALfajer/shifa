// Scope binding (A-01b criterion 8, backlog M1): the guard checks a permission in one tenant,
// branch and person, and hands exactly that scope to the handler (@CurrentScope()). TenantDb
// opens withTenant() only with a scope issued here, so a handler cannot run in a tenant the guard
// did not check: a copied, edited or hand-made object is no scope. The one documented exception
// is linkScope(): a route bound to a verified link (invitation acceptance) takes the link's
// tenant, because the person is not yet a member there.
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface RequestScope {
  readonly tenantId: string;
  readonly branchId: string | null;
  /** The person acting (audit actor, `app.user_id`). */
  readonly userId: string;
  /**
   * A support session's scope (A-02-05): TenantDb opens every transaction READ ONLY, so a write
   * the guard did not refuse still fails in the database. Absent for every other scope.
   */
  readonly readOnly?: true;
}

const issued = new WeakSet<object>();
const byRequest = new WeakMap<object, RequestScope>();

function issue(scope: RequestScope): RequestScope {
  const frozen = Object.freeze({ ...scope });
  issued.add(frozen);
  return frozen;
}

/** Guard only: the scope it checked for this request. */
export function bindScope(request: object, scope: RequestScope): RequestScope {
  const bound = issue(scope);
  byRequest.set(request, bound);
  return bound;
}

/**
 * The documented exception: a route bound to a verified link (invitation accept and decline)
 * acts in the link's clinic. Call only after the link was found by its token hash.
 */
export function linkScope(scope: { tenantId: string; userId: string }): RequestScope {
  return issue({ tenantId: scope.tenantId, branchId: null, userId: scope.userId });
}

/** True only for a scope the guard or linkScope() issued (and nobody changed: it is frozen). */
export function isIssuedScope(candidate: unknown): candidate is RequestScope {
  return typeof candidate === 'object' && candidate !== null && issued.has(candidate);
}

/** Factory of @CurrentScope(): the contract check knows it reads no client input. */
export function currentScopeFactory(_data: unknown, context: ExecutionContext): RequestScope {
  const scope = byRequest.get(context.switchToHttp().getRequest<object>());
  // Only on @RequirePermission routes: the guard checked a tenant.
  if (!scope) throw new Error('@CurrentScope() on a route without a permission check');
  return scope;
}

/** Handler parameter: the tenant, branch and person the guard checked for this request. */
export const CurrentScope = createParamDecorator(currentScopeFactory);
