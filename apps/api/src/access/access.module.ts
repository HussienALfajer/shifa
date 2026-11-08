// Route access for the whole API: the global guard, the start-up annotation check, the AuthPort
// (NoAuthAdapter until Phase A) and the role grants (empty until Phase A).
import { Module } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { AccessGuard, ROLE_GRANTS } from './access.guard.ts';
import { AccessCheck } from './access-check.ts';
import { AUTH_PORT, NoAuthAdapter } from './auth.port.ts';
import { PRODUCTION_GRANTS } from './roles.ts';

export { ROLE_GRANTS };

@Module({
  imports: [DiscoveryModule],
  providers: [
    { provide: AUTH_PORT, useClass: NoAuthAdapter },
    { provide: ROLE_GRANTS, useValue: PRODUCTION_GRANTS },
    { provide: APP_GUARD, useClass: AccessGuard },
    AccessCheck,
  ],
})
export class AccessModule {}
