// The super admin's flag routes (A-02 criterion 7; contract rows `list`, `change` of the flags
// board in A-02-screen-contract.md). @PlatformAdmin only; each call is audited by
// withPlatformAdmin().
import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import {
  type FlagList,
  type FlagView,
  platformFlags,
  platformSetFlag,
  type RequestBody,
  type RequestParams,
} from '@shifa/contracts';
import { CurrentPrincipal, PlatformAdmin, type Principal } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { FlagsAdmin } from './admin.service.ts';

@Controller('platform/flags')
export class FlagsController {
  constructor(@Inject(FlagsAdmin) private readonly admin: FlagsAdmin) {}

  @PlatformAdmin()
  @Contract(platformFlags)
  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<FlagList> {
    return this.admin.list(principal, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformSetFlag)
  @Put(':key')
  set(
    @Param() params: RequestParams<typeof platformSetFlag>,
    @Body() body: RequestBody<typeof platformSetFlag>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<FlagView> {
    return this.admin.set(principal, params.key, body, request.requestId);
  }
}
