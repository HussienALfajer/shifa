// The custom field routes (spec A-03 criteria 14–17, 37–39; slice A-03-05; contract rows of the
// fields screen and the form's «حقول العيادة»). Every handler takes the scope the guard checked
// (@CurrentScope()) and nothing else decides the clinic. Paths carry field keys (`cf_…`) only;
// labels travel in bodies. The member's view is for every clinic role (`patients.view`), the
// definitions for the owner (`patients.fields.manage`; a support session reads them).
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import {
  type PatientFieldDefinition,
  type PatientFieldDefinitions,
  type PatientFormFields,
  patientFieldsArchive,
  patientFieldsCreate,
  patientFieldsDefinitions,
  patientFieldsForm,
  patientFieldsOrder,
  patientFieldsRestore,
  patientFieldsUpdate,
  type RequestBody,
  type RequestParams,
} from '@shifa/contracts';
import {
  CurrentPrincipal,
  CurrentScope,
  type Principal,
  type RequestScope,
  RequirePermission,
} from '../../../access/index.ts';
import { Contract } from '../../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../../platform/request-meta.ts';
import { PatientFieldsService } from './fields.service.ts';

@Controller('patients/fields')
export class PatientFieldsController {
  constructor(@Inject(PatientFieldsService) private readonly fields: PatientFieldsService) {}

  /** The fields this member's roles may view, for the registration form (criterion 16). */
  @RequirePermission('patients.view')
  @Contract(patientFieldsForm)
  @Get()
  form(
    @CurrentScope() scope: RequestScope,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientFormFields> {
    const roles = principal.roles.map((r) => r.role);
    return this.fields.form(scope, roles, request.requestId);
  }

  @RequirePermission('patients.fields.manage')
  @Contract(patientFieldsDefinitions)
  @Get('definitions')
  definitions(
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientFieldDefinitions> {
    return this.fields.definitions(scope, request.requestId);
  }

  @RequirePermission('patients.fields.manage')
  @Contract(patientFieldsCreate)
  @Post()
  create(
    @Body() body: RequestBody<typeof patientFieldsCreate>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientFieldDefinition> {
    return this.fields.create(scope, body, request.requestId);
  }

  /** Criterion 38: the order within each section. */
  @RequirePermission('patients.fields.manage')
  @Contract(patientFieldsOrder)
  @Put('order')
  order(
    @Body() body: RequestBody<typeof patientFieldsOrder>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientFieldDefinitions> {
    return this.fields.order(scope, body, request.requestId);
  }

  @RequirePermission('patients.fields.manage')
  @Contract(patientFieldsUpdate)
  @Patch(':key')
  update(
    @Param() params: RequestParams<typeof patientFieldsUpdate>,
    @Body() body: RequestBody<typeof patientFieldsUpdate>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientFieldDefinition> {
    return this.fields.update(scope, params.key, body, request.requestId);
  }

  @RequirePermission('patients.fields.manage')
  @Contract(patientFieldsArchive)
  @HttpCode(200)
  @Post(':key/archive')
  archive(
    @Param() params: RequestParams<typeof patientFieldsArchive>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientFieldDefinition> {
    return this.fields.archive(scope, params.key, request.requestId);
  }

  @RequirePermission('patients.fields.manage')
  @Contract(patientFieldsRestore)
  @HttpCode(200)
  @Post(':key/restore')
  restore(
    @Param() params: RequestParams<typeof patientFieldsRestore>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientFieldDefinition> {
    return this.fields.restore(scope, params.key, request.requestId);
  }
}
