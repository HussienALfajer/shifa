// The super admin's settings routes (A-02 criterion 9; contract rows `set` … `unlockAsk` of
// A-02-screen-contract.md): list a clinic's settings, lock with a value, unlock. @PlatformAdmin
// only; each call is audited by withPlatformAdmin(). No plain set: the super admin never sets a
// clinic's value without its lock.
import { Body, Controller, Delete, Get, Inject, Param, Put } from '@nestjs/common';
import {
  type ClinicSettingList,
  platformClinicSettings,
  platformLockSetting,
  platformUnlockSetting,
  type RequestBody,
  type RequestParams,
  type SettingView,
} from '@shifa/contracts';
import { CurrentPrincipal, PlatformAdmin, type Principal } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { SettingsAdmin } from './admin.service.ts';

@Controller('platform/clinics/:id/settings')
export class SettingsController {
  constructor(@Inject(SettingsAdmin) private readonly admin: SettingsAdmin) {}

  @PlatformAdmin()
  @Contract(platformClinicSettings)
  @Get()
  list(
    @Param() params: RequestParams<typeof platformClinicSettings>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<ClinicSettingList> {
    return this.admin.list(principal, params.id, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformLockSetting)
  @Put(':key/lock')
  lock(
    @Param() params: RequestParams<typeof platformLockSetting>,
    @Body() body: RequestBody<typeof platformLockSetting>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<SettingView> {
    return this.admin.lock(principal, params.id, params.key, body.value, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformUnlockSetting)
  @Delete(':key/lock')
  unlock(
    @Param() params: RequestParams<typeof platformUnlockSetting>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<SettingView> {
    return this.admin.unlock(principal, params.id, params.key, request.requestId);
  }
}
