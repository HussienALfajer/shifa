// A-01b criterion 8 (backlog M1): the guard stores `{ principal, scope }` for the request;
// handlers read the scope with @CurrentScope(); TenantDb.run() opens withTenant() only with a
// scope the guard issued, so a handler whose tenant differs from the checked scope fails (500)
// before any SQL; a link-bound scope is the one documented exception (linkScope()).
import { Controller, Get, Inject } from '@nestjs/common';
import type { ShifaDb, TenantContext } from '@shifa/db';
import { afterEach, describe, expect, it } from 'vitest';
import { RequirePermission } from '../../src/access/decorators.ts';
import {
  CurrentScope,
  isIssuedScope,
  linkScope,
  type RequestScope,
} from '../../src/access/scope.ts';
import { TenantDb } from '../../src/access/tenant-db.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { buildTestApp, type TestApp, testContract } from '../support.ts';
import {
  BRANCH_1,
  HeaderAuthAdapter,
  headersFor,
  principalFor,
  TENANT_A,
  TENANT_B,
  TEST_GRANTS,
  TEST_PERMISSIONS,
  TEST_READ,
} from './probe.ts';

/** A database that records each withTenant() context and runs nothing. */
function recordingDb(): ShifaDb & { contexts: TenantContext[] } {
  const contexts: TenantContext[] = [];
  return {
    contexts,
    withTenant: <T>(ctx: TenantContext, fn: (tx: never) => Promise<T>) => {
      contexts.push(ctx);
      return fn(undefined as never);
    },
    ping: () => Promise.resolve(),
    close: () => Promise.resolve(),
  } as ShifaDb & { contexts: TenantContext[] };
}

@Controller('__scope')
class ScopeController {
  constructor(@Inject(TenantDb) private readonly tenants: TenantDb) {}

  @RequirePermission(TEST_READ)
  @Contract(testContract('GET', '/__scope/bound'))
  @Get('bound')
  async bound(@CurrentScope() scope: RequestScope): Promise<{ tenantId: string }> {
    return this.tenants.run(scope, () => Promise.resolve({ tenantId: scope.tenantId }));
  }

  @RequirePermission(TEST_READ)
  @Contract(testContract('GET', '/__scope/forged'))
  @Get('forged')
  async forged(@CurrentScope() scope: RequestScope): Promise<unknown> {
    // A handler that reaches for another tenant than the guard checked.
    const other = { ...scope, tenantId: TENANT_B } as RequestScope;
    return this.tenants.run(other, () => Promise.resolve({ leaked: true }));
  }

  @RequirePermission(TEST_READ)
  @Contract(testContract('GET', '/__scope/mutated'))
  @Get('mutated')
  async mutated(@CurrentScope() scope: RequestScope): Promise<unknown> {
    (scope as { tenantId: string }).tenantId = TENANT_B;
    return this.tenants.run(scope, () => Promise.resolve({ leaked: true }));
  }
}

let current: (TestApp & { db: ReturnType<typeof recordingDb> }) | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

async function scopeApp() {
  const db = recordingDb();
  const app = await buildTestApp({
    db,
    controllers: [ScopeController],
    auth: new HeaderAuthAdapter(),
    grants: TEST_GRANTS,
    permissions: TEST_PERMISSIONS,
  });
  current = { ...app, db };
  return current;
}

describe('scope binding', () => {
  it('a handler runs in exactly the tenant, branch and person the guard checked', async () => {
    const app = await scopeApp();
    const principal = principalFor('doctor', { userId: 'u-1', branchId: BRANCH_1 });
    const res = await app.app.inject({
      method: 'GET',
      url: '/__scope/bound',
      headers: headersFor(principal),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tenantId: TENANT_A });
    expect(app.db.contexts).toEqual([{ tenantId: TENANT_A, branchId: BRANCH_1, userId: 'u-1' }]);
  });

  it('a handler tenant different from the checked scope fails before any SQL (500)', async () => {
    const app = await scopeApp();
    const headers = headersFor(principalFor('doctor'));
    for (const url of ['/__scope/forged', '/__scope/mutated']) {
      const res = await app.app.inject({ method: 'GET', url, headers });
      expect(res.statusCode, url).toBe(500);
      expect(res.body).not.toContain('leaked');
    }
    expect(app.db.contexts).toEqual([]);
  });

  it('only the guard and linkScope() issue scopes; plain objects are not scopes', () => {
    const plain = { tenantId: TENANT_A, branchId: null, userId: 'u-1' };
    expect(isIssuedScope(plain)).toBe(false);
    const link = linkScope({ tenantId: TENANT_A, userId: 'u-1' });
    expect(isIssuedScope(link)).toBe(true);
    expect(Object.isFrozen(link)).toBe(true);
    expect(link).toEqual({ tenantId: TENANT_A, branchId: null, userId: 'u-1' });
  });

  it('TenantDb.run refuses a scope it did not issue', async () => {
    const db = recordingDb();
    const tenants = new TenantDb(db);
    await expect(
      tenants.run({ tenantId: TENANT_A, branchId: null, userId: 'u-1' } as RequestScope, () =>
        Promise.resolve(1),
      ),
    ).rejects.toThrow(/scope/);
    expect(db.contexts).toEqual([]);
  });
});
