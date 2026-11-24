// Setup links and TOTP (A-01a criteria 4, 5, 11, 12). The link routes are public: the token in
// the body is the credential, checked by its hash alone, with one answer for every invalid link.
// The MFA routes need a session and are reachable before the second factor (@BeforeMfa).
import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import {
  authMfaChallenge,
  authMfaEnrolConfirm,
  authMfaEnrolStart,
  authMfaRecoveryCodes,
  authMfaReenrolConfirm,
  authMfaReenrolStart,
  authMfaStatus,
  authSetupLinkConsume,
  authSetupLinkView,
  type MfaEnrolled,
  type MfaPassed,
  type MfaStatus,
  type RecoveryCodes,
  type RequestBody,
  type SessionView,
  type SetupLinkView,
  type TotpEnrolStart,
} from '@shifa/contracts';
import {
  BeforeMfa,
  CurrentPrincipal,
  type Principal,
  Public,
  SignedIn,
} from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { MfaService } from './mfa.service.ts';
import { SetupLinksService } from './setup-links.service.ts';

@Controller('auth')
export class OnboardingController {
  constructor(
    @Inject(SetupLinksService) private readonly links: SetupLinksService,
    @Inject(MfaService) private readonly mfa: MfaService,
  ) {}

  /** Public: the token is the credential; 404 `link_invalid` for any link that is not valid. */
  @Public()
  @Contract(authSetupLinkView)
  @HttpCode(200)
  @Post('setup-link/view')
  viewLink(@Body() body: RequestBody<typeof authSetupLinkView>): Promise<SetupLinkView> {
    return this.links.view(body.token);
  }

  /** Public: sets the password through the link and signs in (mfa 'none'). */
  @Public()
  @Contract(authSetupLinkConsume)
  @HttpCode(200)
  @Post('setup-link/consume')
  async consumeLink(
    @Body() body: RequestBody<typeof authSetupLinkConsume>,
    @ClientRequest() request: RequestMeta,
  ): Promise<SessionView> {
    const { view, cookie } = await this.links.consume(body.token, body.password, {
      requestId: request.requestId,
      userAgent: request.userAgent,
    });
    request.setCookie(cookie);
    return view;
  }

  @SignedIn()
  @BeforeMfa()
  @Contract(authMfaEnrolStart)
  @HttpCode(200)
  @Post('mfa/enrol/start')
  enrolStart(@CurrentPrincipal() principal: Principal): Promise<TotpEnrolStart> {
    return this.mfa.enrolStart(principal);
  }

  @SignedIn()
  @BeforeMfa()
  @Contract(authMfaEnrolConfirm)
  @HttpCode(200)
  @Post('mfa/enrol/confirm')
  async enrolConfirm(
    @Body() body: RequestBody<typeof authMfaEnrolConfirm>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<MfaEnrolled> {
    const result = await this.mfa.enrolConfirm(principal, body.code, {
      requestId: request.requestId,
    });
    request.setCookie(result.cookie);
    return result.body;
  }

  @SignedIn()
  @BeforeMfa()
  @Contract(authMfaChallenge)
  @HttpCode(200)
  @Post('mfa/challenge')
  async challenge(
    @Body() body: RequestBody<typeof authMfaChallenge>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<MfaPassed> {
    const result = await this.mfa.challenge(principal, body, {
      requestId: request.requestId,
    });
    request.setCookie(result.cookie);
    return result.body;
  }

  /** My account (A-01a 12a): after MFA, like every account action. */
  @SignedIn()
  @Contract(authMfaStatus)
  @Get('mfa')
  status(@CurrentPrincipal() principal: Principal): Promise<MfaStatus> {
    return this.mfa.status(principal);
  }

  @SignedIn()
  @Contract(authMfaRecoveryCodes)
  @HttpCode(200)
  @Post('mfa/recovery-codes')
  renewRecoveryCodes(
    @Body() body: RequestBody<typeof authMfaRecoveryCodes>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<RecoveryCodes> {
    return this.mfa.renewRecoveryCodes(principal, body.code, { requestId: request.requestId });
  }

  /** My account (OD-98): after MFA; a code from the old app, a new key. */
  @SignedIn()
  @Contract(authMfaReenrolStart)
  @HttpCode(200)
  @Post('mfa/re-enrol/start')
  reenrolStart(
    @Body() body: RequestBody<typeof authMfaReenrolStart>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<TotpEnrolStart> {
    return this.mfa.reenrolStart(principal, body.code, { requestId: request.requestId });
  }

  /** OD-98, OD-101: a code from the new app; ten new recovery codes; no cookie change. */
  @SignedIn()
  @Contract(authMfaReenrolConfirm)
  @HttpCode(200)
  @Post('mfa/re-enrol/confirm')
  reenrolConfirm(
    @Body() body: RequestBody<typeof authMfaReenrolConfirm>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<RecoveryCodes> {
    return this.mfa.reenrolConfirm(principal, body.code, { requestId: request.requestId });
  }
}
