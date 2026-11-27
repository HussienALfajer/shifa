// The super admin's entitlement routes (A-02 criteria 1–3, 20; contract rows `sub` … `typeChange`
// of A-02-screen-contract.md). @PlatformAdmin only; each call is audited by withPlatformAdmin().
// The type change itself is `type` on PATCH /platform/clinics/:id (platform module).
import { Body, Controller, Delete, Get, Inject, Param, Put, Query } from '@nestjs/common';
import {
  type ClinicEntitlements,
  type EntitlementItem,
  type OverrideHistory,
  platformClinicEntitlements,
  platformOverrideHistory,
  platformRemoveOverride,
  platformSetOverride,
  platformTypePreview,
  type RequestBody,
  type RequestParams,
  type RequestQuery,
  type TypePreview,
} from '@shifa/contracts';
import { CurrentPrincipal, PlatformAdmin, type Principal } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { EntitlementsAdmin } from './admin.service.ts';

@Controller('platform/clinics/:id')
export class EntitlementsController {
  constructor(@Inject(EntitlementsAdmin) private readonly admin: EntitlementsAdmin) {}

  @PlatformAdmin()
  @Contract(platformClinicEntitlements)
  @Get('entitlements')
  entitlements(
    @Param() params: RequestParams<typeof platformClinicEntitlements>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<ClinicEntitlements> {
    return this.admin.view(principal, params.id, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformSetOverride)
  @Put('overrides/:key')
  setOverride(
    @Param() params: RequestParams<typeof platformSetOverride>,
    @Body() body: RequestBody<typeof platformSetOverride>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<EntitlementItem> {
    return this.admin.setOverride(principal, params.id, params.key, body, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformRemoveOverride)
  @Delete('overrides/:key')
  removeOverride(
    @Param() params: RequestParams<typeof platformRemoveOverride>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<EntitlementItem> {
    return this.admin.removeOverride(principal, params.id, params.key, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformOverrideHistory)
  @Get('overrides/:key/history')
  history(
    @Param() params: RequestParams<typeof platformOverrideHistory>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<OverrideHistory> {
    return this.admin.history(principal, params.id, params.key, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformTypePreview)
  @Get('type-preview')
  typePreview(
    @Param() params: RequestParams<typeof platformTypePreview>,
    @Query() query: RequestQuery<typeof platformTypePreview>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<TypePreview> {
    return this.admin.preview(principal, params.id, query.type, request.requestId);
  }
}
