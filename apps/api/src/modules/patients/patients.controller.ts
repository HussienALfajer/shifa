// The chart routes (spec A-03; slice A-03-02). Every handler takes the scope the guard checked
// (@CurrentScope()) and nothing else decides the clinic. Paths carry chart ids only; names,
// phones and dates travel in bodies.
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type PatientChart,
  type PatientCount,
  type PatientSearchResults,
  patientsArchive,
  patientsCount,
  patientsCreate,
  patientsGet,
  patientsRestore,
  patientsSearch,
  patientsUpdate,
  type RequestBody,
  type RequestParams,
} from '@shifa/contracts';
import {
  CurrentPrincipal,
  CurrentScope,
  PermissionCheck,
  type Principal,
  ReadInBody,
  type RequestScope,
  RequirePermission,
} from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { PatientsService } from './patients.service.ts';
import { PatientSearchService } from './search.service.ts';

@Controller('patients')
export class PatientsController {
  constructor(
    @Inject(PatientsService) private readonly patients: PatientsService,
    @Inject(PermissionCheck) private readonly permissions: PermissionCheck,
    @Inject(PatientSearchService) private readonly searches: PatientSearchService,
  ) {}

  @RequirePermission('patients.view')
  @Contract(patientsCount)
  @Get('count')
  count(
    @CurrentScope() scope: RequestScope,
    @CurrentPrincipal() principal: Principal,
  ): Promise<PatientCount> {
    return this.patients.count(scope, this.permissions.holds(principal, 'patients.archive'));
  }

  /** Criteria 4–6, 21, 24 (A-03-03): a read by POST, so the term stays out of the URL. */
  @RequirePermission('patients.view')
  @ReadInBody()
  @Contract(patientsSearch)
  @HttpCode(200)
  @Post('search')
  search(
    @Body() body: RequestBody<typeof patientsSearch>,
    @CurrentScope() scope: RequestScope,
    @CurrentPrincipal() principal: Principal,
  ): Promise<PatientSearchResults> {
    if (body.includeArchived === true && !this.permissions.holds(principal, 'patients.archive')) {
      throw new ForbiddenException();
    }
    return this.searches.search(scope, body);
  }

  @RequirePermission('patients.manage')
  @Contract(patientsCreate)
  @Post()
  create(
    @Body() body: RequestBody<typeof patientsCreate>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientChart> {
    return this.patients.create(scope, body, request.requestId);
  }

  @RequirePermission('patients.view')
  @Contract(patientsGet)
  @Get(':id')
  get(
    @Param() params: RequestParams<typeof patientsGet>,
    @CurrentScope() scope: RequestScope,
  ): Promise<PatientChart> {
    return this.patients.get(scope, params.id);
  }

  @RequirePermission('patients.manage')
  @Contract(patientsUpdate)
  @Patch(':id')
  update(
    @Param() params: RequestParams<typeof patientsUpdate>,
    @Body() body: RequestBody<typeof patientsUpdate>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientChart> {
    return this.patients.update(scope, params.id, body, request.requestId);
  }

  @RequirePermission('patients.archive')
  @Contract(patientsArchive)
  @HttpCode(200)
  @Post(':id/archive')
  archive(
    @Param() params: RequestParams<typeof patientsArchive>,
    @Body() body: RequestBody<typeof patientsArchive>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientChart> {
    return this.patients.archive(scope, params.id, body.expectedUpdatedAt, request.requestId);
  }

  @RequirePermission('patients.archive')
  @Contract(patientsRestore)
  @HttpCode(200)
  @Post(':id/restore')
  restore(
    @Param() params: RequestParams<typeof patientsRestore>,
    @Body() body: RequestBody<typeof patientsRestore>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<PatientChart> {
    return this.patients.restore(scope, params.id, body.expectedUpdatedAt, request.requestId);
  }
}
