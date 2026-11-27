// A-01b criteria 6, 7: the permission catalogue (keys with a sensitive flag) injected at
// start-up, the A-01 keys and their default grants, unknown keys refused at start-up (routes and
// grants), and effective grants = role grants ± the member's overrides, overrides counting only
// for sensitive keys and only where the member holds a role.
import { Controller, Get } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RequirePermission } from '../../src/access/decorators.ts';
import {
  assertGrantsKnown,
  PermissionCatalogue,
  type PermissionKey,
  PRODUCTION_PERMISSIONS,
  UnknownPermissionError,
} from '../../src/access/permissions.ts';
import { isGranted } from '../../src/access/principal.ts';
import { PRODUCTION_GRANTS, ROLES } from '../../src/access/roles.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { buildTestApp, offlineDb, testContract } from '../support.ts';
import {
  BRANCH_1,
  BRANCH_2,
  HeaderAuthAdapter,
  headersFor,
  ProbeController,
  principalFor,
  TENANT_A,
  TEST_GRANTS,
  TEST_PERMISSIONS,
} from './probe.ts';

const NOTES = 'clinical.notes.view' as PermissionKey;
const MANAGE = 'members.manage' as PermissionKey;
const production = new PermissionCatalogue(PRODUCTION_PERMISSIONS);
const tenantScope = { tenantId: TENANT_A, branchId: null };

describe('the A-01 catalogue and grants', () => {
  it('lists the A-01 keys; only clinical.notes.view is sensitive', () => {
    expect(PRODUCTION_PERMISSIONS.map((p) => [p.key, p.sensitive])).toEqual([
      ['members.view', false],
      ['members.manage', false],
      ['branches.manage', false],
      ['clinic.settings.manage', false],
      ['clinical.notes.view', true],
      // A-02-03
      ['clinic.capabilities.view', false],
      // A-02-05 (PLT-46): reserved, granted to nobody
      ['support.elevate', false],
    ]);
  });

  it('grants the owner the management keys; notes to doctor and assistant only', () => {
    expect([...PRODUCTION_GRANTS.owner].sort()).toEqual([
      'branches.manage',
      'clinic.capabilities.view',
      'clinic.settings.manage',
      'members.manage',
      'members.view',
    ]);
    expect(PRODUCTION_GRANTS.doctor).toEqual(['clinical.notes.view', 'clinic.capabilities.view']);
    expect(PRODUCTION_GRANTS.assistant).toEqual([
      'clinical.notes.view',
      'clinic.capabilities.view',
    ]);
    // A-02-03: every clinic role reads what its clinic may use; a super admin never does.
    expect(PRODUCTION_GRANTS.receptionist).toEqual(['clinic.capabilities.view']);
    expect(PRODUCTION_GRANTS.accountant).toEqual(['clinic.capabilities.view']);
    expect(PRODUCTION_GRANTS.platform_admin).toEqual([]);
  });

  it('the production grants name catalogue keys only', () => {
    expect(() => {
      assertGrantsKnown(production, PRODUCTION_GRANTS);
    }).not.toThrow();
  });
});

describe('unknown keys', () => {
  it('a catalogue refuses a duplicate or malformed key', () => {
    expect(
      () =>
        new PermissionCatalogue([
          { key: 'a.b', sensitive: false },
          { key: 'a.b', sensitive: true },
        ]),
    ).toThrow();
    expect(() => new PermissionCatalogue([{ key: 'NotAKey', sensitive: false }])).toThrow();
  });

  it('grants naming an unknown key are refused', () => {
    const grants = Object.fromEntries(ROLES.map((r) => [r, []])) as unknown as Record<
      string,
      string[]
    >;
    grants['doctor'] = ['made.up'];
    expect(() => {
      assertGrantsKnown(production, grants);
    }).toThrow(UnknownPermissionError);
  });

  it('the app refuses to start with a route on an unknown key', async () => {
    @Controller('__unknown')
    class UnknownKeyController {
      @RequirePermission('made.up' as PermissionKey)
      @Contract(testContract('GET', '/__unknown'))
      @Get()
      handler(): { ok: true } {
        return { ok: true };
      }
    }
    await expect(
      buildTestApp({ db: offlineDb(), controllers: [UnknownKeyController] }),
    ).rejects.toThrow(/made\.up/);
  });

  it('the app refuses to start with grants on an unknown key', async () => {
    // TEST_GRANTS without TEST_PERMISSIONS: the test keys are not in the catalogue.
    await expect(
      buildTestApp({
        db: offlineDb(),
        controllers: [ProbeController],
        auth: new HeaderAuthAdapter(),
        grants: TEST_GRANTS,
      }),
    ).rejects.toThrow(UnknownPermissionError);
  });
});

describe('effective grants = role grants ± overrides', () => {
  it('an override switches a sensitive key off and on', () => {
    const off = principalFor('doctor', { overrides: [{ key: NOTES, granted: false }] });
    expect(
      isGranted(principalFor('doctor'), NOTES, tenantScope, PRODUCTION_GRANTS, production),
    ).toBe(true);
    expect(isGranted(off, NOTES, tenantScope, PRODUCTION_GRANTS, production)).toBe(false);
    const on = principalFor('receptionist', { overrides: [{ key: NOTES, granted: true }] });
    expect(isGranted(on, NOTES, tenantScope, PRODUCTION_GRANTS, production)).toBe(true);
  });

  it('an override of a non-sensitive key is ignored', () => {
    const forged = principalFor('doctor', { overrides: [{ key: MANAGE, granted: true }] });
    expect(isGranted(forged, MANAGE, tenantScope, PRODUCTION_GRANTS, production)).toBe(false);
    const removed = principalFor('owner', { overrides: [{ key: MANAGE, granted: false }] });
    expect(isGranted(removed, MANAGE, tenantScope, PRODUCTION_GRANTS, production)).toBe(true);
  });

  it('an override grants nothing where the member holds no role', () => {
    const branchOnly = principalFor('receptionist', {
      branchId: BRANCH_2,
      roles: [{ role: 'receptionist', tenantId: TENANT_A, branchId: BRANCH_1 }],
      overrides: [{ key: NOTES, granted: true }],
    });
    const at = (branchId: string) => ({ tenantId: TENANT_A, branchId });
    expect(isGranted(branchOnly, NOTES, at(BRANCH_1), PRODUCTION_GRANTS, production)).toBe(true);
    expect(isGranted(branchOnly, NOTES, at(BRANCH_2), PRODUCTION_GRANTS, production)).toBe(false);
    const superAdmin = principalFor('platform_admin', {
      overrides: [{ key: NOTES, granted: true }],
    });
    expect(isGranted(superAdmin, NOTES, tenantScope, PRODUCTION_GRANTS, production)).toBe(false);
  });

  it('the guard applies overrides per request (toggle on and off)', async () => {
    const app = await buildTestApp({
      db: offlineDb(),
      controllers: [ProbeController],
      auth: new HeaderAuthAdapter(),
      grants: TEST_GRANTS,
      permissions: TEST_PERMISSIONS,
    });
    try {
      const call = (principal: ReturnType<typeof principalFor>) =>
        app.app.inject({ method: 'GET', url: '/__probe/notes', headers: headersFor(principal) });
      expect((await call(principalFor('doctor'))).statusCode).toBe(200);
      const off = principalFor('doctor', { overrides: [{ key: NOTES, granted: false }] });
      expect((await call(off)).statusCode).toBe(403);
      expect((await call(principalFor('receptionist'))).statusCode).toBe(403);
      const on = principalFor('receptionist', { overrides: [{ key: NOTES, granted: true }] });
      expect((await call(on)).statusCode).toBe(200);
    } finally {
      await app.app.close();
    }
  });
});
