// The entitlements bounded context (A-02-02; ADR-0007, PLT-21): the catalogue, the cached
// resolution for a clinic (EntitlementsPort, read by A-02-03's limits and capabilities) and the
// super admin's routes on the shifa_platform pool. Super-admin names come from identity.
import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { type PlatformDb, tenant } from '@shifa/db';
import { eq } from 'drizzle-orm';
import { type RequestScope, TenantDb } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { EntitlementsAdmin } from './admin.service.ts';
import { CachedEntitlements, ENTITLEMENTS } from './cache.ts';
import {
  ENTITLEMENT_CATALOGUE,
  EntitlementCatalogue,
  type EntitlementDefinition,
  PRODUCTION_ENTITLEMENTS,
} from './catalogue.ts';
import { EntitlementsController } from './entitlements.controller.ts';
import { loadSources } from './sources.ts';
import { ENTITLEMENTS_PLATFORM_DB } from './tokens.ts';

@Module({})
export class EntitlementsModule {
  /** `identity`: the registered IdentityModule (OwnerAccounts, CLOCK). */
  static register({
    platformDb,
    identity,
    entitlements = PRODUCTION_ENTITLEMENTS,
  }: {
    platformDb: PlatformDb;
    identity: NonNullable<ModuleMetadata['imports']>[number];
    entitlements?: readonly EntitlementDefinition[];
  }): DynamicModule {
    return {
      module: EntitlementsModule,
      imports: [identity],
      controllers: [EntitlementsController],
      providers: [
        { provide: ENTITLEMENTS_PLATFORM_DB, useValue: platformDb },
        { provide: ENTITLEMENT_CATALOGUE, useValue: new EntitlementCatalogue(entitlements) },
        {
          provide: ENTITLEMENTS,
          inject: [ENTITLEMENT_CATALOGUE, TenantDb, CLOCK],
          useFactory: (catalogue: EntitlementCatalogue, db: TenantDb, clock: Clock) =>
            new CachedEntitlements(
              catalogue,
              (scope: RequestScope) =>
                db.run(scope, async (tx) => {
                  const [own] = await tx
                    .select({ type: tenant.type })
                    .from(tenant)
                    .where(eq(tenant.id, scope.tenantId));
                  if (!own) throw new Error('the scope’s clinic has no tenant row');
                  return loadSources(tx, own.type);
                }),
              clock,
            ),
        },
        EntitlementsAdmin,
      ],
      exports: [ENTITLEMENTS, ENTITLEMENT_CATALOGUE, EntitlementsAdmin],
    };
  }
}
