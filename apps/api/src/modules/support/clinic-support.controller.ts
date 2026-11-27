// The owner's support routes (A-02 criteria 13, 26; contract rows `banner` … `logEmpty`):
// `clinic.settings.manage`, an owner's key. A support session holds the synthesised owner role but
// reaches neither: the log is refused it (403, @NotInSupportSession) and the end is a write (403
// `support_read_only`).
import { Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  type ClinicSupportGrants,
  clinicEndSupportGrant,
  clinicSupportGrants,
  type RequestParams,
  type SupportGrantView,
} from '@shifa/contracts';
import {
  CurrentScope,
  NotInSupportSession,
  type RequestScope,
  RequirePermission,
} from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { ClinicSupport } from './clinic-support.service.ts';

@Controller('clinic/support-grants')
export class ClinicSupportController {
  constructor(@Inject(ClinicSupport) private readonly support: ClinicSupport) {}

  // A-02 Permissions: the support log is the owner's, never a support session's (review 2).
  @RequirePermission('clinic.settings.manage')
  @NotInSupportSession()
  @Contract(clinicSupportGrants)
  @Get()
  list(@CurrentScope() scope: RequestScope): Promise<ClinicSupportGrants> {
    return this.support.list(scope);
  }

  @RequirePermission('clinic.settings.manage')
  @Contract(clinicEndSupportGrant)
  @HttpCode(200)
  @Post(':id/end')
  end(
    @Param() params: RequestParams<typeof clinicEndSupportGrant>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<SupportGrantView> {
    return this.support.end(scope, params.id, request.requestId);
  }
}
