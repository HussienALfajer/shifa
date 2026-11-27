// The clinic's own settings (A-01a criterion 9; A-02 criterion 10, slice A-02-04): automatic
// sign-out after 15, 30 or 60 idle minutes, owner only (`clinic.settings.manage`), served by the
// settings cascade with where the value comes from and whether it is locked; 409 `setting_locked`
// under a lock. The next request of every session in the clinic reads the new value.
import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import {
  type ClinicSettings,
  clinicSettings,
  clinicUpdateSettings,
  type RequestBody,
} from '@shifa/contracts';
import { CurrentScope, type RequestScope, RequirePermission } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { ClinicSettingsService } from './clinic-settings.service.ts';

@Controller('clinic/settings')
export class ClinicSettingsController {
  constructor(@Inject(ClinicSettingsService) private readonly settings: ClinicSettingsService) {}

  @RequirePermission('clinic.settings.manage')
  @Contract(clinicSettings)
  @Get()
  read(@CurrentScope() scope: RequestScope): Promise<ClinicSettings> {
    return this.settings.read(scope);
  }

  @RequirePermission('clinic.settings.manage')
  @Contract(clinicUpdateSettings)
  @Patch()
  update(
    @Body() body: RequestBody<typeof clinicUpdateSettings>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<ClinicSettings> {
    return this.settings.update(scope, body, request.requestId);
  }
}
