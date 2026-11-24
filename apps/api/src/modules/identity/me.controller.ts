// The signed-in person's clinics (A-01b criteria 10, 11; OD-90, OD-91): the chooser (clinics and
// pending invitations, which are answered on their own link) and the switch. @SignedIn: a
// person's own data, never a clinic's; they keep working while the active clinic is suspended.
import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import {
  type ActiveClinic,
  type MyClinics,
  type MyProfile,
  meClinics,
  meProfile,
  meSwitch,
  type RequestBody,
} from '@shifa/contracts';
import { BeforeMfa, CurrentPrincipal, type Principal, SignedIn } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { AccountService } from './account.service.ts';
import { SwitcherService } from './switcher.service.ts';

@Controller('me')
export class MeController {
  constructor(
    @Inject(SwitcherService) private readonly switcher: SwitcherService,
    @Inject(AccountService) private readonly account: AccountService,
  ) {}

  /** Before MFA too: the challenge screen greets the person by name (A-01a 10a). */
  @SignedIn()
  @BeforeMfa()
  @Contract(meProfile)
  @Get()
  profile(@CurrentPrincipal() principal: Principal): Promise<MyProfile> {
    return this.account.profile(principal);
  }

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
}
