// Announcements (A-02 criteria 16, 22; contract rows of `A02Announcements`, `A02cAnnouncements` and
// `dismissed`): the super admin's list, create, edit and end; a member's banner and its dismissal.
// The banner routes take `clinic.capabilities.view`, which every clinic role holds (and a support
// session's synthesised owner role): no new key, never a super admin's own session.
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type Announcement,
  type AnnouncementList,
  dismissMyAnnouncement,
  type MyAnnouncements,
  myAnnouncements,
  platformAnnouncements,
  platformCreateAnnouncement,
  platformEndAnnouncement,
  platformUpdateAnnouncement,
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
} from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { AnnouncementsAdmin } from './admin.service.ts';
import { ClinicAnnouncements } from './clinic.service.ts';

@Controller('platform/announcements')
export class PlatformAnnouncementsController {
  constructor(@Inject(AnnouncementsAdmin) private readonly admin: AnnouncementsAdmin) {}

  @PlatformAdmin()
  @Contract(platformAnnouncements)
  @Get()
  list(
    @Query() query: RequestQuery<typeof platformAnnouncements>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<AnnouncementList> {
    return this.admin.list(principal, query.status, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformCreateAnnouncement)
  @Post()
  create(
    @Body() body: RequestBody<typeof platformCreateAnnouncement>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<Announcement> {
    return this.admin.create(principal, body, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformUpdateAnnouncement)
  @Patch(':id')
  update(
    @Param() params: RequestParams<typeof platformUpdateAnnouncement>,
    @Body() body: RequestBody<typeof platformUpdateAnnouncement>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<Announcement> {
    return this.admin.update(principal, params.id, body, request.requestId);
  }

  @PlatformAdmin()
  @Contract(platformEndAnnouncement)
  @HttpCode(200)
  @Post(':id/end')
  end(
    @Param() params: RequestParams<typeof platformEndAnnouncement>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<Announcement> {
    return this.admin.end(principal, params.id, request.requestId);
  }
}

@Controller('me/announcements')
export class MyAnnouncementsController {
  constructor(@Inject(ClinicAnnouncements) private readonly clinic: ClinicAnnouncements) {}

  @RequirePermission('clinic.capabilities.view')
  @Contract(myAnnouncements)
  @Get()
  mine(@CurrentScope() scope: RequestScope): Promise<MyAnnouncements> {
    return this.clinic.mine(scope);
  }

  @RequirePermission('clinic.capabilities.view')
  @Contract(dismissMyAnnouncement)
  @HttpCode(204)
  @Post(':id/dismiss')
  dismiss(
    @Param() params: RequestParams<typeof dismissMyAnnouncement>,
    @Body() body: RequestBody<typeof dismissMyAnnouncement>,
    @CurrentScope() scope: RequestScope,
  ): Promise<void> {
    return this.clinic.dismiss(scope, params.id, body.version);
  }
}
