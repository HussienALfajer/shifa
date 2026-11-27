import { type DynamicModule, Module } from '@nestjs/common';
import type { AuthDb, PlatformDb, ShifaDb } from '@shifa/db';
import { AccessModule, type PermissionDefinition } from './access/index.ts';
import { BranchesModule } from './modules/branches/index.ts';
import { CapabilitiesModule } from './modules/capabilities/index.ts';
import { type EntitlementDefinition, EntitlementsModule } from './modules/entitlements/index.ts';
import { type FlagDefinition, FlagsModule } from './modules/flags/index.ts';
import { HealthModule } from './modules/health/index.ts';
import {
  BetterAuthAdapter,
  IdentityModule,
  type IdentitySecrets,
} from './modules/identity/index.ts';
import { PlatformModule } from './modules/platform/index.ts';
import { TeamModule } from './modules/team/index.ts';
import type { Clock } from './platform/clock.ts';
import { ContractModule } from './platform/contract/index.ts';
import { DatabaseModule } from './platform/database.module.ts';
import { TestSupportModule } from './platform/test-support.ts';

/** Root module. Product modules live in src/modules/<context>/ behind an index.ts. */
@Module({})
export class AppModule {
  /** `testRoutes` (NODE_ENV=test only) adds the test-only routes; never in production. */
  static register({
    db,
    authDb,
    platformDb,
    secrets,
    clock,
    clinicWebUrl,
    permissions,
    entitlements: entitlementKeys,
    flags: flagKeys,
    testRoutes = false,
  }: {
    db: ShifaDb;
    /** shifa_auth (ADR-0043): identity tables, for the identity module. */
    authDb: AuthDb;
    /** shifa_platform (ADR-0043): the super-admin API, audited per call. */
    platformDb: PlatformDb;
    secrets: IdentitySecrets;
    /** Defaults to the system clock; tests pass one they move. */
    clock?: Clock;
    /** Origin of the clinic web app, for setup links. */
    clinicWebUrl?: string | undefined;
    /** The permission catalogue; production's by default (tests add their own keys). */
    permissions?: readonly PermissionDefinition[] | undefined;
    /** The entitlement catalogue; production's by default (tests add their own keys). */
    entitlements?: readonly EntitlementDefinition[] | undefined;
    /** The flag catalogue; production's by default (tests add their own flags). */
    flags?: readonly FlagDefinition[] | undefined;
    testRoutes?: boolean;
  }): DynamicModule {
    const identity = IdentityModule.register({
      authDb,
      secrets,
      ...(clock ? { clock } : {}),
      ...(clinicWebUrl ? { clinicWebUrl } : {}),
    });
    const entitlements = EntitlementsModule.register({
      platformDb,
      identity,
      ...(entitlementKeys ? { entitlements: entitlementKeys } : {}),
    });
    const flags = FlagsModule.register({
      platformDb,
      identity,
      ...(flagKeys ? { flags: flagKeys } : {}),
    });
    return {
      module: AppModule,
      imports: [
        DatabaseModule.register(db),
        identity,
        entitlements,
        PlatformModule.register({ platformDb, identity, entitlements }),
        AccessModule.register({
          imports: [identity],
          authPort: BetterAuthAdapter,
          ...(permissions ? { permissions } : {}),
        }),
        flags,
        CapabilitiesModule.register({ entitlements, flags }),
        TeamModule.register({ identity, entitlements }),
        BranchesModule.register({ identity, entitlements }),
        ContractModule,
        HealthModule,
        ...(testRoutes ? [TestSupportModule] : []),
      ],
    };
  }
}
