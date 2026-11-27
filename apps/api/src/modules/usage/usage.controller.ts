// A clinic's usage for the super admin's clinic page (A-02 criteria 17, 19; contract rows `use`,
// `useMembers`, `useLoading`, `useEmpty`).
import { Controller, Get, Inject, Param } from '@nestjs/common';
import { type ClinicUsage, platformClinicUsage, type RequestParams } from '@shifa/contracts';
import { CurrentPrincipal, PlatformAdmin, type Principal } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { UsageAdmin } from './admin.service.ts';

@Controller('platform/clinics')
export class PlatformUsageController {
  constructor(@Inject(UsageAdmin) private readonly usage: UsageAdmin) {}

  @PlatformAdmin()
  @Contract(platformClinicUsage)
  @Get(':id/usage')
  clinicUsage(
    @Param() params: RequestParams<typeof platformClinicUsage>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<ClinicUsage> {
    return this.usage.clinicUsage(principal, params.id, request.requestId);
  }
}
