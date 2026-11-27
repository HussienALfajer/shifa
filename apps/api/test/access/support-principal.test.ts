// A-02-05 (criteria 11–14, ADR-0050) at the access layer, without a database: the support principal
// in the AuthPort contract (only a super admin in a tenant, with the synthesised tenant-wide owner
// role alone, no toggles, the clinic never marked suspended); a support principal with no request
// audit is refused with 500 (fail-closed); `support.elevate` is in the catalogue, not sensitive, and
// granted to nobody; @SupportSessionWrite only with @SignedIn.
import { Controller, Get, Post } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AccessGuard } from '../../src/access/access.guard.ts';
import { readAccess } from '../../src/access/access-check.ts';
import { RequirePermission, SignedIn, SupportSessionWrite } from '../../src/access/decorators.ts';
import { PermissionCatalogue, PRODUCTION_PERMISSIONS } from '../../src/access/permissions.ts';
import { PrincipalSchema } from '../../src/access/principal.ts';
import { PRODUCTION_GRANTS, ROLES } from '../../src/access/roles.ts';
import { HeaderAuthAdapter, PRINCIPAL_HEADER } from './probe.ts';

const USER = '0b6f2a4e-6c1d-4d7a-9b0e-2f4c5a6b7c8d';
const TENANT = '2d8f4c6a-8e3f-4f9c-9d2a-4b6e7c8d9fa0';
const BRANCH = '4fab6e8c-a05b-4b1e-9f4c-6d8a9eafbc2d';
const GRANT = '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

const support = {
  userId: USER,
  sessionId: null,
  tenantId: TENANT,
  branchId: null,
  roles: [{ role: 'owner', tenantId: TENANT, branchId: null }],
  platformAdmin: true,
  mfa: 'verified',
  support: { grantId: GRANT, expiresAt: '2026-11-27T10:00:00.000Z' },
};

describe('the support principal (AuthPort contract)', () => {
  it('accepts a super admin reading one clinic as its owner', () => {
    expect(PrincipalSchema.safeParse(support).success).toBe(true);
  });

  it.each([
    ['without the super-admin flag', { ...support, platformAdmin: false }],
    ['without a tenant', { ...support, tenantId: null, roles: [] }],
    ['in a branch', { ...support, branchId: BRANCH }],
    [
      'with another role',
      { ...support, roles: [{ role: 'doctor', tenantId: TENANT, branchId: null }] },
    ],
    [
      'with a branch role',
      { ...support, roles: [{ role: 'owner', tenantId: TENANT, branchId: BRANCH }] },
    ],
    [
      'with member toggles',
      { ...support, overrides: [{ key: 'clinical.notes.view', granted: true }] },
    ],
    [
      'with a grant id that is not a UUID',
      { ...support, support: { grantId: 'g', expiresAt: support.support.expiresAt } },
    ],
    [
      'with an extra field (a reason)',
      { ...support, support: { ...support.support, reason: 'x' } },
    ],
  ])('refuses one %s', (_label, candidate) => {
    expect(PrincipalSchema.safeParse(candidate).success).toBe(false);
  });
});

describe('support.elevate (PLT-46)', () => {
  it('is reserved in the catalogue, not sensitive, and granted to no role', () => {
    const catalogue = new PermissionCatalogue(PRODUCTION_PERMISSIONS);
    expect(catalogue.has('support.elevate')).toBe(true);
    expect(catalogue.isSensitive('support.elevate')).toBe(false);
    for (const role of ROLES) {
      expect(PRODUCTION_GRANTS[role] as readonly string[], role).not.toContain('support.elevate');
    }
  });
});

describe('the guard in a support session', () => {
  @Controller('__support_unit')
  class UnitController {
    @RequirePermission('clinic.settings.manage')
    @Get('read')
    read(): string {
      return 'never';
    }

    @SignedIn()
    @SupportSessionWrite()
    @Post('end')
    end(): string {
      return 'never';
    }
  }

  it('refuses with 500 when no request audit is provided (no unaudited support request)', async () => {
    const logged: unknown[] = [];
    const guard = new AccessGuard(
      new Reflector(),
      new HeaderAuthAdapter(),
      PRODUCTION_GRANTS,
      new PermissionCatalogue(PRODUCTION_PERMISSIONS),
    );
    const request = {
      method: 'GET',
      headers: { [PRINCIPAL_HEADER]: JSON.stringify(support) },
      routeOptions: { url: '/__support_unit/read' },
      log: {
        error: (o: unknown) => logged.push(o),
        info: (o: unknown) => logged.push(o),
        warn: (o: unknown) => logged.push(o),
      },
    };
    const context = {
      // The guard reads metadata from the function; it never calls it.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      getHandler: () => UnitController.prototype.read,
      getClass: () => UnitController,
      switchToHttp: () => ({ getRequest: () => request }),
    };
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({ status: 500 });
    expect(JSON.stringify(logged)).toContain(GRANT);
  });

  it('reads @SupportSessionWrite as the one allowed write', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(readAccess(new Reflector(), UnitController.prototype.end).supportWrite).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(readAccess(new Reflector(), UnitController.prototype.read).supportWrite).toBe(false);
  });
});
