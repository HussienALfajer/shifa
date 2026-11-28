// The patients bounded context (spec A-03): a clinic's charts and their custom fields. Tenant work
// through TenantDb (the guard's scope); the clock (from identity) decides the Damascus day an age
// is counted from and when an archived field is purged; the entitlements module's ClinicLimits
// enforces `limits.custom_fields` (A-03-05).
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { PatientFieldsController } from './fields/fields.controller.ts';
import { PatientFieldsService } from './fields/fields.service.ts';
import { PatientLinksService } from './links.service.ts';
import { PatientsController } from './patients.controller.ts';
import { PatientsService } from './patients.service.ts';
import { PatientSearchService } from './search.service.ts';

type Import = NonNullable<ModuleMetadata['imports']>[number];

@Module({})
export class PatientsModule {
  /** `identity`: the registered IdentityModule (CLOCK); `entitlements`: ClinicLimits. */
  static register({
    identity,
    entitlements,
  }: {
    identity: Import;
    entitlements: Import;
  }): DynamicModule {
    return {
      module: PatientsModule,
      imports: [identity, entitlements],
      // The fields controller first: `/patients/fields` before `/patients/:id`.
      controllers: [PatientFieldsController, PatientsController],
      providers: [PatientsService, PatientSearchService, PatientLinksService, PatientFieldsService],
    };
  }
}
