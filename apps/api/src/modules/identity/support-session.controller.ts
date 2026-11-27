// The support hand-off exchange (A-02 criterion 11, ADR-0050; contract row `session` of clinic web).
// Public: the single-use hand-off token in the body is the credential, as a setup link's is.
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { authSupportSession, type RequestBody, type SessionView } from '@shifa/contracts';
import { Public } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { SupportHandoffs } from './support-handoff.ts';

@Controller('auth/support')
export class SupportSessionController {
  constructor(@Inject(SupportHandoffs) private readonly handoffs: SupportHandoffs) {}

  @Public()
  @Contract(authSupportSession)
  @HttpCode(200)
  @Post('session')
  async exchange(
    @Body() body: RequestBody<typeof authSupportSession>,
    @ClientRequest() request: RequestMeta,
  ): Promise<SessionView> {
    const { view, cookie } = await this.handoffs.exchange(body.token, {
      requestId: request.requestId,
      userAgent: request.userAgent,
    });
    request.setCookie(cookie);
    return view;
  }
}
