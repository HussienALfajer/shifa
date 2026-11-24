// Review 0.2-06c: the test app must add test grants to the production grants, never replace
// them, and the route list must keep explicit HEAD routes.
import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AccessGuard } from '../../src/access/access.guard.ts';
import { Public, RequirePermission } from '../../src/access/decorators.ts';
import {
  PermissionCatalogue,
  type PermissionKey,
  PRODUCTION_PERMISSIONS,
} from '../../src/access/permissions.ts';
import type { RoleGrants } from '../../src/access/roles.ts';
import { mergeGrants, routeList } from '../support.ts';
import { HeaderAuthAdapter, TEST_GRANTS, TEST_PERMISSIONS, TEST_READ } from './probe.ts';

const REAL = 'patients.read' as unknown as PermissionKey;
const none: RoleGrants = {
  owner: [],
  doctor: [],
  receptionist: [],
  assistant: [],
  accountant: [],
  platform_admin: [],
};

describe('mergeGrants', () => {
  it('keeps every production grant next to the test grants', () => {
    const production: RoleGrants = { ...none, accountant: [REAL] };
    const merged = mergeGrants(production, TEST_GRANTS);
    expect(merged.accountant).toEqual([REAL]);
    expect(merged.owner).toEqual(TEST_GRANTS.owner);
  });
});

describe('routeList', () => {
  const get = () => 'get';
  const head = () => 'head';

  it('drops only the HEAD twins of GET routes', () => {
    expect(
      routeList([
        { method: 'GET', url: '/a', handler: get },
        { method: 'HEAD', url: '/a', handler: get },
        { method: 'HEAD', url: '/b', handler: head },
      ]),
    ).toEqual(['GET /a', 'HEAD /b']);
  });

  it('keeps an explicit HEAD declared before the GET of the same URL (backlog L8)', () => {
    expect(
      routeList([
        { method: 'HEAD', url: '/c', handler: head },
        { method: 'GET', url: '/c', handler: get },
      ]),
    ).toEqual(['HEAD /c', 'GET /c']);
  });
});

@Controller('__both')
class BothController {
  @Public()
  @RequirePermission(TEST_READ)
  @Get('x')
  x(): string {
    return 'never';
  }
}

describe('access guard with both annotations', () => {
  it('answers 500 instead of treating the handler as public', async () => {
    const guard = new AccessGuard(
      new Reflector(),
      new HeaderAuthAdapter(),
      TEST_GRANTS,
      new PermissionCatalogue([...PRODUCTION_PERMISSIONS, ...TEST_PERMISSIONS]),
    );
    const request = {
      headers: {},
      routeOptions: { url: '/__both/x' },
      log: { warn: () => undefined, error: () => undefined },
    };
    const context = {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      getHandler: () => BothController.prototype.x,
      getClass: () => BothController,
      switchToHttp: () => ({ getRequest: () => request }),
    };
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({ status: 500 });
  });
});
