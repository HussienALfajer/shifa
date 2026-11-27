// The owner's support routes (A-02 criteria 13, 26; contract rows `banner` … `logEmpty`):
// `clinic.settings.manage`, an owner's key. The support session reads them too (it holds the
// synthesised owner role) but cannot end a grant here: the guard answers 403 `support_read_only`.
import { Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  type ClinicSupportGrants,
  clinicEndSupportGrant,
  clinicSupportGrants,
  type RequestParams,
  type SupportGrantView,
} from '@shifa/contracts';
import { CurrentScope, type RequestScope, RequirePermission } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { ClinicSupport } from './clinic-support.service.ts';

@Controller('clinic/support-grants')
export class ClinicSupportController {
  constructor(@Inject(ClinicSupport) private readonly support: ClinicSupport) {}

  @RequirePermission('clinic.settings.manage')
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
