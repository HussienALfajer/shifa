// The identity bounded context (A-01-02): Better Auth as a library on the shifa_auth pool, sign-in,
// sessions, the sign-in throttle, identity audit rows, and the production AuthPort.
import { type DynamicModule, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { AuthDb } from '@shifa/db';
import { CLOCK, type Clock, systemClock } from '../../platform/clock.ts';
import { BetterAuthAdapter } from './better-auth.adapter.ts';
import { createShifaAuth } from './better-auth.ts';
import { IdentityController } from './identity.controller.ts';
import { IdentityAudit } from './identity-audit.ts';
import { SessionsService } from './sessions.service.ts';
import { SignInService } from './sign-in.service.ts';
import { ThrottleService } from './throttle.service.ts';
import { AUTH_DB, BETTER_AUTH, IDENTITY_CONFIG, type IdentitySecrets } from './tokens.ts';

export interface IdentityModuleOptions {
  /** Created once in main.ts (or by a test); closed by this module at shutdown. */
  authDb: AuthDb;
  secrets: IdentitySecrets;
  clock?: Clock;
}

@Module({})
export class IdentityModule implements OnApplicationShutdown {
  constructor(@Inject(AUTH_DB) private readonly authDb: AuthDb) {}

  static register({ authDb, secrets, clock = systemClock }: IdentityModuleOptions): DynamicModule {
    return {
      module: IdentityModule,
      controllers: [IdentityController],
      providers: [
        { provide: AUTH_DB, useValue: authDb },
        { provide: IDENTITY_CONFIG, useValue: secrets },
        { provide: CLOCK, useValue: clock },
        IdentityAudit,
        ThrottleService,
        SessionsService,
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
        BetterAuthAdapter,
      ],
      exports: [BetterAuthAdapter],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.authDb.close();
  }
}
