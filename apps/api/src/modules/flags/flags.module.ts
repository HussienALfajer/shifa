// The flags bounded context (A-02-03; OD-114, PLT-25): the catalogue in code, the cached client
// that evaluates a flag for a clinic (read by the route gates and capabilities) and the super
// admin's routes on the shifa_platform pool. Super-admin names come from identity.
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { featureFlag, featureFlagTenant, type PlatformDb } from '@shifa/db';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { FlagsAdmin } from './admin.service.ts';
import {
  FLAG_CATALOGUE,
  FlagCatalogue,
  type FlagDefinition,
  PRODUCTION_FLAGS,
} from './catalogue.ts';
import { CachedFlags, FLAGS } from './client.ts';
import { FlagsController } from './flags.controller.ts';
import { FLAGS_PLATFORM_DB } from './tokens.ts';

@Module({})
export class FlagsModule {
  /** `identity`: the registered IdentityModule (OwnerAccounts, CLOCK). */
  static register({
    platformDb,
    identity,
    flags = PRODUCTION_FLAGS,
  }: {
    platformDb: PlatformDb;
    identity: NonNullable<ModuleMetadata['imports']>[number];
    flags?: readonly FlagDefinition[];
  }): DynamicModule {
    return {
      module: FlagsModule,
      imports: [identity],
      controllers: [FlagsController],
      providers: [
        { provide: FLAGS_PLATFORM_DB, useValue: platformDb },
        { provide: FLAG_CATALOGUE, useValue: new FlagCatalogue(flags) },
        {
          provide: FLAGS,
          inject: [FLAG_CATALOGUE, TenantDb, CLOCK],
          useFactory: (catalogue: FlagCatalogue, db: TenantDb, clock: Clock) =>
            new CachedFlags(
              catalogue,
              (scope: RequestScope) =>
                db.run(scope, async (tx) => ({
                  flags: await tx
                    .select({ key: featureFlag.key, mode: featureFlag.mode })
                    .from(featureFlag),
                  // RLS: only this clinic's selections.
                  selected: (
                    await tx.select({ key: featureFlagTenant.flagKey }).from(featureFlagTenant)
                  ).map((r) => r.key),
                })),
              clock,
            ),
        },
        FlagsAdmin,
      ],
      exports: [FLAGS, FLAG_CATALOGUE],
    };
  }
}
