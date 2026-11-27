// The clinic's own view of what it may use (A-02 criteria 5, 6): every member reads its
// capabilities (`clinic.capabilities.view`, granted to every clinic role); the owner reads the
// subscription card (`clinic.settings.manage`). Contract rows `A02cLimits` and `settings` of
// A-02-screen-contract.md.
import { Controller, Get, Inject } from '@nestjs/common';
import {
  type Capabilities,
  clinicCapabilities,
  clinicSubscription,
  type Subscription,
} from '@shifa/contracts';
import {
  CurrentScope,
  NotInSupportSession,
  type RequestScope,
  RequirePermission,
} from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { CapabilitiesService } from './capabilities.service.ts';

@Controller('clinic')
export class CapabilitiesController {
  constructor(@Inject(CapabilitiesService) private readonly service: CapabilitiesService) {}

  @RequirePermission('clinic.capabilities.view')
  @Contract(clinicCapabilities)
  @Get('capabilities')
  capabilities(@CurrentScope() scope: RequestScope): Promise<Capabilities> {
    return this.service.capabilities(scope);
  }

  // A-02 Permissions: the subscription card is the owner's, never a support session's.
  @RequirePermission('clinic.settings.manage')
  @NotInSupportSession()
  @Contract(clinicSubscription)
  @Get('subscription')
  subscription(@CurrentScope() scope: RequestScope): Promise<Subscription> {
    return this.service.subscription(scope);
  }
}
