// The signed-in person's clinics (A-01b criteria 10, 11; OD-90): the chooser, the switch and
// invitations answered from the chooser. @SignedIn: a person's own data, never a clinic's; they
// keep working while the active clinic is suspended.
import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  type ActiveClinic,
  type MyClinics,
  meAcceptInvitation,
  meClinics,
  meDeclineInvitation,
  meSwitch,
  type RequestBody,
  type RequestParams,
} from '@shifa/contracts';
import { CurrentPrincipal, type Principal, SignedIn } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { MyInvitations } from './my-invitations.service.ts';
import { SwitcherService } from './switcher.service.ts';

@Controller('me')
export class MeController {
  constructor(
    @Inject(SwitcherService) private readonly switcher: SwitcherService,
    @Inject(MyInvitations) private readonly invitations: MyInvitations,
  ) {}

  @SignedIn()
  @Contract(meClinics)
  @Get('clinics')
  clinics(@CurrentPrincipal() principal: Principal): Promise<MyClinics> {
    return this.switcher.myClinics(principal);
  }

  @SignedIn()
  @Contract(meSwitch)
  @HttpCode(200)
  @Post('switch')
  switch(
    @Body() body: RequestBody<typeof meSwitch>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<ActiveClinic> {
    return this.switcher.switch(principal, body, request.requestId);
  }

  @SignedIn()
  @Contract(meAcceptInvitation)
  @HttpCode(204)
  @Post('invitations/:id/accept')
  async accept(
    @Param() params: RequestParams<typeof meAcceptInvitation>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<void> {
    await this.invitations.accept(principal.userId, params.id, request.requestId);
  }

  @SignedIn()
  @Contract(meDeclineInvitation)
  @HttpCode(204)
  @Post('invitations/:id/decline')
  async decline(
    @Param() params: RequestParams<typeof meDeclineInvitation>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<void> {
    await this.invitations.decline(principal.userId, params.id, request.requestId);
  }
}
