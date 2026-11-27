// A-02 criterion 5: @RequireEntitlement and @RequireFlag sit next to the one access annotation and
// are checked by the guard after the permission. The start-up check refuses a gate naming a key
// no catalogue lists, and a gate on a route without a permission check (no clinic to gate).
import { Controller, Get } from '@nestjs/common';
import { testDb } from '@shifa/db/testing';
import { describe, expect, it } from 'vitest';
import { RequireFlag, SignedIn } from '../../src/access/index.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { buildTestApp, testContract } from '../support.ts';
import {
  GatedProbeController,
  TEST_ENTITLEMENTS,
  TEST_FLAGS,
  UnknownEntitlementProbe,
  UnknownFlagProbe,
} from './gated-probe.ts';

@Controller('__probe')
class GateWithoutPermission {
  @SignedIn()
  @RequireFlag('test.flag_on')
  @Contract(testContract('GET', '/__probe/signed-in-gated'))
  @Get('signed-in-gated')
  gated(): { ok: true } {
    return { ok: true };
  }
}

describe('route gates at start-up (criterion 5)', () => {
  it('starts with gates whose keys the catalogues list', async () => {
    const app = await buildTestApp({
      db: testDb(),
      controllers: [GatedProbeController],
      entitlements: TEST_ENTITLEMENTS,
      flags: TEST_FLAGS,
    });
    expect(app.routes).toContain('GET /__probe/flagged');
    await app.app.close();
  });

  it('refuses gated routes when the test keys are not in the catalogues', async () => {
    await expect(
      buildTestApp({ db: testDb(), controllers: [GatedProbeController] }),
    ).rejects.toThrow(/test\.feature/);
  });

  it.each([
    ['an unknown entitlement', UnknownEntitlementProbe, /test\.not_listed/],
    ['an unknown flag', UnknownFlagProbe, /test\.not_listed/],
    ['a gate without a permission check', GateWithoutPermission, /@RequirePermission/],
  ] as const)('refuses %s', async (_name, controller, message) => {
    await expect(
      buildTestApp({
        db: testDb(),
        controllers: [controller],
        entitlements: TEST_ENTITLEMENTS,
        flags: TEST_FLAGS,
      }),
    ).rejects.toThrow(message);
  });
});
