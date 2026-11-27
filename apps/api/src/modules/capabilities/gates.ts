// The GatePort the access guard asks (A-02 criterion 5): a feature gate is on when the clinic's
// entitlement of that feature key resolves to true; a flag gate when the flag evaluates on for the
// clinic. Both read their cached ports in the scope the guard checked; a failed flag read counts
// as off (fail-closed).
import { Inject, Injectable } from '@nestjs/common';
import type { GatePort, RequestScope } from '../../access/index.ts';
import {
  ENTITLEMENT_CATALOGUE,
  ENTITLEMENTS,
  type EntitlementCatalogue,
  type EntitlementsPort,
} from '../entitlements/index.ts';
import { FLAG_CATALOGUE, FLAGS, type FlagCatalogue, type FlagClient } from '../flags/index.ts';

@Injectable()
export class CapabilityGates implements GatePort {
  constructor(
    @Inject(ENTITLEMENTS) private readonly entitlements: EntitlementsPort,
    @Inject(ENTITLEMENT_CATALOGUE) private readonly features: EntitlementCatalogue,
    @Inject(FLAGS) private readonly flags: FlagClient,
    @Inject(FLAG_CATALOGUE) private readonly flagCatalogue: FlagCatalogue,
  ) {}

  knowsFeature(key: string): boolean {
    return this.features.has(key) && this.features.kindOf(key) === 'feature';
  }

  knowsFlag(key: string): boolean {
    return this.flagCatalogue.has(key);
  }

  async entitled(scope: RequestScope, key: string): Promise<boolean> {
    return (await this.entitlements.value(scope, key)) === true;
  }

  flagOn(scope: RequestScope, key: string): Promise<boolean> {
    return this.flags.getBooleanValue(key, false, scope);
  }
}
