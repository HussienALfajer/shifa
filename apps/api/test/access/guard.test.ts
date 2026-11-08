// The global access guard: @Public passes, @RequirePermission authenticates through the AuthPort
// and checks the key in the principal's active tenant/branch; production auth admits nobody.
import { Controller, Get } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, offlineDb, type TestApp } from '../support.ts';
import {
  BRANCH_1,
  BRANCH_2,
  HeaderAuthAdapter,
  headersFor,
  ProbeController,
  principalFor,
  TENANT_B,
  TEST_GRANTS,
} from './probe.ts';

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

async function probeApp(withTestAuth = true): Promise<TestApp> {
  current = await buildTestApp({
    db: offlineDb(),
    controllers: [ProbeController],
    ...(withTestAuth ? { auth: new HeaderAuthAdapter(), grants: TEST_GRANTS } : {}),
  });
  return current;
}

async function get(app: TestApp, url: string, headers: Record<string, string> = {}) {
  return app.app.inject({ method: 'GET', url, headers });
}

describe('access guard', () => {
  it('@Public answers 200 to anonymous callers', async () => {
    const app = await probeApp();
    expect((await get(app, '/__probe/public')).statusCode).toBe(200);
  });

  it('permission route: 401 for anonymous callers with the fixed envelope', async () => {
    const app = await probeApp();
    const res = await get(app, '/__probe/read');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'unauthorized', message: 'Unauthorized' } });
  });

  it('permission route: 403 for a role lacking the key, with the fixed envelope', async () => {
    const app = await probeApp();
    const res = await get(app, '/__probe/sensitive', headersFor(principalFor('doctor')));
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: { code: 'forbidden', message: 'Forbidden' } });
  });

  it('permission route: 200 for a role holding the key in the same tenant', async () => {
    const app = await probeApp();
    expect((await get(app, '/__probe/read', headersFor(principalFor('doctor')))).statusCode).toBe(
      200,
    );
    expect(
      (await get(app, '/__probe/sensitive', headersFor(principalFor('owner')))).statusCode,
    ).toBe(200);
  });

  it('permission route: 403 for a role held only in another tenant', async () => {
    const app = await probeApp();
    const principal = principalFor('owner', {
      roles: [{ role: 'owner', tenantId: TENANT_B, branchId: null }],
    });
    expect((await get(app, '/__probe/read', headersFor(principal))).statusCode).toBe(403);
  });

  it('permission route: 403 for a role held only in another branch', async () => {
    const app = await probeApp();
    const elsewhere = principalFor('doctor', {
      branchId: BRANCH_1,
      roles: [{ role: 'doctor', tenantId: principalFor('doctor').tenantId, branchId: BRANCH_2 }],
    });
    expect((await get(app, '/__probe/read', headersFor(elsewhere))).statusCode).toBe(403);
    const here = principalFor('doctor', {
      branchId: BRANCH_1,
      roles: [{ role: 'doctor', tenantId: principalFor('doctor').tenantId, branchId: BRANCH_1 }],
    });
    expect((await get(app, '/__probe/read', headersFor(here))).statusCode).toBe(200);
  });

  it('production adapter: every protected route answers 401, whatever the request carries', async () => {
    const app = await probeApp(false);
    const headers = { ...headersFor(principalFor('owner')), authorization: 'Bearer anything' };
    expect((await get(app, '/__probe/read', headers)).statusCode).toBe(401);
    expect((await get(app, '/__probe/sensitive', headers)).statusCode).toBe(401);
    expect((await get(app, '/__probe/public', headers)).statusCode).toBe(200);
  });

  it('logs denials with the route template and handler, never headers', async () => {
    const app = await probeApp();
    const secret = 'synthetic-token-5521';
    await get(app, '/__probe/read?x=1', { authorization: `Bearer ${secret}` });
    await get(app, '/__probe/sensitive', {
      ...headersFor(principalFor('doctor')),
      authorization: `Bearer ${secret}`,
    });
    const denials = app.logs.records().filter((r) => r.msg === 'access denied');
    expect(denials).toEqual([
      expect.objectContaining({
        status: 401,
        route: '/__probe/read',
        handler: 'ProbeController.read',
      }),
      expect.objectContaining({
        status: 403,
        route: '/__probe/sensitive',
        handler: 'ProbeController.sensitive',
      }),
    ]);
    expect(app.logs.text()).not.toContain(secret);
    expect(app.logs.text()).not.toContain('x-test-principal');
    expect(app.logs.text()).not.toContain('?x=1');
  });
});

describe('access guard without metadata', () => {
  it('answers 500 internal_error and logs the handler, never the URL', async () => {
    // The start-up check refuses unannotated handlers, so reach the guard branch directly.
    const { AccessGuard } = await import('../../src/access/access.guard.ts');
    @Controller('__bare')
    class BareController {
      @Get('x')
      x(): string {
        return 'never';
      }
    }
    const { Reflector } = await import('@nestjs/core');
    const logged: unknown[] = [];
    const guard = new AccessGuard(new Reflector(), new HeaderAuthAdapter(), TEST_GRANTS);
    const request = {
      headers: {},
      url: '/__bare/x?secret=1',
      routeOptions: { url: '/__bare/x' },
      log: { warn: (o: unknown) => logged.push(o), error: (o: unknown) => logged.push(o) },
    };
    const context = {
      // The guard reads metadata from the function; it never calls it.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      getHandler: () => BareController.prototype.x,
      getClass: () => BareController,
      switchToHttp: () => ({ getRequest: () => request }),
    };
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({ status: 500 });
    expect(logged).toEqual([expect.objectContaining({ handler: 'BareController.x' })]);
    expect(JSON.stringify(logged)).not.toContain('secret');
  });
});
