// The super admin's cities and areas (A-02 criteria 15, 24; contract rows of `A02Cities`) and the
// clinic's list for the branch dialog (`A02cBranchPlace`). No route deletes a place.
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type Area,
  type City,
  type CityList,
  type ClinicPlaces,
  clinicPlaces,
  platformArchiveArea,
  platformArchiveCity,
  platformCities,
  platformCreateArea,
  platformCreateCity,
  platformRenameArea,
  platformRenameCity,
  platformRestoreArea,
  platformRestoreCity,
  type RequestBody,
  type RequestParams,
  type RequestQuery,
} from '@shifa/contracts';
import {
  CurrentPrincipal,
  CurrentScope,
  PlatformAdmin,
  type Principal,
  type RequestScope,
  RequirePermission,
  TenantDb,
} from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { PlacesAdmin } from './admin.service.ts';
import { clinicPlaces as readClinicPlaces } from './clinic.ts';

@Controller('platform')
export class PlatformPlacesController {
  constructor(@Inject(PlacesAdmin) private readonly admin: PlacesAdmin) {}

  @PlatformAdmin()
  @Contract(platformCities)
  @Get('cities')
  list(
    @Query() query: RequestQuery<typeof platformCities>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<CityList> {
    return this.admin.list(principal, query.includeArchived === true, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformCreateCity)
  @Post('cities')
  createCity(
    @Body() body: RequestBody<typeof platformCreateCity>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<City> {
    return this.admin.createCity(principal, body.name, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformRenameCity)
  @Patch('cities/:id')
  renameCity(
    @Param() params: RequestParams<typeof platformRenameCity>,
    @Body() body: RequestBody<typeof platformRenameCity>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<City> {
    return this.admin.renameCity(principal, params.id, body.name, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformArchiveCity)
  @HttpCode(200)
  @Post('cities/:id/archive')
  archiveCity(
    @Param() params: RequestParams<typeof platformArchiveCity>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<City> {
    return this.admin.archiveCity(principal, params.id, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformRestoreCity)
  @HttpCode(200)
  @Post('cities/:id/restore')
  restoreCity(
    @Param() params: RequestParams<typeof platformRestoreCity>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<City> {
    return this.admin.restoreCity(principal, params.id, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformCreateArea)
  @Post('cities/:id/areas')
  createArea(
    @Param() params: RequestParams<typeof platformCreateArea>,
    @Body() body: RequestBody<typeof platformCreateArea>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<Area> {
    return this.admin.createArea(principal, params.id, body.name, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformRenameArea)
  @Patch('areas/:id')
  renameArea(
    @Param() params: RequestParams<typeof platformRenameArea>,
    @Body() body: RequestBody<typeof platformRenameArea>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<Area> {
    return this.admin.renameArea(principal, params.id, body.name, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformArchiveArea)
  @HttpCode(200)
  @Post('areas/:id/archive')
  archiveArea(
    @Param() params: RequestParams<typeof platformArchiveArea>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<Area> {
    return this.admin.archiveArea(principal, params.id, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformRestoreArea)
  @HttpCode(200)
  @Post('areas/:id/restore')
  restoreArea(
    @Param() params: RequestParams<typeof platformRestoreArea>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<Area> {
    return this.admin.restoreArea(principal, params.id, request.requestId);
  }
}

@Controller('clinic')
export class ClinicPlacesController {
  constructor(@Inject(TenantDb) private readonly tenants: TenantDb) {}

  @RequirePermission('branches.manage')
  @Contract(clinicPlaces)
  @Get('places')
  places(@CurrentScope() scope: RequestScope): Promise<ClinicPlaces> {
    return this.tenants.run(scope, (tx) => readClinicPlaces(tx));
  }
}
