// The patients bounded context (spec A-03): a clinic's charts. Tenant work through TenantDb (the
// guard's scope); the clock (from identity) decides the Damascus day an age is counted from.
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { PatientLinksService } from './links.service.ts';
import { PatientsController } from './patients.controller.ts';
import { PatientsService } from './patients.service.ts';
import { PatientSearchService } from './search.service.ts';

@Module({})
export class PatientsModule {
  /** `identity`: the registered IdentityModule (CLOCK). */
  static register({
    identity,
  }: {
    identity: NonNullable<ModuleMetadata['imports']>[number];
  }): DynamicModule {
    return {
      module: PatientsModule,
      imports: [identity],
      controllers: [PatientsController],
      providers: [PatientsService, PatientSearchService, PatientLinksService],
    };
  }
}
