// The support bounded context (A-02-05; criteria 11–14, PLT-14; ADR-0050): the super admin's grants
// on the shifa_platform pool, the owner's banner, log and end through TenantDb, ending from the
// support tab, and the guard's request audit (SUPPORT_AUDIT). The support session itself (hand-off
// exchange, principal) lives in the identity module, beside every other session.
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import type { PlatformDb } from '@shifa/db';
import { SUPPORT_AUDIT } from '../../access/index.ts';
import { ClinicSupportController } from './clinic-support.controller.ts';
import { ClinicSupport } from './clinic-support.service.ts';
import { PlatformSupportController } from './platform-support.controller.ts';
import { PlatformSupport } from './platform-support.service.ts';
import { SupportRequestAudit } from './request-audit.ts';
import { SupportEndController } from './support-end.controller.ts';
import { SUPPORT_CLINIC_WEB_URL, SUPPORT_PLATFORM_DB } from './tokens.ts';

@Module({})
export class SupportModule {
  /** `identity`: the registered IdentityModule (SupportDirectory, CLOCK). */
  static register({
    platformDb,
    identity,
    clinicWebUrl,
  }: {
    platformDb: PlatformDb;
    identity: NonNullable<ModuleMetadata['imports']>[number];
    clinicWebUrl: string;
  }): DynamicModule {
    return {
      module: SupportModule,
      imports: [identity],
      controllers: [PlatformSupportController, ClinicSupportController, SupportEndController],
      providers: [
        { provide: SUPPORT_PLATFORM_DB, useValue: platformDb },
        { provide: SUPPORT_CLINIC_WEB_URL, useValue: clinicWebUrl },
        { provide: SUPPORT_AUDIT, useClass: SupportRequestAudit },
        PlatformSupport,
        ClinicSupport,
      ],
    };
  }
}
