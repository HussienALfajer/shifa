// The super admin's support routes (A-02 criteria 11, 12; contract rows `sup`, `supOpen`, «فتح عيادة
// الويب», `supEnded` of A-02-screen-contract.md). @PlatformAdmin only (a support session is refused
// them by the guard); each call is audited by withPlatformAdmin().
import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  type OpenedSupportGrant,
  type PlatformSupportGrants,
  platformEndSupportGrant,
  platformOpenSupportGrant,
  platformSupportGrants,
  platformSupportHandoff,
  type RequestBody,
  type RequestParams,
  type SupportGrantView,
  type SupportHandoff,
} from '@shifa/contracts';
import { CurrentPrincipal, PlatformAdmin, type Principal } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { PlatformSupport } from './platform-support.service.ts';

@Controller('platform')
export class PlatformSupportController {
  constructor(@Inject(PlatformSupport) private readonly support: PlatformSupport) {}

  @PlatformAdmin()
  @Contract(platformSupportGrants)
  @Get('clinics/:id/support-grants')
  list(
    @Param() params: RequestParams<typeof platformSupportGrants>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<PlatformSupportGrants> {
    return this.support.list(principal, params.id, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformOpenSupportGrant)
  @Post('clinics/:id/support-grants')
  open(
    @Param() params: RequestParams<typeof platformOpenSupportGrant>,
    @Body() body: RequestBody<typeof platformOpenSupportGrant>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<OpenedSupportGrant> {
    return this.support.open(principal, params.id, body, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformSupportHandoff)
  @HttpCode(200)
  @Post('support-grants/:id/handoff')
  handoff(
    @Param() params: RequestParams<typeof platformSupportHandoff>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<SupportHandoff> {
    return this.support.handoff(principal, params.id, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformEndSupportGrant)
  @HttpCode(200)
  @Post('support-grants/:id/end')
  end(
    @Param() params: RequestParams<typeof platformEndSupportGrant>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<SupportGrantView> {
    return this.support.end(principal, params.id, request.requestId);
  }
}
