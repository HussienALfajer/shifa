// Ending support from the support tab («إنهاء», contract row `endAsk` of the support session): the
// one write a support session may make (@SupportSessionWrite), ending its own grant only. Any other
// session is refused (403); once the grant has ended the guard already answers 401 `support_ended`.
import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { authEndSupport } from '@shifa/contracts';
import {
  CurrentPrincipal,
  type Principal,
  SignedIn,
  SupportSessionWrite,
} from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { PlatformSupport } from './platform-support.service.ts';

@Controller('auth/support')
export class SupportEndController {
  constructor(@Inject(PlatformSupport) private readonly support: PlatformSupport) {}

  @SignedIn()
  @SupportSessionWrite()
  @Contract(authEndSupport)
  @HttpCode(204)
  @Post('end')
  async end(
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<void> {
    await this.support.endFromSession(principal, request.requestId);
  }
}
