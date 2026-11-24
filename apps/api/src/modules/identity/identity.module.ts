// The identity bounded context (A-01-02, A-01-03): Better Auth as a library on the shifa_auth
// pool, sign-in, sessions, the sign-in throttle, setup links, TOTP, identity audit rows, the
// production AuthPort, and the owner-account actions the platform module calls.
import { type DynamicModule, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { AuthDb } from '@shifa/db';
import { CLOCK, type Clock, systemClock } from '../../platform/clock.ts';
import { BetterAuthAdapter } from './better-auth.adapter.ts';
import { createShifaAuth } from './better-auth.ts';
import { IdentityController } from './identity.controller.ts';
import { IdentityAudit } from './identity-audit.ts';
import { InvitationsController } from './invitations.controller.ts';
import { InvitationsService } from './invitations.service.ts';
import { DEFAULT_CLINIC_WEB_URL } from './links.ts';
import { MeController } from './me.controller.ts';
import { MemberAccounts } from './member-accounts.service.ts';
import { MfaService } from './mfa.service.ts';
import { MyInvitations } from './my-invitations.service.ts';
import { OnboardingController } from './onboarding.controller.ts';
import { OwnerAccounts } from './owner-accounts.service.ts';
import { SessionIssuer } from './session-issuer.ts';
import { SessionsService } from './sessions.service.ts';
import { SetupLinksService } from './setup-links.service.ts';
import { SignInService } from './sign-in.service.ts';
import { SwitcherService } from './switcher.service.ts';
import { ThrottleService } from './throttle.service.ts';
import {
  AUTH_DB,
  BETTER_AUTH,
  CLINIC_WEB_URL,
  IDENTITY_CONFIG,
  type IdentitySecrets,
} from './tokens.ts';

export interface IdentityModuleOptions {
  /** Created once in main.ts (or by a test); closed by this module at shutdown. */
  authDb: AuthDb;
  secrets: IdentitySecrets;
  clock?: Clock;
  /** Origin of the clinic web app, for setup links. */
  clinicWebUrl?: string;
}

@Module({})
export class IdentityModule implements OnApplicationShutdown {
  constructor(@Inject(AUTH_DB) private readonly authDb: AuthDb) {}

  static register({
    authDb,
    secrets,
    clock = systemClock,
    clinicWebUrl = DEFAULT_CLINIC_WEB_URL,
  }: IdentityModuleOptions): DynamicModule {
    return {
      module: IdentityModule,
      controllers: [IdentityController, OnboardingController, InvitationsController, MeController],
      providers: [
        { provide: AUTH_DB, useValue: authDb },
        { provide: IDENTITY_CONFIG, useValue: secrets },
        { provide: CLOCK, useValue: clock },
        { provide: CLINIC_WEB_URL, useValue: clinicWebUrl },
        IdentityAudit,
        ThrottleService,
        SessionsService,
        SessionIssuer,
        {
          provide: BETTER_AUTH,
          inject: [SessionsService],
          useFactory: (sessions: SessionsService) =>
            createShifaAuth({
              authDb,
              secret: secrets.betterAuthSecret,
              clock,
              activeAtSignIn: (userId) => sessions.activeAtSignIn(userId),
            }),
        },
        SignInService,
        SetupLinksService,
        MfaService,
        OwnerAccounts,
        MemberAccounts,
        InvitationsService,
        MyInvitations,
        SwitcherService,
        BetterAuthAdapter,
      ],
      exports: [BetterAuthAdapter, OwnerAccounts, MemberAccounts, CLOCK],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.authDb.close();
  }
}
