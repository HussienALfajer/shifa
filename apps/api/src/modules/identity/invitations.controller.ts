// Invitation routes (A-01b criterion 2). The token travels in the body (the page keeps it in the
// URL fragment), as for setup links. Viewing is public; accepting and declining need the
// signed-in person the invitation was sent to.
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import {
  type InvitationView,
  invitationAccept,
  invitationDecline,
  invitationView,
  type RequestBody,
} from '@shifa/contracts';
import { CurrentPrincipal, type Principal, Public, SignedIn } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { InvitationsService } from './invitations.service.ts';

@Controller('invitations')
export class InvitationsController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService) {}

  /** Public: the token is the credential; 404 `link_invalid` for anything but an invitation. */
  @Public()
  @Contract(invitationView)
  @HttpCode(200)
  @Post('view')
  view(@Body() body: RequestBody<typeof invitationView>): Promise<InvitationView> {
    return this.invitations.view(body.token);
  }

  @SignedIn()
  @Contract(invitationAccept)
  @HttpCode(204)
  @Post('accept')
  async accept(
    @Body() body: RequestBody<typeof invitationAccept>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<void> {
    await this.invitations.accept(principal, body.token, request.requestId);
  }

  @SignedIn()
  @Contract(invitationDecline)
  @HttpCode(204)
  @Post('decline')
  async decline(
    @Body() body: RequestBody<typeof invitationDecline>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<void> {
    await this.invitations.decline(principal, body.token, request.requestId);
  }
}
