// The announcements bounded context (A-02-07; OD-115, PLT-18): the super admin's announcements on
// the shifa_platform pool, and a member's banner and dismissals through TenantDb.
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import type { PlatformDb } from '@shifa/db';
import { AnnouncementsAdmin } from './admin.service.ts';
import {
  MyAnnouncementsController,
  PlatformAnnouncementsController,
} from './announcements.controller.ts';
import { ClinicAnnouncements } from './clinic.service.ts';
import { ANNOUNCEMENTS_PLATFORM_DB } from './tokens.ts';

@Module({})
export class AnnouncementsModule {
  /** `identity`: the registered IdentityModule (SupportDirectory for authors' names, CLOCK). */
  static register({
    platformDb,
    identity,
  }: {
    platformDb: PlatformDb;
    identity: NonNullable<ModuleMetadata['imports']>[number];
  }): DynamicModule {
    return {
      module: AnnouncementsModule,
      imports: [identity],
      controllers: [PlatformAnnouncementsController, MyAnnouncementsController],
      providers: [
        { provide: ANNOUNCEMENTS_PLATFORM_DB, useValue: platformDb },
        AnnouncementsAdmin,
        ClinicAnnouncements,
      ],
    };
  }
}
