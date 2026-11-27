// The places bounded context (A-02-06; OD-113, PLT-15): the platform's cities and areas on the
// shifa_platform pool, the clinic's list for the branch dialog, and the helpers the branches
// module uses to check and show a branch's place in the clinic's own transaction.
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import type { PlatformDb } from '@shifa/db';
import { PlacesAdmin } from './admin.service.ts';
import { ClinicPlacesController, PlatformPlacesController } from './places.controller.ts';
import { PLACES_PLATFORM_DB } from './tokens.ts';

@Module({})
export class PlacesModule {
  /** `identity`: the registered IdentityModule (CLOCK). */
  static register({
    platformDb,
    identity,
  }: {
    platformDb: PlatformDb;
    identity: NonNullable<ModuleMetadata['imports']>[number];
  }): DynamicModule {
    return {
      module: PlacesModule,
      imports: [identity],
      controllers: [PlatformPlacesController, ClinicPlacesController],
      providers: [{ provide: PLACES_PLATFORM_DB, useValue: platformDb }, PlacesAdmin],
    };
  }
}
