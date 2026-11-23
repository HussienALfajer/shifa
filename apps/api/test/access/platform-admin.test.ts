// A-01-03 access: @PlatformAdmin() is the fourth access annotation (exactly one per handler);
// @BeforeMfa() marks the few @SignedIn routes a person may reach before MFA. The guard refuses
// everything else with 403 `mfa_enrolment_required` to owners and super admins without TOTP,
// and with 403 `mfa_challenge_required` to anyone whose session has not passed the challenge.
import { Controller, Get } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BeforeMfa,
  PlatformAdmin,
  Public,
  RequirePermission,
  SignedIn,
} from '../../src/access/decorators.ts';
import type { Principal } from '../../src/access/principal.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { buildTestApp, offlineDb, type TestApp, testContract } from '../support.ts';
import {
  HeaderAuthAdapter,
  headersFor,
  principalFor,
  TEST_GRANTS,
  TEST_PERMISSIONS,
  TEST_READ,
} from './probe.ts';

@Controller('__mfa')
class MfaProbeController {
  @PlatformAdmin()
  @Contract(testContract('GET', '/__mfa/platform'))
  @Get('platform')
  platform(): { ok: true } {
    return { ok: true };
  }

  @SignedIn()
  @Contract(testContract('GET', '/__mfa/own'))
  @Get('own')
  own(): { ok: true } {
    return { ok: true };
  }

  @SignedIn()
  @BeforeMfa()
  @Contract(testContract('GET', '/__mfa/enrol'))
  @Get('enrol')
  enrol(): { ok: true } {
    return { ok: true };
  }

  @RequirePermission(TEST_READ)
  @Contract(testContract('GET', '/__mfa/read'))
  @Get('read')
  read(): { ok: true } {
    return { ok: true };
  }
}

@Controller('__twice')
class TwiceController {
  @PlatformAdmin()
  @SignedIn()
  @Contract(testContract('GET', '/__twice/a'))
  @Get('a')
  a(): string {
    return 'never';
  }
}

@Controller('__early')
class EarlyPublicController {
  @Public()
  @BeforeMfa()
  @Contract(testContract('GET', '/__early/a'))
  @Get('a')
  a(): string {
    return 'never';
  }
}

@Controller('__early-admin')
class EarlyAdminController {
  @PlatformAdmin()
  @BeforeMfa()
  @Contract(testContract('GET', '/__early-admin/a'))
  @Get('a')
  a(): string {
    return 'never';
  }
}

let app: TestApp;

beforeAll(async () => {
  app = await buildTestApp({
    db: offlineDb(),
    controllers: [MfaProbeController],
    auth: new HeaderAuthAdapter(),
    grants: TEST_GRANTS,
    permissions: TEST_PERMISSIONS,
  });
});

afterAll(async () => {
  await app.app.close();
});

const call = async (url: string, principal: Principal | undefined) => {
  const res = await app.app.inject({ method: 'GET', url, headers: headersFor(principal) });
  const code = res.statusCode < 300 ? 'ok' : res.json<{ error: { code: string } }>().error.code;
  return `${String(res.statusCode)} ${code}`;
};

const superAdmin = (mfa: Principal['mfa']): Principal => ({
  ...principalFor('platform_admin', { tenantId: null, roles: [] }),
  platformAdmin: true,
  mfa,
});

describe('annotations at start', () => {
  it('refuses @PlatformAdmin together with another access annotation', async () => {
    await expect(buildTestApp({ db: offlineDb(), controllers: [TwiceController] })).rejects.toThrow(
      /TwiceController\.a/,
    );
  });

  it('refuses @BeforeMfa on anything but a @SignedIn route', async () => {
    await expect(
      buildTestApp({ db: offlineDb(), controllers: [EarlyPublicController] }),
    ).rejects.toThrow(/EarlyPublicController\.a/);
    await expect(
      buildTestApp({ db: offlineDb(), controllers: [EarlyAdminController] }),
    ).rejects.toThrow(/EarlyAdminController\.a/);
  });
});

describe('@PlatformAdmin', () => {
  it('lets a super admin with MFA through and nobody else', async () => {
    expect(await call('/__mfa/platform', superAdmin('verified'))).toBe('200 ok');
    expect(await call('/__mfa/platform', undefined)).toBe('401 unauthorized');
    expect(
      await call('/__mfa/platform', {
        ...principalFor('owner'),
        platformAdmin: false,
        mfa: 'verified',
      }),
    ).toBe('403 forbidden');
  });

  it('a super admin passes no tenant permission check', async () => {
    expect(await call('/__mfa/read', superAdmin('verified'))).toBe('403 forbidden');
  });
});

describe('MFA gate', () => {
  it('owners and super admins without TOTP reach only @BeforeMfa routes', async () => {
    const owner: Principal = { ...principalFor('owner'), platformAdmin: false, mfa: 'none' };
    for (const who of [owner, superAdmin('none')]) {
      expect(await call('/__mfa/enrol', who)).toBe('200 ok');
      expect(await call('/__mfa/own', who)).toBe('403 mfa_enrolment_required');
    }
    expect(await call('/__mfa/read', owner)).toBe('403 mfa_enrolment_required');
    expect(await call('/__mfa/platform', superAdmin('none'))).toBe('403 mfa_enrolment_required');
  });

  it('a session that has not passed the challenge reaches only @BeforeMfa routes', async () => {
    const doctor: Principal = { ...principalFor('doctor'), platformAdmin: false, mfa: 'pending' };
    expect(await call('/__mfa/enrol', doctor)).toBe('200 ok');
    expect(await call('/__mfa/own', doctor)).toBe('403 mfa_challenge_required');
    expect(await call('/__mfa/read', doctor)).toBe('403 mfa_challenge_required');
    expect(await call('/__mfa/platform', superAdmin('pending'))).toBe('403 mfa_challenge_required');
  });

  it('staff other than owners are not forced to enrol', async () => {
    const doctor: Principal = { ...principalFor('doctor'), platformAdmin: false, mfa: 'none' };
    expect(await call('/__mfa/own', doctor)).toBe('200 ok');
    expect(await call('/__mfa/read', doctor)).toBe('200 ok');
  });
});
