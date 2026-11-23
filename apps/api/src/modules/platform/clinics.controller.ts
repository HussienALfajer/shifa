// The super-admin API (A-01a criteria 2, 3, 13): @PlatformAdmin routes only. The guard has
// already required a super admin whose session passed MFA; every call is audited by
// withPlatformAdmin() in ClinicsService.
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type ClinicCreated,
  type ClinicDetail,
  type ClinicList,
  platformClinic,
  platformClinics,
  platformCreateClinic,
  platformOwnerEndSessions,
  platformOwnerResetMfa,
  platformOwnerSetupLink,
  platformUpdateClinic,
  type RequestBody,
  type RequestParams,
  type RequestQuery,
  type SetupLinkIssued,
} from '@shifa/contracts';
import { CurrentPrincipal, PlatformAdmin, type Principal } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { ClinicsService } from './clinics.service.ts';

@Controller('platform/clinics')
export class ClinicsController {
  constructor(@Inject(ClinicsService) private readonly clinics: ClinicsService) {}

  @PlatformAdmin()
  @Contract(platformClinics)
  @Get()
  list(
    @Query() query: RequestQuery<typeof platformClinics>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<ClinicList> {
    return this.clinics.list(principal, query.search, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformCreateClinic)
  @Post()
  create(
    @Body() body: RequestBody<typeof platformCreateClinic>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<ClinicCreated> {
    return this.clinics.create(principal, body, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformClinic)
  @Get(':id')
  detail(
    @Param() params: RequestParams<typeof platformClinic>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<ClinicDetail> {
    return this.clinics.detail(principal, params.id, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformUpdateClinic)
  @Patch(':id')
  update(
    @Param() params: RequestParams<typeof platformUpdateClinic>,
    @Body() body: RequestBody<typeof platformUpdateClinic>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<ClinicDetail> {
    return this.clinics.update(principal, params.id, body, request.requestId);
  }

  /** A new link replaces the owner's earlier one; for a set-up owner it resets the password. */
  @PlatformAdmin()
  @Contract(platformOwnerSetupLink)
  @HttpCode(200)
  @Post(':id/owner/setup-link')
  async ownerSetupLink(
    @Param() params: RequestParams<typeof platformOwnerSetupLink>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<SetupLinkIssued> {
    const issued = await this.clinics.ownerAction(
      principal,
      params.id,
      'setup-link',
      request.requestId,
    );
    if (!issued) throw new Error('no setup link was issued');
    return issued;
  }

  @PlatformAdmin()
  @Contract(platformOwnerResetMfa)
  @HttpCode(204)
  @Post(':id/owner/reset-mfa')
  async ownerResetMfa(
    @Param() params: RequestParams<typeof platformOwnerResetMfa>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<void> {
    await this.clinics.ownerAction(principal, params.id, 'reset-mfa', request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformOwnerEndSessions)
  @HttpCode(204)
  @Post(':id/owner/end-sessions')
  async ownerEndSessions(
    @Param() params: RequestParams<typeof platformOwnerEndSessions>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<void> {
    await this.clinics.ownerAction(principal, params.id, 'end-sessions', request.requestId);
  }
}
