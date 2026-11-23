// The platform bounded context (A-01-03): the super-admin API on the shifa_platform pool
// (ADR-0005 "own role and audit", ADR-0043). Owner-account actions come from the identity module.
import {
  type DynamicModule,
  Inject,
  Module,
  type ModuleMetadata,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { PlatformDb } from '@shifa/db';
import { ClinicsController } from './clinics.controller.ts';
import { ClinicsService } from './clinics.service.ts';
import { PLATFORM_DB } from './tokens.ts';

@Module({})
export class PlatformModule implements OnApplicationShutdown {
  constructor(@Inject(PLATFORM_DB) private readonly platformDb: PlatformDb) {}

  /** `identity`: the registered IdentityModule (OwnerAccounts). */
  static register({
    platformDb,
    identity,
  }: {
    platformDb: PlatformDb;
    identity: NonNullable<ModuleMetadata['imports']>[number];
  }): DynamicModule {
    return {
      module: PlatformModule,
      imports: [identity],
      controllers: [ClinicsController],
      providers: [{ provide: PLATFORM_DB, useValue: platformDb }, ClinicsService],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.platformDb.close();
  }
}
