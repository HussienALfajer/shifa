// The settings bounded context (A-02-04; PLT-22 to PLT-24): the catalogue in code, resolution
// nearest-scope-wins with locks, the clinic's own settings route (`/clinic/settings`, the idle
// sign-out) and the super admin's settings routes on the shifa_platform pool. Identity reads the
// idle sign-out through this module's index (idle.ts), with no Nest dependency.
import { type DynamicModule, Module } from '@nestjs/common';
import type { PlatformDb } from '@shifa/db';
import { SettingsAdmin } from './admin.service.ts';
import {
  PRODUCTION_SETTINGS,
  SETTING_CATALOGUE,
  SettingCatalogue,
  type SettingDefinition,
} from './catalogue.ts';
import { ClinicSettingsController } from './clinic-settings.controller.ts';
import { ClinicSettingsService } from './clinic-settings.service.ts';
import { SettingsController } from './settings.controller.ts';
import { SETTINGS_PLATFORM_DB } from './tokens.ts';

@Module({})
export class SettingsModule {
  static register({
    platformDb,
    settings = PRODUCTION_SETTINGS,
  }: {
    platformDb: PlatformDb;
    settings?: readonly SettingDefinition[];
  }): DynamicModule {
    return {
      module: SettingsModule,
      controllers: [SettingsController, ClinicSettingsController],
      providers: [
        { provide: SETTINGS_PLATFORM_DB, useValue: platformDb },
        { provide: SETTING_CATALOGUE, useValue: new SettingCatalogue(settings) },
        SettingsAdmin,
        ClinicSettingsService,
      ],
      exports: [SETTING_CATALOGUE],
    };
  }
}
