// The team routes (A-01b criteria 2–7): the owner's view of the clinic's members. Every handler
// takes the scope the guard checked (@CurrentScope()) and nothing else decides the clinic.
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import {
  type MemberAdded,
  type MemberDetail,
  type MemberLinkIssued,
  type MemberList,
  type RequestBody,
  type RequestParams,
  teamAddMember,
  teamDeactivateMember,
  teamMember,
  teamMemberLink,
  teamMembers,
  teamReactivateMember,
  teamUpdateMember,
} from '@shifa/contracts';
import { CurrentScope, type RequestScope, RequirePermission } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { TeamService } from './team.service.ts';

@Controller('team/members')
export class TeamController {
  constructor(@Inject(TeamService) private readonly team: TeamService) {}

  @RequirePermission('members.view')
  @Contract(teamMembers)
  @Get()
  list(@CurrentScope() scope: RequestScope): Promise<MemberList> {
    return this.team.list(scope);
  }

  @RequirePermission('members.view')
  @Contract(teamMember)
  @Get(':id')
  detail(
    @Param() params: RequestParams<typeof teamMember>,
    @CurrentScope() scope: RequestScope,
  ): Promise<MemberDetail> {
    return this.team.detail(scope, params.id);
  }

  @RequirePermission('members.manage')
  @Contract(teamAddMember)
  @Post()
  add(
    @Body() body: RequestBody<typeof teamAddMember>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<MemberAdded> {
    return this.team.add(scope, body, request.requestId);
  }

  @RequirePermission('members.manage')
  @Contract(teamUpdateMember)
  @Patch(':id')
  update(
    @Param() params: RequestParams<typeof teamUpdateMember>,
    @Body() body: RequestBody<typeof teamUpdateMember>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<MemberDetail> {
    return this.team.update(scope, params.id, body, request.requestId);
  }

  @RequirePermission('members.manage')
  @Contract(teamDeactivateMember)
  @HttpCode(200)
  @Post(':id/deactivate')
  deactivate(
    @Param() params: RequestParams<typeof teamDeactivateMember>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<MemberDetail> {
    return this.team.deactivate(scope, params.id, request.requestId);
  }

  @RequirePermission('members.manage')
  @Contract(teamReactivateMember)
  @HttpCode(200)
  @Post(':id/reactivate')
  reactivate(
    @Param() params: RequestParams<typeof teamReactivateMember>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<MemberDetail> {
    return this.team.reactivate(scope, params.id, request.requestId);
  }

  @RequirePermission('members.manage')
  @Contract(teamMemberLink)
  @HttpCode(200)
  @Post(':id/setup-link')
  newLink(
    @Param() params: RequestParams<typeof teamMemberLink>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<MemberLinkIssued> {
    return this.team.newLink(scope, params.id, request.requestId);
  }
}
