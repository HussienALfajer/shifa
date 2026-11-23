// Route access for the whole API: the global guard, the start-up annotation check, the AuthPort
// and the role grants (empty until Phase A adds keys). The AuthPort is handed in by AppModule
// (BetterAuthAdapter from modules/identity): access/ never imports a module itself.
import { type DynamicModule, Module, type ModuleMetadata, type Type } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { AccessGuard, ROLE_GRANTS } from './access.guard.ts';
import { AccessCheck } from './access-check.ts';
import { AUTH_PORT, type AuthPort, NoAuthAdapter } from './auth.port.ts';
import { PRODUCTION_GRANTS } from './roles.ts';

export { ROLE_GRANTS };

@Module({})
export class AccessModule {
  /**
   * `authPort`: the class answering AUTH_PORT, provided by one of `imports`. Without it nobody
   * is authenticated (NoAuthAdapter).
   */
  static register({
    imports = [],
    authPort,
  }: {
    imports?: ModuleMetadata['imports'];
    authPort?: Type<AuthPort>;
  } = {}): DynamicModule {
    return {
      module: AccessModule,
      imports: [DiscoveryModule, ...imports],
      providers: [
        authPort
          ? { provide: AUTH_PORT, useExisting: authPort }
          : { provide: AUTH_PORT, useClass: NoAuthAdapter },
        { provide: ROLE_GRANTS, useValue: PRODUCTION_GRANTS },
        { provide: APP_GUARD, useClass: AccessGuard },
        AccessCheck,
      ],
    };
  }
}
