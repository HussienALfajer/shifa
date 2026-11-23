import { type DynamicModule, Module } from '@nestjs/common';
import type { AuthDb, ShifaDb } from '@shifa/db';
import { AccessModule } from './access/index.ts';
import { HealthModule } from './modules/health/index.ts';
import {
  BetterAuthAdapter,
  IdentityModule,
  type IdentitySecrets,
} from './modules/identity/index.ts';
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
    secrets,
    clock,
    testRoutes = false,
  }: {
    db: ShifaDb;
    /** shifa_auth (ADR-0043): identity tables, for the identity module. */
    authDb: AuthDb;
    secrets: IdentitySecrets;
    /** Defaults to the system clock; tests pass one they move. */
    clock?: Clock;
    testRoutes?: boolean;
  }): DynamicModule {
    const identity = IdentityModule.register({ authDb, secrets, ...(clock ? { clock } : {}) });
    return {
      module: AppModule,
      imports: [
        DatabaseModule.register(db),
        identity,
        AccessModule.register({ imports: [identity], authPort: BetterAuthAdapter }),
        ContractModule,
        HealthModule,
        ...(testRoutes ? [TestSupportModule] : []),
      ],
    };
  }
}
