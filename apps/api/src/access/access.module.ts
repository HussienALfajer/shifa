// Route access for the whole API: the global guard, the start-up annotation and catalogue check,
// the AuthPort, the permission catalogue, the role grants, and TenantDb (withTenant() only with
// the scope the guard checked). The AuthPort is handed in by AppModule (BetterAuthAdapter from
// modules/identity): access/ never imports a module itself.
import { type DynamicModule, Global, Module, type ModuleMetadata, type Type } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { AccessGuard } from './access.guard.ts';
import { AccessCheck, ROLE_GRANTS } from './access-check.ts';
import { AUTH_PORT, type AuthPort, NoAuthAdapter } from './auth.port.ts';
import {
  PERMISSION_CATALOGUE,
  PermissionCatalogue,
  type PermissionDefinition,
  PRODUCTION_PERMISSIONS,
} from './permissions.ts';
import { PRODUCTION_GRANTS } from './roles.ts';
import { TenantDb } from './tenant-db.ts';

export { ROLE_GRANTS };

@Global()
@Module({})
export class AccessModule {
  /**
   * `authPort`: the class answering AUTH_PORT, provided by one of `imports`. Without it nobody
   * is authenticated (NoAuthAdapter). `permissions`: the catalogue (production by default).
   */
  static register({
    imports = [],
    authPort,
    permissions = PRODUCTION_PERMISSIONS,
  }: {
    imports?: ModuleMetadata['imports'];
    authPort?: Type<AuthPort>;
    permissions?: readonly PermissionDefinition[];
  } = {}): DynamicModule {
    return {
      module: AccessModule,
      imports: [DiscoveryModule, ...imports],
      providers: [
        authPort
          ? { provide: AUTH_PORT, useExisting: authPort }
          : { provide: AUTH_PORT, useClass: NoAuthAdapter },
        { provide: PERMISSION_CATALOGUE, useValue: new PermissionCatalogue(permissions) },
        { provide: ROLE_GRANTS, useValue: PRODUCTION_GRANTS },
        { provide: APP_GUARD, useClass: AccessGuard },
        AccessCheck,
        TenantDb,
      ],
      exports: [TenantDb, PERMISSION_CATALOGUE],
    };
  }
}
