// The only way product modules reach tenant data (A-01b criterion 8): withTenant() with the
// tenant, branch and person of a scope the guard issued (@CurrentScope()) or a verified link
// (linkScope()). Anything else throws before any SQL is sent.
import { Inject, Injectable } from '@nestjs/common';
import type { ShifaDb, Tx } from '@shifa/db';
import { SHIFA_DB } from '../platform/database.module.ts';
import { isIssuedScope, type RequestScope } from './scope.ts';

export class ScopeBindingError extends Error {
  override name = 'ScopeBindingError';
  constructor() {
    super('withTenant() needs the scope the guard checked');
  }
}

/** withTenant() on `db` with an issued scope only (TenantDb, and the auth path's link reads). */
export function withScope<T>(
  db: ShifaDb,
  scope: RequestScope,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!isIssuedScope(scope)) return Promise.reject(new ScopeBindingError());
  return db.withTenant(
    {
      tenantId: scope.tenantId,
      ...(scope.branchId === null ? {} : { branchId: scope.branchId }),
      userId: scope.userId,
    },
    fn,
  );
}

@Injectable()
export class TenantDb {
  constructor(@Inject(SHIFA_DB) private readonly db: ShifaDb) {}

  run<T>(scope: RequestScope, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return withScope(this.db, scope, fn);
  }
}
