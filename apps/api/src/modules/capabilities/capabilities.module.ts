// The capabilities bounded context (A-02-03): what the active clinic may use, for clinic web
// (GET /clinic/capabilities) and the owner's subscription card (GET /clinic/subscription), and the
// GatePort the access guard checks @RequireEntitlement and @RequireFlag with (GATE_PORT).
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { GATE_PORT } from '../../access/index.ts';
import { CapabilitiesController } from './capabilities.controller.ts';
import { CapabilitiesService } from './capabilities.service.ts';
import { CapabilityGates } from './gates.ts';

@Module({})
export class CapabilitiesModule {
  /** `entitlements` and `flags`: the registered EntitlementsModule and FlagsModule. */
  static register({
    entitlements,
    flags,
  }: {
    entitlements: NonNullable<ModuleMetadata['imports']>[number];
    flags: NonNullable<ModuleMetadata['imports']>[number];
  }): DynamicModule {
    return {
      module: CapabilitiesModule,
      imports: [entitlements, flags],
      controllers: [CapabilitiesController],
      providers: [
        CapabilitiesService,
        CapabilityGates,
        { provide: GATE_PORT, useExisting: CapabilityGates },
      ],
    };
  }
}
