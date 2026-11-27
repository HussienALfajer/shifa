// The usage bounded context (A-02-07; OD-116, PLT-16): the daily counters written in the clinic's
// own transaction by the modules where usage happens (functions in index.ts), and the super
// admin's reads on the shifa_platform pool.
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import type { PlatformDb } from '@shifa/db';
import { UsageAdmin } from './admin.service.ts';
import { USAGE_PLATFORM_DB } from './tokens.ts';
import { PlatformUsageController } from './usage.controller.ts';

@Module({})
export class UsageModule {
  /** `identity`: the registered IdentityModule (CLOCK). */
  static register({
    platformDb,
    identity,
  }: {
    platformDb: PlatformDb;
    identity: NonNullable<ModuleMetadata['imports']>[number];
  }): DynamicModule {
    return {
      module: UsageModule,
      imports: [identity],
      controllers: [PlatformUsageController],
      providers: [{ provide: USAGE_PLATFORM_DB, useValue: platformDb }, UsageAdmin],
    };
  }
}
