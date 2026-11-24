// Sign-in and own sessions (A-01a criteria 6–10). Sign-in is the API's first public route that
// takes credentials; the others need a session and no permission (@SignedIn).
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  authChangePassword,
  authEndOtherSessions,
  authEndSession,
  authSession,
  authSessions,
  authSignIn,
  authSignOut,
  type EndedSessions,
  type RequestBody,
  type RequestParams,
  type SessionList,
  type SessionView,
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
import { AccountService } from './account.service.ts';
import { CLEAR_SESSION_COOKIE, SESSION_COOKIE } from './session-cookie.ts';
import { SessionsService } from './sessions.service.ts';
import { SignInService } from './sign-in.service.ts';

@Controller('auth')
export class IdentityController {
  constructor(
    @Inject(SignInService) private readonly signInService: SignInService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(AccountService) private readonly account: AccountService,
  ) {}

  /** Public: anyone may try; locks, timing and audit in SignInService. */
  @Public()
  @Contract(authSignIn)
  @HttpCode(200)
  @Post('sign-in')
  async signIn(
    @Body() body: RequestBody<typeof authSignIn>,
    @ClientRequest() request: RequestMeta,
  ): Promise<SessionView> {
    const { view, cookie } = await this.signInService.signIn(body, {
      requestId: request.requestId,
      ip: request.ip,
      userAgent: request.userAgent,
      presentedCookie: request.cookie(SESSION_COOKIE),
    });
    request.setCookie(cookie);
    return view;
  }

  @SignedIn()
  @BeforeMfa()
  @Contract(authSignOut)
  @HttpCode(204)
  @Post('sign-out')
  async signOut(
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<void> {
    await this.sessions.signOut(principal, request.requestId);
    request.setCookie(CLEAR_SESSION_COOKIE);
  }

  /** Before MFA too: the client learns from it what the session still needs. */
  @SignedIn()
  @BeforeMfa()
  @Contract(authSession)
  @Get('session')
  session(@CurrentPrincipal() principal: Principal): Promise<SessionView> {
    return this.sessions.view(principal);
  }

  @SignedIn()
  @Contract(authSessions)
  @Get('sessions')
  list(@CurrentPrincipal() principal: Principal): Promise<SessionList> {
    return this.sessions.list(principal);
  }

  @SignedIn()
  @Contract(authEndSession)
  @HttpCode(204)
  @Delete('sessions/:id')
  async endOne(
    @Param() params: RequestParams<typeof authEndSession>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<void> {
    await this.sessions.endOne(principal, params.id, request.requestId);
  }

  /** After MFA: OD-92, every other session ends and this one is rotated (cookie set). */
  @SignedIn()
  @Contract(authChangePassword)
  @HttpCode(200)
  @Post('password')
  async changePassword(
    @Body() body: RequestBody<typeof authChangePassword>,
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<SessionView> {
    const { view, cookie } = await this.account.changePassword(
      principal,
      body.currentPassword,
      body.newPassword,
      { requestId: request.requestId, ip: request.ip },
    );
    request.setCookie(cookie);
    return view;
  }

  @SignedIn()
  @Contract(authEndOtherSessions)
  @HttpCode(200)
  @Post('sessions/end-others')
  async endOthers(
    @CurrentPrincipal() principal: Principal,
    @ClientRequest() request: RequestMeta,
  ): Promise<EndedSessions> {
    return { ended: await this.sessions.endOthers(principal, request.requestId) };
  }
}
