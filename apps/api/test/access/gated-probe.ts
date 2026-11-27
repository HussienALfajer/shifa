// Test-only gates (A-02 criterion 5): probe routes behind @RequireEntitlement and @RequireFlag
// with test keys, since no production route is gated yet. The keys join the catalogues only
// through `buildTestApp({ entitlements, flags })`; an app built without them refuses to start.
import { Controller, Get } from '@nestjs/common';
import { RequireEntitlement, RequireFlag, RequirePermission } from '../../src/access/index.ts';
import type { EntitlementDefinition } from '../../src/modules/entitlements/index.ts';
import type { FlagDefinition } from '../../src/modules/flags/index.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { testContract } from '../support.ts';

/** A feature the test clinic is given by an override, and one nobody has. */
export const TEST_ENTITLEMENTS: readonly EntitlementDefinition[] = [
  { key: 'test.feature', kind: 'feature', description: 'test-only feature' },
  { key: 'test.other_feature', kind: 'feature', description: 'test-only feature, never given' },
];

/** One flag on by default, one off by default. */
export const TEST_FLAGS: readonly FlagDefinition[] = [
  { key: 'test.flag_on', description: 'test-only flag, on by default', defaultValue: true },
  { key: 'test.flag_off', description: 'test-only flag, off by default', defaultValue: false },
];

@Controller('__probe')
export class GatedProbeController {
  @RequirePermission('members.view')
  @RequireEntitlement('test.feature')
  @Contract(testContract('GET', '/__probe/entitled'))
  @Get('entitled')
  entitled(): { ok: true } {
    return { ok: true };
  }

  @RequirePermission('members.view')
  @RequireEntitlement('test.other_feature')
  @Contract(testContract('GET', '/__probe/unentitled'))
  @Get('unentitled')
  unentitled(): { ok: true } {
    return { ok: true };
  }

  @RequirePermission('members.view')
  @RequireFlag('test.flag_on')
  @Contract(testContract('GET', '/__probe/flagged'))
  @Get('flagged')
  flagged(): { ok: true } {
    return { ok: true };
  }

  @RequirePermission('members.view')
  @RequireFlag('test.flag_off')
  @Contract(testContract('GET', '/__probe/unflagged'))
  @Get('unflagged')
  unflagged(): { ok: true } {
    return { ok: true };
  }
}

/** A route gated on a key no catalogue lists: the start-up check refuses the app. */
@Controller('__probe')
export class UnknownEntitlementProbe {
  @RequirePermission('members.view')
  @RequireEntitlement('test.not_listed')
  @Contract(testContract('GET', '/__probe/unknown-entitlement'))
  @Get('unknown-entitlement')
  unknown(): { ok: true } {
    return { ok: true };
  }
}

@Controller('__probe')
export class UnknownFlagProbe {
  @RequirePermission('members.view')
  @RequireFlag('test.not_listed')
  @Contract(testContract('GET', '/__probe/unknown-flag'))
  @Get('unknown-flag')
  unknown(): { ok: true } {
    return { ok: true };
  }
}
