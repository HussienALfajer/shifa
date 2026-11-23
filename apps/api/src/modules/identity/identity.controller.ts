// Sign-in and own sessions (A-01a criteria 6–10). Sign-in is the API's first public route that
// takes credentials; the others need a session and no permission (@SignedIn).
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
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
import { CurrentPrincipal, type Principal, Public, SignedIn } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { CLEAR_SESSION_COOKIE, SESSION_COOKIE } from './session-cookie.ts';
import { SessionsService } from './sessions.service.ts';
import { SignInService } from './sign-in.service.ts';

@Controller('auth')
export class IdentityController {
  constructor(
    @Inject(SignInService) private readonly signInService: SignInService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
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

  @SignedIn()
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
